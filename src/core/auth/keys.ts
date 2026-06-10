// ─────────────────────────────────────────────────────────────────────────────
// AUTH / STATS — what we collect and why. (Open source, auditable.)
//
// Stored per key (table `api_keys`):
//   - key             : the API key itself (random 24 bytes)
//   - tier            : 'free' | 'pro'
//   - email           : email provided at signup (required for free tier)
//   - calls_today     : counter of API calls in the current UTC day
//   - day_bucket      : YYYY-MM-DD UTC date the counter belongs to
//   - created_at      : ms timestamp when the key was issued
//   - last_seen_at    : ms timestamp of the most recent call ("active users" metric)
//   - creator_ip      : HMAC-SHA-256(IP, server pepper) — ONLY for
//                       one-key-per-IP enforcement. The raw IP is NEVER
//                       persisted, AND because the pepper is unknown to anyone
//                       outside the server, the hash cannot be rainbow-tabled.
//
// What we do NOT log/store: prompt content, tool arguments, response
// payloads, wallet addresses, position data, query strings. Tool calls
// themselves are counted (calls_today++) but their content is never
// inspected. See `core/logger.ts` (default level=info, args dropped).
//
// Pro tier: the daily counter still increments for billing, that is the
// only thing logged.
// ─────────────────────────────────────────────────────────────────────────────

import { randomBytes, createHmac } from 'crypto';
import { getDb } from '../db/index.js';
import { createLogger } from '../logger.js';

const log = createLogger('auth:keys');

const FREE_DAILY_LIMIT = 100;
const PRO_DAILY_LIMIT = 10_000;
const KEY_PREFIX = 'mcp_';

// HMAC pepper for IP hashing. Required: without it, plain SHA-256(IPv4) is
// reversible in seconds via rainbow tables over the IPv4 space.
const _pepper = process.env.IP_HASH_PEPPER;
if (!_pepper || _pepper.length < 32) {
  throw new Error('IP_HASH_PEPPER env var must be set to a value of at least 32 chars before boot.');
}
const IP_HASH_PEPPER: string = _pepper;

/** HMAC-SHA-256 of an IP keyed by a server-side pepper. Uniqueness, no recovery. */
function hashIp(ip: string): string {
  return createHmac('sha256', IP_HASH_PEPPER).update(ip).digest('hex');
}

// 'admin' is an internal tier for operator + trusted-agent keys: no daily
// limit, never sold, only creatable by direct DB insert or admin tooling.
export type Tier = 'free' | 'pro' | 'admin';

export interface ApiKey {
  key: string;
  tier: Tier;
  email: string | null;
  calls_today: number;
  day_bucket: string;
  created_at: number;
  last_seen_at: number | null;
  creator_ip: string | null;
  polar_customer_id?: string | null;
  polar_subscription_id?: string | null;
  subscription_status?: string | null;
  tokens_spent_today?: number;
  early_adopter_slot?: number | null;
}

export interface AuthResult {
  ok: boolean;
  key?: ApiKey;
  error?: 'missing' | 'invalid' | 'rate_limited';
  remaining?: number;
}

function todayBucket(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export function generateKey(): string {
  return KEY_PREFIX + randomBytes(24).toString('base64url');
}

const EARLY_ADOPTER_CAP = 50;

export function createKey(email?: string, tier: Tier = 'free', ip?: string): ApiKey {
  const db = getDb();
  const key = generateKey();
  const now = Date.now();
  const ipHash = ip ? hashIp(ip) : null;

  // Atomic early-adopter slot assignment: a transaction guarantees two
  // simultaneous signups cannot both grab the same slot. better-sqlite3 is
  // synchronous and uses BEGIN IMMEDIATE under the hood for write transactions.
  const tx = db.transaction((): number | null => {
    const taken = (db.prepare(
      'SELECT COUNT(*) AS n FROM api_keys WHERE early_adopter_slot IS NOT NULL'
    ).get() as { n: number }).n;
    const slot = taken < EARLY_ADOPTER_CAP ? taken + 1 : null;

    db.prepare(`
      INSERT INTO api_keys (key, tier, email, calls_today, day_bucket, created_at, creator_ip, early_adopter_slot)
      VALUES (?, ?, ?, 0, '', ?, ?, ?)
    `).run(key, tier, email ?? null, now, ipHash, slot);

    return slot;
  });

  const slot = tx();
  log.info('API key created', { tier, email: email ?? 'anon', early_adopter_slot: slot });
  return db.prepare('SELECT * FROM api_keys WHERE key = ?').get(key) as ApiKey;
}

/** SHA-256 of an API key for use as a foreign reference in `tool_calls`,
 *  so the raw key never appears outside the api_keys row. */
export function hashKey(rawKey: string): string {
  return createHmac('sha256', 'predmcp:key-hash:v1').update(rawKey).digest('hex');
}

export function ipHasKey(ip: string): boolean {
  const db = getDb();
  const row = db.prepare('SELECT 1 FROM api_keys WHERE creator_ip = ? LIMIT 1').get(hashIp(ip));
  return !!row;
}

export function emailHasKey(email: string): boolean {
  const db = getDb();
  const row = db.prepare('SELECT 1 FROM api_keys WHERE email = ? LIMIT 1').get(email);
  return !!row;
}

export function validateAndConsume(rawKey: string): AuthResult {
  if (!rawKey) return { ok: false, error: 'missing' };

  const db = getDb();
  const row = db.prepare('SELECT * FROM api_keys WHERE key = ?').get(rawKey) as ApiKey | undefined;
  if (!row) return { ok: false, error: 'invalid' };

  const today = todayBucket();

  // Reset counter if it's a new day
  if (row.day_bucket !== today) {
    db.prepare('UPDATE api_keys SET calls_today = 0, day_bucket = ? WHERE key = ?').run(today, rawKey);
    row.calls_today = 0;
    row.day_bucket = today;
  }

  // 'admin' tier: internal/agent keys — counted for stats, never rate limited.
  if (row.tier === 'admin') {
    db.prepare(`
      UPDATE api_keys SET calls_today = calls_today + 1, last_seen_at = ? WHERE key = ?
    `).run(Date.now(), rawKey);
    return { ok: true, key: { ...row, calls_today: row.calls_today + 1 }, remaining: Number.MAX_SAFE_INTEGER };
  }

  // Rate limit check — free: 100/day, pro: 10,000/day
  const limit = row.tier === 'pro' ? PRO_DAILY_LIMIT : FREE_DAILY_LIMIT;
  if (row.calls_today >= limit) {
    log.warn('Rate limit hit', { key: rawKey.slice(0, 12) + '…', tier: row.tier });
    return { ok: false, error: 'rate_limited', key: row };
  }

  // Increment usage
  db.prepare(`
    UPDATE api_keys SET calls_today = calls_today + 1, last_seen_at = ? WHERE key = ?
  `).run(Date.now(), rawKey);

  const remaining = limit - row.calls_today - 1;
  return { ok: true, key: { ...row, calls_today: row.calls_today + 1 }, remaining };
}

export function getKeyInfo(rawKey: string): ApiKey | null {
  const db = getDb();
  return (db.prepare('SELECT * FROM api_keys WHERE key = ?').get(rawKey) as ApiKey) ?? null;
}

/** Records that `rawKey` invoked `toolName` during the current UTC hour.
 *  UPSERT-style: deduped per (key, tool, hour). A bot that hammers one tool
 *  1000x in 60s still counts as one distinct (tool, hour) bucket — the
 *  paywall trigger criterion stays meaningful under loop abuse. Pure
 *  fire-and-forget; never throws into the request path. */
function _hourBucket(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}T${String(d.getUTCHours()).padStart(2, '0')}`;
}

export function recordToolCall(rawKey: string, toolName: string): void {
  try {
    const db = getDb();
    const keyHash = hashKey(rawKey);
    db.prepare(`
      INSERT INTO tool_calls (key_hash, tool_name, hour_bucket, count) VALUES (?, ?, ?, 1)
      ON CONFLICT(key_hash, tool_name, hour_bucket) DO UPDATE SET count = count + 1
    `).run(keyHash, toolName, _hourBucket());
  } catch (err) {
    log.warn('recordToolCall failed (non-fatal)', { err: String(err) });
  }
}

export function getKeyByEmail(email: string): ApiKey | null {
  const db = getDb();
  return (db.prepare('SELECT * FROM api_keys WHERE email = ? ORDER BY created_at DESC LIMIT 1').get(email) as ApiKey) ?? null;
}

export function upgradeToPro(rawKey: string): boolean {
  const db = getDb();
  const result = db.prepare("UPDATE api_keys SET tier = 'pro' WHERE key = ?").run(rawKey);
  return result.changes > 0;
}

/**
 * Mark a key as Pro and link it to its Polar subscription. Idempotent.
 */
export function applyProActivation(opts: {
  apiKey: string;
  customerId: string;
  subscriptionId: string;
  status: string;
}): boolean {
  const db = getDb();
  const result = db.prepare(`
    UPDATE api_keys
       SET tier = 'pro',
           polar_customer_id = ?,
           polar_subscription_id = ?,
           subscription_status = ?
     WHERE key = ?
  `).run(opts.customerId, opts.subscriptionId, opts.status, opts.apiKey);
  log.info('Polar activation', { key: opts.apiKey.slice(0, 12) + '…', sub: opts.subscriptionId });
  return result.changes > 0;
}

/**
 * Mark a Polar subscription as canceled. The key keeps tier='pro' until the
 * end of the paid period — we just record the status. (A cron job can later
 * downgrade keys with subscription_status='canceled' past their period_end.)
 */
export function applyProCancellation(subscriptionId: string, status: string): boolean {
  const db = getDb();
  const result = db.prepare(`
    UPDATE api_keys
       SET subscription_status = ?
     WHERE polar_subscription_id = ?
  `).run(status, subscriptionId);
  return result.changes > 0;
}

export function listKeys(limit = 50): ApiKey[] {
  return getDb().prepare('SELECT * FROM api_keys ORDER BY created_at DESC LIMIT ?').all(limit) as ApiKey[];
}

export function getStats() {
  const db = getDb();
  const now = Date.now();
  const dayMs = 86_400_000;
  const today = todayBucket();

  const countSince = (sinceMs: number) =>
    (db.prepare('SELECT COUNT(*) as n FROM api_keys WHERE created_at >= ?').get(sinceMs) as { n: number }).n;

  const total = (db.prepare('SELECT COUNT(*) as n FROM api_keys').get() as { n: number }).n;
  const callsToday = (db.prepare('SELECT COALESCE(SUM(calls_today), 0) as n FROM api_keys WHERE day_bucket = ?').get(today) as { n: number }).n;
  const activeUsers7d = (db.prepare('SELECT COUNT(*) as n FROM api_keys WHERE last_seen_at >= ?').get(now - 7 * dayMs) as { n: number }).n;

  return {
    users: {
      total,
      today: countSince(now - dayMs),
      week:  countSince(now - 7 * dayMs),
      month: countSince(now - 30 * dayMs),
    },
    calls: {
      today: callsToday,
      active_users_7d: activeUsers7d,
    },
  };
}
