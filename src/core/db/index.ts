import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createHash } from 'crypto';
import { createLogger } from '../logger.js';

const log = createLogger('db');

let _db: Database.Database | null = null;

function resolvePath(p: string): string {
  if (p.startsWith('~')) return path.join(os.homedir(), p.slice(1));
  return p;
}

export function getDb(): Database.Database {
  if (!_db) throw new Error('DB not initialized. Call initDb() first.');
  return _db;
}

export function initDb(dataDir: string): Database.Database {
  const resolved = resolvePath(dataDir);
  fs.mkdirSync(resolved, { recursive: true, mode: 0o700 });

  // Harden directory permissions in case it already existed with looser perms
  try {
    fs.chmodSync(resolved, 0o700);
  } catch {}

  const dbPath = path.join(resolved, 'predmcp.db');
  log.info(`Opening database at ${dbPath}`);

  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  _db.pragma('synchronous = NORMAL');

  // Harden DB file permissions — should only be readable by the owner
  try {
    fs.chmodSync(dbPath, 0o600);
  } catch {}

  runMigrations(_db);
  log.info('Database ready');

  return _db;
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    )
  `);

  const row = db.prepare('SELECT MAX(version) as v FROM schema_version').get() as {
    v: number | null;
  };
  const current = row.v ?? 0;

  const migrations: Array<{ version: number; sql: string }> = [
    { version: 1, sql: MIGRATION_1 },
    { version: 2, sql: MIGRATION_2 },
    { version: 3, sql: MIGRATION_3 },
    { version: 4, sql: MIGRATION_4 },
    { version: 5, sql: MIGRATION_5 },
    { version: 6, sql: MIGRATION_6 },
  ];

  for (const migration of migrations) {
    if (migration.version <= current) continue;
    log.info(`Applying migration ${migration.version}`);
    db.exec(migration.sql);
    db.prepare('INSERT INTO schema_version VALUES (?, ?)').run(migration.version, Date.now());
  }
}

// ─── Migration 1: base schema ─────────────────────────────────────────────────
const MIGRATION_1 = `
  -- Audit log: immutable record of everything
  CREATE TABLE IF NOT EXISTS audit_log (
    id           TEXT PRIMARY KEY,
    event_type   TEXT NOT NULL,
    entity_id    TEXT,
    entity_type  TEXT,
    data         TEXT,               -- JSON
    created_at   INTEGER NOT NULL,
    prev_hash    TEXT,
    entry_hash   TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_audit_type ON audit_log(event_type, created_at);
  CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_id);
`;

// ─── Migration 2: API keys + usage ────────────────────────────────────────────
const MIGRATION_2 = `
  CREATE TABLE IF NOT EXISTS api_keys (
    key          TEXT PRIMARY KEY,
    tier         TEXT NOT NULL DEFAULT 'free',   -- 'free' | 'pro'
    email        TEXT,
    calls_today  INTEGER NOT NULL DEFAULT 0,
    day_bucket   TEXT NOT NULL DEFAULT '',        -- YYYY-MM-DD, reset when stale
    created_at   INTEGER NOT NULL,
    last_seen_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_keys_email ON api_keys(email);
`;

// ─── Migration 3: store hashed creator IP for one-key-per-IP enforcement ──────
// We never persist raw IPs. The column holds an HMAC-SHA-256 of the IP keyed by
// an env-secret pepper (IP_HASH_PEPPER). See core/auth/keys.ts for usage.
const MIGRATION_3 = `
  ALTER TABLE api_keys ADD COLUMN creator_ip TEXT;
  CREATE INDEX IF NOT EXISTS idx_keys_creator_ip ON api_keys(creator_ip);
`;

// ─── Migration 4: Polar.sh billing + token spend tracking ──────────────────────
// Pro tier billed via Polar.sh. polar_customer_id + polar_subscription_id let us
// reconcile webhook events to the local key. tokens_spent_today is reserved for
// future LLM-powered tools that incur Anthropic API cost — not yet metered.
const MIGRATION_4 = `
  ALTER TABLE api_keys ADD COLUMN polar_customer_id TEXT;
  ALTER TABLE api_keys ADD COLUMN polar_subscription_id TEXT;
  ALTER TABLE api_keys ADD COLUMN subscription_status TEXT;
  ALTER TABLE api_keys ADD COLUMN tokens_spent_today INTEGER NOT NULL DEFAULT 0;
  CREATE INDEX IF NOT EXISTS idx_polar_sub ON api_keys(polar_subscription_id);
`;

// ─── Migration 5: OTP codes for email-based key recovery ──────────────────────
// One-time 6-digit codes emailed to existing users so they can retrieve their
// API key from any device. Codes are short-lived (10 min), single-use, and
// rate-limited per email (max 5/hour).
const MIGRATION_5 = `
  CREATE TABLE IF NOT EXISTS otp_codes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    email       TEXT NOT NULL,
    code_hash   TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    expires_at  INTEGER NOT NULL,
    used_at     INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes(email, created_at);
  CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_codes(expires_at);
`;

// ─── Migration 6: OAuth 2.1 + Dynamic Client Registration ─────────────────────
// Enables claude.ai's custom-connector form (which only accepts OAuth) to
// auto-discover and authenticate. The OAuth access_token IS the user's API
// key — the OAuth wrapper is just "prove you own this email, get your key
// back as a Bearer token". See core/oauth/*.
const MIGRATION_6 = `
  CREATE TABLE IF NOT EXISTS oauth_clients (
    client_id        TEXT PRIMARY KEY,
    client_name      TEXT,
    redirect_uris    TEXT NOT NULL,           -- JSON array
    grant_types      TEXT,                    -- JSON array (defaults to ["authorization_code"])
    response_types   TEXT,                    -- JSON array (defaults to ["code"])
    token_endpoint_auth_method TEXT NOT NULL DEFAULT 'none',
    created_at       INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
    code                  TEXT PRIMARY KEY,
    client_id             TEXT NOT NULL,
    redirect_uri          TEXT NOT NULL,
    api_key               TEXT NOT NULL,       -- becomes the access_token on exchange
    code_challenge        TEXT NOT NULL,
    code_challenge_method TEXT NOT NULL,       -- always 'S256'
    scope                 TEXT,
    expires_at            INTEGER NOT NULL,
    created_at            INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_oauth_codes_expires ON oauth_authorization_codes(expires_at);

  CREATE TABLE IF NOT EXISTS oauth_pending_authorizations (
    state              TEXT PRIMARY KEY,        -- server-issued, opaque, single-page-load
    client_id          TEXT NOT NULL,
    redirect_uri       TEXT NOT NULL,
    code_challenge     TEXT NOT NULL,
    code_challenge_method TEXT NOT NULL,
    scope              TEXT,
    client_state       TEXT,                    -- the client's 'state' to echo back
    expires_at         INTEGER NOT NULL,
    created_at         INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_oauth_pending_expires ON oauth_pending_authorizations(expires_at);
`;

// ─── Audit helper ─────────────────────────────────────────────────────────────
// NOTE: the audit() helper below is wired but intentionally not called anywhere
// in the public OSS release. It exists to support future compliance/regulatory
// requirements (tamper-evident audit log). Until it's called, the audit_log
// table stays empty. We deliberately do NOT log tool-call payloads.
//
let _ulid: (() => string) | null = null;
function makeId(): string {
  // Monotonic ULID fallback — replaced with proper ulid once module loads
  if (_ulid) return _ulid();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

// Tamper-evident chain: each entry hashes its own content + previous entry hash.
// Seeded from DB at init. Breaks in the chain reveal post-hoc tampering.
let _lastAuditHash = '0000000000000000000000000000000000000000000000000000000000000000'; // genesis

function seedAuditChain(db: Database.Database): void {
  const row = db
    .prepare(
      'SELECT entry_hash FROM audit_log WHERE entry_hash IS NOT NULL ORDER BY created_at DESC LIMIT 1',
    )
    .get() as { entry_hash: string } | undefined;
  if (row?.entry_hash) _lastAuditHash = row.entry_hash;
}

// Async init — called from initDb
export async function loadUlid(): Promise<void> {
  const mod = await import('ulid');
  _ulid = mod.monotonicFactory();
  // Seed hash chain from existing audit log
  try {
    seedAuditChain(getDb());
  } catch {
    /* DB not ready yet — will be seeded on first audit() call */
  }
}

export function audit(
  eventType: string,
  entityId?: string,
  entityType?: string,
  data?: unknown,
): void {
  const db = getDb();
  const id = makeId();
  const dataStr = data ? JSON.stringify(data) : null;
  const createdAt = Date.now();

  // Hash chain: SHA-256 over canonical entry content + previous hash
  const entryHash = createHash('sha256')
    .update(id)
    .update(eventType)
    .update(entityId ?? '')
    .update(entityType ?? '')
    .update(dataStr ?? '')
    .update(String(createdAt))
    .update(_lastAuditHash)
    .digest('hex');

  db.prepare(
    `
    INSERT INTO audit_log (id, event_type, entity_id, entity_type, data, created_at, prev_hash, entry_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    id,
    eventType,
    entityId ?? null,
    entityType ?? null,
    dataStr,
    createdAt,
    _lastAuditHash,
    entryHash,
  );

  _lastAuditHash = entryHash;
}

// ─── Typed query helpers ──────────────────────────────────────────────────────
export function jsonParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
