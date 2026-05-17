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

export type Tier = 'free' | 'pro';

export interface ApiKey {
  key: string;
  tier: Tier;
  email: string | null;
  calls_today: number;
  day_bucket: string;
  created_at: number;
  last_seen_at: number | null;
  creator_ip: string | null;
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

export function createKey(email?: string, tier: Tier = 'free', ip?: string): ApiKey {
  const db = getDb();
  const key = generateKey();
  const now = Date.now();
  // Store only the SHA-256 hash of the IP (used solely for one-key-per-IP).
  const ipHash = ip ? hashIp(ip) : null;
  db.prepare(`
    INSERT INTO api_keys (key, tier, email, calls_today, day_bucket, created_at, creator_ip)
    VALUES (?, ?, ?, 0, '', ?, ?)
  `).run(key, tier, email ?? null, now, ipHash);
  // Log without the raw IP.
  log.info('API key created', { tier, email: email ?? 'anon' });
  return db.prepare('SELECT * FROM api_keys WHERE key = ?').get(key) as ApiKey;
}

export function ipHasKey(ip: string): boolean {
  const db = getDb();
  const row = db.prepare('SELECT 1 FROM api_keys WHERE creator_ip = ? LIMIT 1').get(hashIp(ip));
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

  // Rate limit check (pro tier is unlimited)
  if (row.tier === 'free' && row.calls_today >= FREE_DAILY_LIMIT) {
    log.warn('Rate limit hit', { key: rawKey.slice(0, 12) + '…' });
    return { ok: false, error: 'rate_limited', key: row };
  }

  // Increment usage
  db.prepare(`
    UPDATE api_keys SET calls_today = calls_today + 1, last_seen_at = ? WHERE key = ?
  `).run(Date.now(), rawKey);

  const remaining = row.tier === 'pro' ? Infinity : FREE_DAILY_LIMIT - row.calls_today - 1;
  return { ok: true, key: { ...row, calls_today: row.calls_today + 1 }, remaining };
}

export function getKeyInfo(rawKey: string): ApiKey | null {
  const db = getDb();
  return (db.prepare('SELECT * FROM api_keys WHERE key = ?').get(rawKey) as ApiKey) ?? null;
}

export function upgradeToPro(rawKey: string): boolean {
  const db = getDb();
  const result = db.prepare("UPDATE api_keys SET tier = 'pro' WHERE key = ?").run(rawKey);
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
