import Fastify from 'fastify';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import { handleMcpRequest } from './mcp-handler.js';
import { createLogger } from '../logger.js';
import { getConfig } from '../../config/index.js';
import {
  createKey,
  validateAndConsume,
  listKeys,
  upgradeToPro,
  ipHasKey,
  emailHasKey,
  getStats,
  getKeyInfo,
  getKeyByEmail,
  applyProActivation,
  applyProCancellation,
} from '../auth/keys.js';
import { createOtp, verifyOtp } from '../auth/otp.js';
import { sendEmail, buildOtpEmail } from '../email/index.js';
import {
  isStripeConfigured,
  createCheckout,
  verifyWebhookSignature,
  isActivationEvent,
  isCancellationEvent,
  extractApiKeyFromEvent,
  type StripeWebhookEvent,
} from '../billing/stripe.js';
import { landingHtml } from '../../server/landing.js';
import { buildDashboardHtml } from '../../server/dashboard.js';
import { requestContext } from './request-context.js';
import { signalBus } from './signal-bus.js';
import { startSignalPoller } from './signal-poller.js';
import { llmsTxt, llmsFullTxt, mcpServerJson } from './discovery.js';
import { registerOAuthRoutes, protectedResourceMetadata } from '../oauth/handlers.js';

const log = createLogger('http');

// Fail-closed: refuse to start if ADMIN_SECRET is missing or default.
const ADMIN_SECRET = process.env.ADMIN_SECRET;
if (!ADMIN_SECRET || ADMIN_SECRET === 'change-me' || ADMIN_SECRET.length < 32) {
  throw new Error('ADMIN_SECRET env var must be set to a value of at least 32 chars before boot.');
}

// Comma-separated list of CIDRs or true to fully trust X-Forwarded-For.
// Defaults to false (no proxy) — set TRUST_PROXY=loopback in env when running behind nginx.
const TRUST_PROXY = process.env.TRUST_PROXY;

export function buildHttpServer() {
  const fastify = Fastify({
    logger: false,
    trustProxy: TRUST_PROXY ? (TRUST_PROXY === 'true' ? true : TRUST_PROXY) : false,
  });

  fastify.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'x-api-key', 'Authorization', 'Mcp-Session-Id'],
    exposedHeaders: ['Mcp-Session-Id'],
  });
  fastify.register(formbody);

  // ── Landing page ────────────────────────────────────────────────────────────
  fastify.get('/', async (_, reply) => {
    reply
      .header('Cache-Control', 'no-store, no-cache, must-revalidate')
      .header('Pragma', 'no-cache')
      .header('Expires', '0')
      .type('text/html')
      .send(landingHtml);
  });

  // ── Public: health ──────────────────────────────────────────────────────────
  fastify.get('/health', async () => ({
    status: 'ok',
    service: 'predmcp',
    version: '0.1.0',
    ts: new Date().toISOString(),
  }));

  // ── SEO ─────────────────────────────────────────────────────────────────────
  fastify.get('/robots.txt', async (_, reply) => {
    reply.type('text/plain').send(
      'User-agent: *\n' +
      'Allow: /\n' +
      'Disallow: /admin/\n' +
      'Disallow: /api/\n' +
      'Disallow: /webhook/\n' +
      'Disallow: /auth/\n' +
      '\n' +
      'Sitemap: https://predmcp.com/sitemap.xml\n',
    );
  });

  fastify.get('/sitemap.xml', async (_, reply) => {
    const today = new Date().toISOString().slice(0, 10);
    reply.type('application/xml').send(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      `  <url><loc>https://predmcp.com/</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>\n` +
      `  <url><loc>https://predmcp.com/signup</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>\n` +
      `  <url><loc>https://predmcp.com/llms.txt</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>\n` +
      `  <url><loc>https://predmcp.com/server.json</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>\n` +
      '</urlset>\n',
    );
  });

  // ── AI discoverability ─────────────────────────────────────────────────────
  // llms.txt — Anthropic-pushed standard. Markdown summary read by AI crawlers
  // and agents looking for tools to use. Spec: https://llmstxt.org
  fastify.get('/llms.txt', async (_, reply) => {
    reply
      .type('text/plain; charset=utf-8')
      .header('Cache-Control', 'public, max-age=3600')
      .send(llmsTxt);
  });

  fastify.get('/llms-full.txt', async (_, reply) => {
    reply
      .type('text/plain; charset=utf-8')
      .header('Cache-Control', 'public, max-age=3600')
      .send(llmsFullTxt);
  });

  // MCP manifest at /server.json (registry standard) and at /.well-known/mcp.json
  // for clients/registries that auto-discover.
  fastify.get('/server.json', async (_, reply) => {
    reply
      .type('application/json; charset=utf-8')
      .header('Cache-Control', 'public, max-age=3600')
      .header('Access-Control-Allow-Origin', '*')
      .send(mcpServerJson);
  });

  fastify.get('/.well-known/mcp.json', async (_, reply) => {
    reply
      .type('application/json; charset=utf-8')
      .header('Cache-Control', 'public, max-age=3600')
      .header('Access-Control-Allow-Origin', '*')
      .send(mcpServerJson);
  });

  // Favicon — SVG (modern browsers) + ICO fallback (just redirects to SVG)
  fastify.get('/favicon.svg', async (_, reply) => {
    try {
      const fs = await import('fs');
      const path = await import('path');
      // Look for the icon next to dist/ (production) or in repo root (dev)
      const candidates = [
        path.resolve(process.cwd(), 'icon.svg'),
        path.resolve(process.cwd(), 'assets/icon.svg'),
        path.resolve(process.cwd(), '../icon.svg'),
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          reply.type('image/svg+xml').header('Cache-Control', 'public, max-age=86400').send(fs.readFileSync(p));
          return;
        }
      }
      reply.status(404).send();
    } catch {
      reply.status(404).send();
    }
  });

  fastify.get('/favicon.ico', async (_, reply) => {
    reply.redirect('/favicon.svg', 302);
  });

  // OG image — 1200x630 PNG for social sharing
  fastify.get('/og-image.png', async (_, reply) => {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const candidates = [
        path.resolve(process.cwd(), 'og-image.png'),
        path.resolve(process.cwd(), 'assets/og-image.png'),
        path.resolve(process.cwd(), '../og-image.png'),
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          reply.type('image/png').header('Cache-Control', 'public, max-age=86400').send(fs.readFileSync(p));
          return;
        }
      }
      reply.status(404).send();
    } catch {
      reply.status(404).send();
    }
  });

  // ── Public: free tier signup ────────────────────────────────────────────────
  fastify.get('/signup', async (_, reply) => { reply.type('text/html').send(landingHtml); });

  // Stripe checkout return pages
  fastify.get('/upgrade/success', async (_, reply) => {
    reply.type('text/html').send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>PredMCP — Pro activated</title><style>body{background:#0a0a0f;color:#e2e2f0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:2rem}.box{background:#111118;border:1px solid #1e1e2e;border-radius:12px;padding:2.5rem 2rem;max-width:440px}h1{font-size:1.4rem;color:#fff;margin:0 0 0.5rem}p{color:#6b6b8a;font-size:0.92rem;line-height:1.6;margin:0.5rem 0}.check{font-size:2.5rem;color:#00d084;margin-bottom:0.5rem}a{color:#7c5cfc;text-decoration:none}</style></head><body><div class="box"><div class="check">✓</div><h1>You're on Pro — 7-day trial started</h1><p>Your API key is now upgraded. 10,000 calls/day, all 24 tools.</p><p>No charge during the trial. Cancel anytime from your billing portal.</p><p style="margin-top:1.5rem"><a href="/">← Back to predmcp.com</a></p></div></body></html>`);
  });

  fastify.get('/upgrade/cancel', async (_, reply) => {
    reply.type('text/html').send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>PredMCP — Upgrade canceled</title><style>body{background:#0a0a0f;color:#e2e2f0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:2rem}.box{background:#111118;border:1px solid #1e1e2e;border-radius:12px;padding:2.5rem 2rem;max-width:440px}h1{font-size:1.4rem;color:#fff;margin:0 0 0.5rem}p{color:#6b6b8a;font-size:0.92rem;line-height:1.6;margin:0.5rem 0}a{color:#7c5cfc;text-decoration:none}</style></head><body><div class="box"><h1>Upgrade canceled</h1><p>No worries — your free tier is still active.</p><p style="margin-top:1.5rem"><a href="/">← Back to predmcp.com</a></p></div></body></html>`);
  });

  // MCP Registry HTTP verification
  fastify.get('/.well-known/mcp-registry-auth', async (_, reply) => {
    reply.type('text/plain').send('v=MCPv1; k=ed25519; p=XiWoHthUuVYKNtcDNpYnTdyvZXMKrjB88ehbuQ5EKSY=');
  });

  // OAuth protected resource metadata (RFC 9728) — points to our authorization server
  fastify.get('/.well-known/oauth-protected-resource', async (_, reply) => {
    reply.type('application/json').send(protectedResourceMetadata);
  });

  // Register OAuth 2.1 + Dynamic Client Registration routes
  // (/.well-known/oauth-authorization-server, /oauth/register, /oauth/authorize, /oauth/token)
  registerOAuthRoutes(fastify);
  fastify.post('/signup', {
    schema: {
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', minLength: 5, maxLength: 254 },
        },
        required: ['email'],
      },
    },
  }, async (request, reply) => {
    const body = request.body as { email: string };
    // Server-side email format check (JS regex, applied after Fastify schema validates type).
    if (!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(body.email)) {
      reply.status(400).send({ error: 'Invalid email address.' });
      return;
    }
    const ip = request.ip;
    // One key per IP AND one key per email. Distinguish so the frontend can
    // show the right recovery UI: email collision → look up account; IP
    // collision (different email) → ask user to use the original email.
    if (emailHasKey(body.email)) {
      reply.status(429).send({ error: 'Email already registered.', code: 'email_collision' });
      return;
    }
    if (ipHasKey(ip)) {
      reply.status(429).send({ error: 'Your IP already has a key. Sign in with the original email.', code: 'ip_collision' });
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

  // ── Auth via OTP (email recovery / multi-device access) ─────────────────────
  // POST /auth/request-otp body { email } → emails a 6-digit code if a key exists.
  // We always return 200 to avoid leaking whether an email is registered.
  const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

  fastify.post('/auth/request-otp', {
    schema: {
      body: {
        type: 'object',
        properties: { email: { type: 'string', minLength: 5, maxLength: 254 } },
        required: ['email'],
      },
    },
  }, async (request, reply) => {
    const { email } = request.body as { email: string };
    if (!EMAIL_RE.test(email)) return { ok: true, tier: null };
    const key = getKeyByEmail(email);
    if (!key) return { ok: true, tier: null }; // silent: don't leak account existence
    // OTP recovery available for all tiers (free + pro).
    const result = createOtp(email);
    if ('error' in result) {
      // Account exists but user hit rate limit — tell them explicitly so they
      // don't wait for an email that won't come.
      return reply.status(429).send({
        error: 'Too many codes requested. Wait an hour or contact support.',
        code: 'rate_limited',
      });
    }
    const { subject, text, html } = buildOtpEmail(result.code);
    await sendEmail({ to: email, subject, text, html });
    return { ok: true, tier: key.tier };
  });

  // POST /auth/verify-otp body { email, code } → { key, tier } on success
  fastify.post('/auth/verify-otp', {
    schema: {
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', minLength: 5, maxLength: 254 },
          code: { type: 'string', minLength: 6, maxLength: 6 },
        },
        required: ['email', 'code'],
      },
    },
  }, async (request, reply) => {
    const { email, code } = request.body as { email: string; code: string };
    if (!EMAIL_RE.test(email)) return reply.status(400).send({ error: 'Invalid email.' });
    if (!verifyOtp(email, code)) return reply.status(401).send({ error: 'Invalid or expired code.' });
    const key = getKeyByEmail(email);
    if (!key) return reply.status(404).send({ error: 'No account found.' });
    return {
      key: key.key,
      tier: key.tier,
      daily_limit: key.tier === 'pro' ? 10000 : 100,
    };
  });

  // ── Server-Sent Events: push signals to subscribed agents ───────────────────
  // Auth: same API key validation as the MCP endpoint. Each connected client
  // receives every signal as it fires. The poller publishes one event stream
  // for the whole server (see signal-poller.ts).
  fastify.get('/sse/signals', {
    preHandler: async (request, reply) => {
      const query = request.query as Record<string, string>;
      const rawKey =
        (request.headers['x-api-key'] as string | undefined) ??
        (request.headers['authorization'] as string | undefined)?.replace(/^Bearer\s+/i, '') ??
        query['x-api-key'];
      const result = validateAndConsume(rawKey ?? '');
      if (!result.ok) {
        return reply.status(401).send({ error: 'API key required for /sse/signals.' });
      }
    },
  }, (request, reply) => {
    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    // Tell the client we're alive
    res.write(`: connected ${new Date().toISOString()}\n\n`);

    const onSignal = (ev: unknown) => {
      try {
        res.write(`event: signal\ndata: ${JSON.stringify(ev)}\n\n`);
      } catch {
        /* client disconnected mid-write */
      }
    };
    signalBus.on('signal', onSignal);

    // Heartbeat every 25s to keep proxies/load balancers from timing out
    const heartbeat = setInterval(() => {
      try {
        res.write(`: heartbeat ${Date.now()}\n\n`);
      } catch {
        /* socket dead */
      }
    }, 25_000);

    const cleanup = () => {
      clearInterval(heartbeat);
      signalBus.off('signal', onSignal);
    };
    request.raw.on('close', cleanup);
    request.raw.on('error', cleanup);
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
        // RFC 9728 — let OAuth-capable clients (claude.ai, etc.) discover the
        // authorization server from this 401 response.
        if (status === 401) {
          reply.header(
            'WWW-Authenticate',
            'Bearer realm="predmcp", error="invalid_token", resource_metadata="https://predmcp.com/.well-known/oauth-protected-resource"',
          );
        }
        reply.status(status).send({ error: messages[result.error!] });
        return;
      }

      // Attach key info to request for logging
      (request as import('fastify').FastifyRequest & { apiKey?: string }).apiKey = rawKey;
    },
  };

  const withIpContext = (handler: typeof handleMcpRequest): typeof handleMcpRequest =>
    (request, reply) => {
      const ip = request.ip;
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
      const { fetchFundingRates } = await import('../../sources/hyperliquid.js');
      const { fetchHip4Markets } = await import('../../sources/hip4.js');
      const [rates, hip4] = await Promise.all([fetchFundingRates(['BTC']), fetchHip4Markets()]);
      const btc = rates[0];
      const btcHip4 = hip4.find((m: { base: string }) => m.base.startsWith('BTC'));
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

  // ── Billing: Stripe upgrade flow ────────────────────────────────────────────
  // ── Upgrade flow with email verification (OTP before checkout) ──────────────
  // Step 1: POST /api/upgrade-start  body: { email }
  //   → looks up account by email, sends OTP to that email, returns { otp_required: true }
  // Step 2: POST /api/upgrade-verify body: { email, otp }
  //   → verifies OTP, creates Stripe checkout, returns { checkout_url }
  //
  // This ensures the user controls the email BEFORE entering payment info.
  fastify.post('/api/upgrade-start', {
    schema: {
      body: {
        type: 'object',
        properties: { email: { type: 'string', minLength: 5, maxLength: 254 } },
        required: ['email'],
      },
    },
  }, async (request, reply) => {
    if (!isStripeConfigured()) return reply.status(503).send({ error: 'Billing not configured.' });
    const { email } = request.body as { email: string };
    if (!EMAIL_RE.test(email)) return reply.status(400).send({ error: 'Invalid email.' });
    const key = getKeyByEmail(email);
    if (!key) return reply.status(404).send({ error: 'No account found for this email.' });
    if (key.tier === 'pro') return reply.status(409).send({ error: 'Already on Pro tier.' });

    const result = createOtp(email);
    if ('error' in result) {
      return reply.status(429).send({ error: 'Too many codes requested. Try again later.' });
    }
    const { subject, text, html } = buildOtpEmail(result.code);
    await sendEmail({ to: email, subject, text, html });
    return { otp_required: true };
  });

  fastify.post('/api/upgrade-verify', {
    schema: {
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', minLength: 5, maxLength: 254 },
          otp: { type: 'string', minLength: 6, maxLength: 6 },
        },
        required: ['email', 'otp'],
      },
    },
  }, async (request, reply) => {
    if (!isStripeConfigured()) return reply.status(503).send({ error: 'Billing not configured.' });
    const { email, otp } = request.body as { email: string; otp: string };
    if (!EMAIL_RE.test(email)) return reply.status(400).send({ error: 'Invalid email.' });
    if (!verifyOtp(email, otp)) return reply.status(401).send({ error: 'Invalid or expired code.' });
    const key = getKeyByEmail(email);
    if (!key) return reply.status(404).send({ error: 'No account found.' });
    if (key.tier === 'pro') return reply.status(409).send({ error: 'Already on Pro tier.' });
    try {
      const { url, checkoutId } = await createCheckout({ email, apiKey: key.key });
      return { checkout_url: url, checkout_id: checkoutId };
    } catch (err) {
      log.error('Verified-upgrade checkout failed', { err: String(err) });
      return reply.status(500).send({ error: 'Checkout creation failed.' });
    }
  });

  // POST /webhook/stripe — signature-verified, idempotent on subscription id.
  // Raw body is required for HMAC verification — registered via a custom
  // content-type parser that retains the raw string on the request.
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (req, body: string, done) => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        (req as unknown as { rawBody?: string }).rawBody = body;
        done(null, parsed);
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  fastify.post('/webhook/stripe', async (request, reply) => {
    if (!isStripeConfigured()) {
      return reply.status(503).send({ error: 'Billing not configured.' });
    }
    const rawBody = (request as unknown as { rawBody?: string }).rawBody ?? '';
    const ok = verifyWebhookSignature({
      rawBody,
      signatureHeader: request.headers['stripe-signature'] as string | undefined,
    });
    if (!ok) {
      log.warn('Stripe webhook: bad signature');
      return reply.status(401).send({ error: 'Invalid signature.' });
    }
    const event = request.body as StripeWebhookEvent;
    const apiKey = extractApiKeyFromEvent(event);
    const obj = event.data.object;
    const customerId = typeof obj.customer === 'string' ? obj.customer : undefined;
    // For checkout.session.completed the subscription id is on `subscription`;
    // for customer.subscription.* events it's on `id`.
    const subscriptionId =
      event.type === 'checkout.session.completed'
        ? (obj.subscription as string | undefined)
        : obj.id;

    if (isActivationEvent(event) && apiKey && customerId && subscriptionId) {
      applyProActivation({
        apiKey,
        customerId: customerId,
        subscriptionId: subscriptionId,
        status: obj.status ?? 'active',
      });
    } else if (isCancellationEvent(event) && subscriptionId) {
      applyProCancellation(subscriptionId, obj.status ?? 'canceled');
    }
    return { received: true };
  });

  // ── Admin: list keys ────────────────────────────────────────────────────────
  const adminAuth = async (request: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) => {
    const bearer = (request.headers['authorization'] as string | undefined)?.replace(/^Bearer\s+/i, '');
    const headerSecret = request.headers['x-admin-secret'] as string | undefined;
    if (bearer !== ADMIN_SECRET && headerSecret !== ADMIN_SECRET) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
  };

  fastify.get('/admin/keys', { preHandler: adminAuth }, async () => ({
    // Mask all keys in the listing — full keys never leave the admin secret holder's machine via plain GET.
    keys: listKeys(100).map((k) => ({
      ...k,
      key: k.key.slice(0, 8) + '…' + k.key.slice(-4),
    })),
  }));

  fastify.get('/admin/stats', { preHandler: adminAuth }, async () => getStats());

  // ── Admin: login page + dashboard ───────────────────────────────────────────
  // GET /admin → renders a login form that sets a same-origin cookie holding the
  // ADMIN_SECRET (httpOnly, secure, sameSite=strict). Subsequent /admin/dashboard
  // requests are auth'd from the cookie. The Bearer header path still works for
  // programmatic access (curl, gh, etc.).
  const adminCookieAuth = async (
    request: import('fastify').FastifyRequest,
    reply: import('fastify').FastifyReply,
  ) => {
    const cookieHeader = request.headers.cookie ?? '';
    const cookieToken = cookieHeader
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('predmcp_admin='))
      ?.slice('predmcp_admin='.length);
    const bearer = (request.headers['authorization'] as string | undefined)?.replace(/^Bearer\s+/i, '');
    const headerSecret = request.headers['x-admin-secret'] as string | undefined;
    if (
      bearer !== ADMIN_SECRET &&
      headerSecret !== ADMIN_SECRET &&
      cookieToken !== ADMIN_SECRET
    ) {
      return reply.status(403).type('text/html').send(loginHtml());
    }
  };

  function loginHtml(error?: string): string {
    return /* html */ `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>predmcp admin</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:#0a0a0f;color:#e2e2f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:1rem}
.box{background:#111118;border:1px solid #1e1e2e;border-radius:12px;padding:2rem;max-width:380px;width:100%}
h1{font-size:1.1rem;font-weight:700;margin-bottom:1.5rem;color:#fff}
input{width:100%;background:#0a0a0f;border:1px solid #1e1e2e;border-radius:8px;padding:0.7rem 0.9rem;color:#e2e2f0;font-family:monospace;font-size:0.85rem;margin-bottom:0.75rem}
input:focus{outline:none;border-color:#7c5cfc}
button{width:100%;background:#7c5cfc;color:#fff;border:0;border-radius:8px;padding:0.7rem;font-weight:700;font-size:0.9rem;cursor:pointer}
button:hover{background:#6d4ee8}
.err{color:#ff4f6d;font-size:0.78rem;margin-top:0.5rem}
</style></head><body>
<form class="box" method="POST" action="/admin/login">
<h1>predmcp <span style="color:#7c5cfc">admin</span></h1>
<input type="password" name="token" placeholder="Admin token" autocomplete="off" autofocus required>
<button type="submit">Sign in</button>
${error ? `<p class="err">${error}</p>` : ''}
</form></body></html>`;
  }

  fastify.get('/admin', async (_, reply) => {
    reply.type('text/html').send(loginHtml());
  });

  fastify.post('/admin/login', {
    schema: {
      body: {
        type: 'object',
        properties: { token: { type: 'string', minLength: 1 } },
        required: ['token'],
      },
    },
  }, async (request, reply) => {
    const { token } = request.body as { token: string };
    if (token !== ADMIN_SECRET) {
      return reply.status(401).type('text/html').send(loginHtml('Wrong token.'));
    }
    // Set httpOnly cookie, 8h TTL.
    reply.header(
      'Set-Cookie',
      `predmcp_admin=${token}; Path=/admin; Max-Age=28800; HttpOnly; Secure; SameSite=Strict`,
    );
    return reply.redirect('/admin/dashboard');
  });

  fastify.get('/admin/dashboard', { preHandler: adminCookieAuth }, async (_, reply) => {
    reply.type('text/html').send(buildDashboardHtml());
  });

  fastify.post('/admin/logout', async (_, reply) => {
    reply.header(
      'Set-Cookie',
      'predmcp_admin=; Path=/admin; Max-Age=0; HttpOnly; Secure; SameSite=Strict',
    );
    reply.redirect('/admin');
  });

  // ── Admin: upgrade key to pro ───────────────────────────────────────────────
  fastify.post('/admin/upgrade', {
    preHandler: adminAuth,
    schema: {
      body: {
        type: 'object',
        properties: { key: { type: 'string', minLength: 8 } },
        required: ['key'],
      },
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

  // Start the signal poller (background — fans out to all SSE-subscribed agents).
  startSignalPoller();
}
