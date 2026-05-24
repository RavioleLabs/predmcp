// src/core/oauth/handlers.ts
//
// Fastify route handlers for OAuth 2.1 + DCR. Wired from core/server/http.ts.

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  registerClient,
  getClient,
  clientAllowsRedirect,
  isValidRedirectUri,
  type RegisterRequest,
} from './clients.js';
import {
  createPendingAuthz,
  consumePendingAuthz,
  getPendingAuthz,
  issueAuthCode,
  exchangeCode,
} from './codes.js';
import { renderAuthorizePage, renderAuthorizeError } from './authorize.js';
import { authorizationServerMetadata, protectedResourceMetadata } from './discovery.js';
import { createOtp, verifyOtp } from '../auth/otp.js';
import { sendEmail, buildOtpEmail } from '../email/index.js';
import {
  createKey,
  getKeyByEmail,
  ipHasKey,
} from '../auth/keys.js';
import { createLogger } from '../logger.js';

const log = createLogger('oauth');
const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

export function registerOAuthRoutes(fastify: FastifyInstance): void {
  // ── Discovery ──────────────────────────────────────────────────────────────
  fastify.get('/.well-known/oauth-authorization-server', async (_req, reply) => {
    reply.type('application/json').send(authorizationServerMetadata);
  });

  // ── Dynamic Client Registration (RFC 7591) ─────────────────────────────────
  fastify.post('/oauth/register', async (request, reply) => {
    const body = (request.body ?? {}) as Partial<RegisterRequest>;
    try {
      if (!Array.isArray(body.redirect_uris) || body.redirect_uris.length === 0) {
        return reply.status(400).send({ error: 'invalid_redirect_uri', error_description: 'redirect_uris required' });
      }
      const client = registerClient({
        client_name: typeof body.client_name === 'string' ? body.client_name.slice(0, 100) : undefined,
        redirect_uris: body.redirect_uris,
        grant_types: body.grant_types,
        response_types: body.response_types,
        token_endpoint_auth_method: body.token_endpoint_auth_method,
        scope: typeof body.scope === 'string' ? body.scope : undefined,
      });
      log.info('client registered', { client_id: client.client_id, name: client.client_name });
      reply.status(201).send({
        client_id: client.client_id,
        client_id_issued_at: Math.floor(client.created_at / 1000),
        client_name: client.client_name ?? undefined,
        redirect_uris: client.redirect_uris,
        grant_types: client.grant_types,
        response_types: client.response_types,
        token_endpoint_auth_method: client.token_endpoint_auth_method,
      });
    } catch (err) {
      const msg = (err as Error).message;
      log.warn('client registration rejected', { msg });
      reply.status(400).send({ error: 'invalid_client_metadata', error_description: msg });
    }
  });

  // ── Authorization endpoint (HTML login flow) ───────────────────────────────
  fastify.get('/oauth/authorize', async (request, reply) => {
    const q = request.query as Record<string, string | undefined>;
    const response_type = q.response_type;
    const client_id = q.client_id;
    const redirect_uri = q.redirect_uri;
    const code_challenge = q.code_challenge;
    const code_challenge_method = q.code_challenge_method;
    const client_state = q.state ?? null;
    const scope = q.scope ?? null;

    if (response_type !== 'code') {
      return reply.type('text/html').status(400).send(renderAuthorizeError('Only response_type=code is supported.'));
    }
    if (!client_id) {
      return reply.type('text/html').status(400).send(renderAuthorizeError('Missing client_id.'));
    }
    if (!redirect_uri || !isValidRedirectUri(redirect_uri)) {
      return reply.type('text/html').status(400).send(renderAuthorizeError('Missing or invalid redirect_uri.'));
    }
    if (!code_challenge || code_challenge_method !== 'S256') {
      return reply.type('text/html').status(400).send(renderAuthorizeError('PKCE required: code_challenge with code_challenge_method=S256.'));
    }

    const client = getClient(client_id);
    if (!client) {
      return reply.type('text/html').status(400).send(renderAuthorizeError('Unknown client_id. Register via /oauth/register first.'));
    }
    if (!clientAllowsRedirect(client, redirect_uri)) {
      return reply.type('text/html').status(400).send(renderAuthorizeError('redirect_uri does not match a registered URI for this client.'));
    }

    const pending = createPendingAuthz({
      client_id,
      redirect_uri,
      code_challenge,
      code_challenge_method,
      scope,
      client_state,
    });

    reply.type('text/html').send(renderAuthorizePage({ state: pending.state, clientName: client.client_name }));
  });

  // ── send-code (step 1 of the login flow) ───────────────────────────────────
  fastify.post('/oauth/authorize/send-code', async (request, reply) => {
    const body = (request.body ?? {}) as { state?: string; email?: string };
    if (!body.state || !body.email) {
      return reply.status(400).send({ error: 'Missing state or email.' });
    }
    if (!EMAIL_RE.test(body.email)) {
      return reply.status(400).send({ error: 'Invalid email.' });
    }
    // Peek without consuming — we'll consume at verify time only
    const pending = getPendingAuthz(body.state);
    if (!pending) {
      return reply.status(400).send({ error: 'Authorization session expired. Start over.' });
    }

    const result = createOtp(body.email);
    if ('error' in result) {
      return reply.status(429).send({ error: 'Too many codes requested. Wait an hour.' });
    }
    const { subject, text, html } = buildOtpEmail(result.code);
    await sendEmail({ to: body.email, subject, text, html });
    return { ok: true };
  });

  // ── verify (step 2: validate OTP, issue auth code, return redirect) ────────
  fastify.post('/oauth/authorize/verify', async (request, reply) => {
    const body = (request.body ?? {}) as { state?: string; email?: string; code?: string };
    if (!body.state || !body.email || !body.code) {
      return reply.status(400).send({ error: 'Missing state, email, or code.' });
    }
    if (!EMAIL_RE.test(body.email) || !/^\d{6}$/.test(body.code)) {
      return reply.status(400).send({ error: 'Invalid format.' });
    }
    const pending = consumePendingAuthz(body.state);
    if (!pending) {
      return reply.status(400).send({ error: 'Authorization session expired. Start over.' });
    }
    if (!verifyOtp(body.email, body.code)) {
      return reply.status(401).send({ error: 'Invalid or expired code.' });
    }

    // Get or create the API key. New users get a free-tier key, subject to
    // the same one-key-per-IP rule as /signup.
    let key = getKeyByEmail(body.email);
    if (!key) {
      const ip = request.ip;
      if (ipHasKey(ip)) {
        return reply.status(429).send({
          error: 'This IP already has a key under a different email. Sign in with the original email.',
        });
      }
      key = createKey(body.email, 'free', ip);
      log.info('account created via OAuth flow', { email: body.email, client_id: pending.client_id });
    }

    const issued = issueAuthCode({
      client_id: pending.client_id,
      redirect_uri: pending.redirect_uri,
      api_key: key.key,
      code_challenge: pending.code_challenge,
      code_challenge_method: pending.code_challenge_method,
      scope: pending.scope,
      client_state: pending.client_state,
    });

    // Build redirect URL with code + (echoed) state
    const url = new URL(pending.redirect_uri);
    url.searchParams.set('code', issued.code);
    if (issued.client_state !== null) {
      url.searchParams.set('state', issued.client_state);
    }
    return { redirect_url: url.toString() };
  });

  // ── Token endpoint (RFC 6749 §4.1.3 + PKCE) ────────────────────────────────
  // Accepts both application/x-www-form-urlencoded (the OAuth standard) and
  // application/json (some clients send JSON). Fastify parses x-www-form-urlencoded
  // when the formbody plugin is registered.
  fastify.post('/oauth/token', async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, string>;
    const grant_type = body.grant_type;
    const code = body.code;
    const redirect_uri = body.redirect_uri;
    const client_id = body.client_id;
    const code_verifier = body.code_verifier;

    if (grant_type !== 'authorization_code') {
      return reply.status(400).send({ error: 'unsupported_grant_type' });
    }
    if (!code || !redirect_uri || !client_id || !code_verifier) {
      return reply.status(400).send({ error: 'invalid_request', error_description: 'Missing required parameter.' });
    }

    const result = exchangeCode({ code, client_id, redirect_uri, code_verifier });
    if (!result.ok) {
      return reply.status(400).send({ error: result.error });
    }

    reply
      .header('Cache-Control', 'no-store')
      .header('Pragma', 'no-cache')
      .send({
        access_token: result.api_key,
        token_type: 'Bearer',
        scope: result.scope ?? 'mcp',
      });
  });
}

// Re-export discovery metadata so http.ts can serve the updated
// /.well-known/oauth-protected-resource without importing it directly.
export { protectedResourceMetadata };
