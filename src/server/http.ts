import Fastify from 'fastify';
import cors from '@fastify/cors';
import { handleMcpRequest } from './mcp-handler.js';
import { createLogger } from '../logger.js';
import { getConfig } from '../config/index.js';
import { createKey, validateAndConsume, listKeys, upgradeToPro, ipHasKey, getStats } from '../auth/keys.js';
import { landingHtml } from './landing.js';
import { buildDashboardHtml } from './dashboard.js';
import { requestContext } from './request-context.js';

const log = createLogger('http');

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'change-me';

export function buildHttpServer() {
  const fastify = Fastify({ logger: false });

  fastify.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'x-api-key', 'Authorization', 'Mcp-Session-Id'],
    exposedHeaders: ['Mcp-Session-Id'],
  });

  // ── Landing page ────────────────────────────────────────────────────────────
  fastify.get('/', async (_, reply) => {
    reply.type('text/html').send(landingHtml);
  });

  // ── Public: health ──────────────────────────────────────────────────────────
  fastify.get('/health', async () => ({
    status: 'ok',
    service: 'predmcp',
    version: '0.1.0',
    ts: new Date().toISOString(),
  }));

  // ── Public: free tier signup ────────────────────────────────────────────────
  fastify.get('/signup', async (_, reply) => { reply.type('text/html').send(landingHtml); });
  fastify.get('/stats', async (_, reply) => { reply.type('text/html').send(buildDashboardHtml()); });

  // MCP Registry HTTP verification
  fastify.get('/.well-known/mcp-registry-auth', async (_, reply) => {
    reply.type('text/plain').send('v=MCPv1; k=ed25519; p=XiWoHthUuVYKNtcDNpYnTdyvZXMKrjB88ehbuQ5EKSY=');
  });

  // OAuth protected resource metadata (RFC 9728) — declares API-key auth, no OAuth
  fastify.get('/.well-known/oauth-protected-resource', async (_, reply) => {
    reply.type('application/json').send({
      resource: 'https://predmcp.com/mcp',
      bearer_methods_supported: ['header'],
    });
  });
  fastify.post('/signup', {
    schema: {
      body: {
        type: 'object',
        properties: { email: { type: 'string' } },
        required: ['email'],
      },
    },
  }, async (request, reply) => {
    const body = request.body as { email: string };
    const ip = (request.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ?? request.ip;
    if (ipHasKey(ip)) {
      reply.status(429).send({ error: 'One free key per IP address.' });
      return;
    }
    const key = createKey(body.email, 'free', ip);
    return {
      key: key.key,
      tier: 'free',
      daily_limit: 100,
      setup: {
        mcpServers: {
          predmcp: {
            type: 'http',
            url: 'https://predmcp.com/mcp',
            headers: { 'x-api-key': key.key },
          },
        },
      },
    };
  });

  // ── MCP endpoint — requires valid API key (except initialize/tools/list) ────
  const FREE_METHODS = new Set(['initialize', 'tools/list', 'notifications/initialized']);
  const FREE_TOOLS = new Set(['create_api_key']);

  const mcpRouteOptions = {
    preHandler: async (request: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) => {
      // Allow discovery methods and create_api_key without auth
      const body = request.body as Record<string, unknown> | undefined;
      if (body && typeof body.method === 'string' && FREE_METHODS.has(body.method)) return;
      if (body?.method === 'tools/call' && FREE_TOOLS.has((body?.params as any)?.name)) return;

      const query = request.query as Record<string, string>;
      const rawKey =
        (request.headers['x-api-key'] as string | undefined) ??
        (request.headers['authorization'] as string | undefined)?.replace(/^Bearer\s+/i, '') ??
        query['x-api-key'];

      const result = validateAndConsume(rawKey ?? '');

      if (!result.ok) {
        const status = result.error === 'rate_limited' ? 429 : 401;
        const messages: Record<string, string> = {
          missing: 'API key required. Get a free key at https://predmcp.com/signup',
          invalid: 'Invalid API key.',
          rate_limited: `Free tier limit reached (100 calls/day). Upgrade at https://predmcp.com/upgrade`,
        };
        reply.status(status).send({ error: messages[result.error!] });
        return;
      }

      // Attach key info to request for logging
      (request as import('fastify').FastifyRequest & { apiKey?: string }).apiKey = rawKey;
    },
  };

  const withIpContext = (handler: typeof handleMcpRequest): typeof handleMcpRequest =>
    (request, reply) => {
      const ip = (request.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ?? request.ip;
      return requestContext.run({ ip }, () => handler(request, reply));
    };

  fastify.post('/mcp', mcpRouteOptions, withIpContext(handleMcpRequest));
  fastify.get('/mcp', mcpRouteOptions, withIpContext(handleMcpRequest));
  fastify.delete('/mcp', mcpRouteOptions, withIpContext(handleMcpRequest));

  // ── Public: live signal for landing page ────────────────────────────────────
  let _liveBtcCache: { data: unknown; at: number } | null = null;
  fastify.get('/api/live-signal', async () => {
    if (_liveBtcCache && Date.now() - _liveBtcCache.at < 60_000) return _liveBtcCache.data;
    try {
      const { fetchFundingRates } = await import('../sources/hyperliquid.js');
      const { fetchHip4Markets } = await import('../sources/hip4.js');
      const [rates, hip4] = await Promise.all([fetchFundingRates(['BTC']), fetchHip4Markets()]);
      const btc = rates[0];
      const btcHip4 = hip4.find(m => m.base.startsWith('BTC'));
      const funding = parseFloat(btc?.funding_rate ?? '0');
      const markPx = parseFloat(btc?.mark_px ?? '0');
      const oi = parseFloat(btc?.open_interest ?? '0');
      const hip4Yes = btcHip4?.yes_price ?? null;
      const hip4Desc = btcHip4?.description ?? null;
      const signal = hip4Yes !== null
        ? (funding > 0 && hip4Yes < 0.5) || (funding < 0 && hip4Yes > 0.5) ? 'DIVERGENCE' : 'ALIGNED'
        : 'N/A';
      const data = { markPx, funding, oi: Math.round(oi), hip4Yes, hip4Desc, signal, ts: Date.now() };
      _liveBtcCache = { data, at: Date.now() };
      return data;
    } catch {
      return { error: 'unavailable' };
    }
  });

  // ── Admin: list keys ────────────────────────────────────────────────────────
  const adminAuth = async (request: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) => {
    const bearer = (request.headers['authorization'] as string | undefined)?.replace(/^Bearer\s+/i, '');
    const headerSecret = request.headers['x-admin-secret'] as string | undefined;
    if (bearer !== ADMIN_SECRET && headerSecret !== ADMIN_SECRET) {
      reply.status(403).send({ error: 'Forbidden' });
    }
  };

  fastify.get('/admin/keys', { preHandler: adminAuth }, async () => ({ keys: listKeys(100) }));

  fastify.get('/admin/stats', { preHandler: adminAuth }, async () => getStats());

  // ── Admin: upgrade key to pro ───────────────────────────────────────────────
  fastify.post('/admin/upgrade', {
    preHandler: async (request, reply) => {
      if (request.headers['x-admin-secret'] !== ADMIN_SECRET) {
        reply.status(403).send({ error: 'Forbidden' });
      }
    },
  }, async (request) => {
    const { key } = request.body as { key: string };
    const ok = upgradeToPro(key);
    return { ok };
  });

  return fastify;
}

export async function startHttpServer(): Promise<void> {
  const { server } = getConfig();
  const fastify = buildHttpServer();

  await fastify.listen({ port: server.port, host: server.host });
  log.info('PredMCP server started', { port: server.port, host: server.host });
}
