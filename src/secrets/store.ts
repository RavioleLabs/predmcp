/**
 * PredMCP Secret Store — cross-platform secret storage.
 *
 * Priority order:
 *   1. System keychain  (macOS Keychain / Linux Secret Service / Windows Credential Manager)
 *      via `keytar` — installed as optional dependency
 *   2. <dataDir>/.secrets.json at mode 0o600 — file fallback (VPS / headless)
 *
 * Usage:
 *   - initSecretsStoreSync(dataDir)  — call ONCE at boot (sync file load, async keychain probe)
 *   - getSecretSync(key)             — read from in-memory cache (always sync)
 *   - getAllSecretsSync()            — all secrets as flat map
 *   - setManySecretsSync(entries)    — write many (sync to file, async to keychain)
 *   - setSecretSync(key, value)      — write one
 *
 * Config refs:
 *   Values starting with "$" in .config.json are references: "$ANTHROPIC_API_KEY"
 *   → resolved at load time against the secrets store.
 */

import fs from 'fs';
import path from 'path';
import { createLogger } from '../core/logger.js';

const log = createLogger('secrets');
const KEYCHAIN_SERVICE = 'predmcp';

export type SecretsBackend = 'keychain' | 'file';

// ── Internal state ─────────────────────────────────────────────────────────────

let _dataDir = '';
let _cache: Record<string, string> = {};
let _backend: SecretsBackend = 'file';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _keytar: any | null = null;

// ── File helpers ───────────────────────────────────────────────────────────────

function secretsFilePath(): string {
  return path.join(_dataDir, '.secrets.json');
}

function readSecretsFile(): Record<string, string> {
  const p = secretsFilePath();
  try {
    if (!fs.existsSync(p)) return {};
    return JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, string>;
  } catch {
    return {};
  }
}

function writeSecretsFile(data: Record<string, string>): void {
  const p = secretsFilePath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  // Write atomically via temp file to avoid corruption on crash
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmp, p);
  // Ensure permissions in case the file already existed with wider perms
  try {
    fs.chmodSync(p, 0o600);
  } catch {}
}

// ── Keychain probe (async, non-blocking) ───────────────────────────────────────

async function probeKeychain(): Promise<void> {
  try {
    // Dynamic import — keytar is optional, will throw if not installed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = (await import('keytar' as any)) as any;
    // Support both CJS default export and named exports
    const kt = mod.default ?? mod;
    // Verify it actually works (headless Linux without libsecret will throw here)
    await kt.findCredentials(KEYCHAIN_SERVICE);

    _keytar = kt;
    _backend = 'keychain';

    // ── One-time sync: file → keychain ──────────────────────────────────────
    // Move any secrets that exist only in the file into the keychain.
    const fileSecrets = readSecretsFile();
    for (const [k, v] of Object.entries(fileSecrets)) {
      const existing = await kt.getPassword(KEYCHAIN_SERVICE, k);
      if (!existing) await kt.setPassword(KEYCHAIN_SERVICE, k, v);
    }

    // ── Load any keychain-only secrets into cache + file ─────────────────────
    const creds = await kt.findCredentials(KEYCHAIN_SERVICE);
    let addedToFile = 0;
    for (const { account, password } of creds) {
      if (!_cache[account]) addedToFile++;
      _cache[account] = password;
    }
    // Sync keychain → file so next boot's sync read has everything
    if (addedToFile > 0) writeSecretsFile(_cache);

    log.info(`Secrets upgraded to system keychain (${creds.length} entries)`);
  } catch {
    // keytar not installed or keyring daemon not running (headless server) → file mode
    _backend = 'file';
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Initialize the store. Must be called ONCE before any get/set.
 * Synchronously loads from file; probes keychain in the background.
 */
export function initSecretsStoreSync(dataDir: string): void {
  _dataDir = dataDir;
  _cache = readSecretsFile();
  log.debug(`Secrets store initialised (file, ${Object.keys(_cache).length} entries)`);

  // Keychain probe disabled — file mode only.
  // macOS keychain access causes persistent authorization prompts when the Node
  // binary path changes (version upgrades, launchd restarts). All secrets are
  // already persisted in <dataDir>/.secrets.json at mode 0o600 which is equally
  // secure on a personal machine. Re-enable by uncommenting if keychain is needed.
  // probeKeychain().catch(() => {});
}

export function getSecretsBackend(): SecretsBackend {
  return _backend;
}

/** Sync read from in-memory cache. */
export function getSecretSync(key: string): string | undefined {
  return _cache[key];
}

/** Sync read all secrets. Returns a shallow copy. */
export function getAllSecretsSync(): Record<string, string> {
  return { ..._cache };
}

/** Write one secret — sync to file always, fire-and-forget to keychain. */
export function setSecretSync(key: string, value: string): void {
  _cache[key] = value;
  // Always persist to file so next boot's sync read sees it regardless of keychain timing
  writeSecretsFile(_cache);
  if (_backend === 'keychain' && _keytar) {
    _keytar.setPassword(KEYCHAIN_SERVICE, key, value).catch((e: unknown) => {
      log.warn(`Keychain write failed for ${key}: ${e}`);
    });
  }
}

/** Write many secrets atomically — sync to file always, fire-and-forget to keychain. */
export function setManySecretsSync(entries: Record<string, string>): void {
  Object.assign(_cache, entries);
  // Always persist to file so next boot's sync read sees it regardless of keychain timing
  writeSecretsFile(_cache);
  if (_backend === 'keychain' && _keytar) {
    const kt = _keytar;
    Promise.all(
      Object.entries(entries).map(([k, v]) => kt.setPassword(KEYCHAIN_SERVICE, k, v)),
    ).catch((e: unknown) => log.warn(`Keychain bulk write failed: ${e}`));
  }
}

/** Delete a secret from store and keychain. */
export function deleteSecretSync(key: string): void {
  delete _cache[key];
  if (_backend === 'keychain' && _keytar) {
    _keytar.deletePassword(KEYCHAIN_SERVICE, key).catch(() => {});
  } else {
    writeSecretsFile(_cache);
  }
}
