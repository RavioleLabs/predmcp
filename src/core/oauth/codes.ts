// src/core/oauth/codes.ts
//
// Authorization codes + PKCE (RFC 7636). Codes are single-use, expire in 5min,
// and the exchanger must prove they hold the original PKCE code_verifier.
//
// Also: pending_authorizations — the short-lived server-side state that lives
// while the user is on /oauth/authorize entering their email + OTP. We don't
// trust the browser to send the full client params back to /oauth/authorize/verify;
// instead we mint a `state` token at the GET, look it up at the POST.

import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import { getDb } from '../db/index.js';

const CODE_TTL_MS = 5 * 60 * 1000;          // auth code: 5min — single exchange
const PENDING_TTL_MS = 15 * 60 * 1000;      // pending authz: 15min — covers OTP delay

function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString('base64url');
}

// ─── Pending authorizations ──────────────────────────────────────────────────
// State during the user-facing login flow. Maps an opaque server-state to the
// client-supplied OAuth params, so we don't have to round-trip them through
// hidden form fields (which would let a malicious page tamper with them).

export interface PendingAuthz {
  state: string;
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
  scope: string | null;
  client_state: string | null;        // client's original "state" param to echo back
  expires_at: number;
}

export function createPendingAuthz(opts: {
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
  scope?: string | null;
  client_state?: string | null;
}): PendingAuthz {
  const state = randomToken();
  const now = Date.now();
  const expires_at = now + PENDING_TTL_MS;
  getDb()
    .prepare(
      `INSERT INTO oauth_pending_authorizations
       (state, client_id, redirect_uri, code_challenge, code_challenge_method, scope, client_state, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      state,
      opts.client_id,
      opts.redirect_uri,
      opts.code_challenge,
      opts.code_challenge_method,
      opts.scope ?? null,
      opts.client_state ?? null,
      expires_at,
      now,
    );
  return {
    state,
    client_id: opts.client_id,
    redirect_uri: opts.redirect_uri,
    code_challenge: opts.code_challenge,
    code_challenge_method: opts.code_challenge_method,
    scope: opts.scope ?? null,
    client_state: opts.client_state ?? null,
    expires_at,
  };
}

export function consumePendingAuthz(state: string): PendingAuthz | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM oauth_pending_authorizations WHERE state = ? AND expires_at > ?')
    .get(state, Date.now()) as
    | {
        state: string;
        client_id: string;
        redirect_uri: string;
        code_challenge: string;
        code_challenge_method: string;
        scope: string | null;
        client_state: string | null;
        expires_at: number;
      }
    | undefined;
  if (!row) return null;
  // Single use: delete on consume
  db.prepare('DELETE FROM oauth_pending_authorizations WHERE state = ?').run(state);
  return row;
}

export function getPendingAuthz(state: string): PendingAuthz | null {
  const row = getDb()
    .prepare('SELECT * FROM oauth_pending_authorizations WHERE state = ? AND expires_at > ?')
    .get(state, Date.now()) as PendingAuthz | undefined;
  return row ?? null;
}

// ─── Authorization codes ─────────────────────────────────────────────────────

export interface IssuedCode {
  code: string;
  redirect_uri: string;
  client_state: string | null;
}

export function issueAuthCode(opts: {
  client_id: string;
  redirect_uri: string;
  api_key: string;
  code_challenge: string;
  code_challenge_method: string;
  scope: string | null;
  client_state: string | null;
}): IssuedCode {
  const code = randomToken();
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO oauth_authorization_codes
       (code, client_id, redirect_uri, api_key, code_challenge, code_challenge_method, scope, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      code,
      opts.client_id,
      opts.redirect_uri,
      opts.api_key,
      opts.code_challenge,
      opts.code_challenge_method,
      opts.scope,
      now + CODE_TTL_MS,
      now,
    );
  return { code, redirect_uri: opts.redirect_uri, client_state: opts.client_state };
}

export interface CodeRecord {
  code: string;
  client_id: string;
  redirect_uri: string;
  api_key: string;
  code_challenge: string;
  code_challenge_method: string;
  scope: string | null;
  expires_at: number;
}

/**
 * Single-use exchange. Looks up the code, verifies PKCE + redirect_uri + client_id,
 * deletes the code (regardless of verify outcome, to prevent retries), and returns
 * the api_key on success.
 */
export function exchangeCode(opts: {
  code: string;
  client_id: string;
  redirect_uri: string;
  code_verifier: string;
}): { ok: true; api_key: string; scope: string | null } | { ok: false; error: string } {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM oauth_authorization_codes WHERE code = ?')
    .get(opts.code) as CodeRecord | undefined;
  if (!row) return { ok: false, error: 'invalid_grant' };

  // Always burn the code, even on failure, to prevent brute-force
  db.prepare('DELETE FROM oauth_authorization_codes WHERE code = ?').run(opts.code);

  if (row.expires_at < Date.now()) return { ok: false, error: 'invalid_grant' };
  if (row.client_id !== opts.client_id) return { ok: false, error: 'invalid_grant' };
  if (row.redirect_uri !== opts.redirect_uri) return { ok: false, error: 'invalid_grant' };

  // PKCE verify
  if (row.code_challenge_method !== 'S256') return { ok: false, error: 'invalid_grant' };
  const computed = createHash('sha256').update(opts.code_verifier).digest('base64url');
  const a = Buffer.from(computed);
  const b = Buffer.from(row.code_challenge);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, error: 'invalid_grant' };
  }

  return { ok: true, api_key: row.api_key, scope: row.scope };
}

/**
 * Periodic cleanup.
 */
export function cleanupExpiredOauthCodes(): { codes: number; pending: number } {
  const db = getDb();
  const now = Date.now();
  const codes = db.prepare('DELETE FROM oauth_authorization_codes WHERE expires_at < ?').run(now).changes;
  const pending = db.prepare('DELETE FROM oauth_pending_authorizations WHERE expires_at < ?').run(now).changes;
  return { codes, pending };
}
