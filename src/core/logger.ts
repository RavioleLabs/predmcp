// Structured logger — everything goes to console + audit DB in debug mode

import fs from 'fs';
import path from 'path';
import os from 'os';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// ── Log rotation ──────────────────────────────────────────────────────────────
// Max 10MB per file, keep predmcp.log + .1..5 (≈60MB total worst case).
export const LOG_FILE = path.join(os.homedir(), '.predmcp', 'predmcp.log');
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_ROTATIONS = 5;
const ANSI_RE = /\x1b\[[0-9;]*m/g;

function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, '');
}

export function rotateLogsIfNeeded(nextWriteBytes: number): void {
  try {
    let size = 0;
    try {
      size = fs.statSync(LOG_FILE).size;
    } catch {
      return; // file doesn't exist yet
    }
    if (size + nextWriteBytes <= MAX_BYTES) return;

    // copytruncate strategy: launchd/systemd hold an open FD to predmcp.log, so
    // a plain rename would leave the FD writing to the renamed inode forever.
    // Instead: shift .N → .N+1, copy current → .1, then truncate-in-place so
    // the inherited FD keeps writing at offset 0.
    const oldest = `${LOG_FILE}.${MAX_ROTATIONS}`;
    try {
      if (fs.existsSync(oldest)) fs.unlinkSync(oldest);
    } catch {
      /* ignore */
    }
    for (let i = MAX_ROTATIONS - 1; i >= 1; i--) {
      const src = `${LOG_FILE}.${i}`;
      const dst = `${LOG_FILE}.${i + 1}`;
      try {
        if (fs.existsSync(src)) fs.renameSync(src, dst);
      } catch {
        /* ignore */
      }
    }
    try {
      fs.copyFileSync(LOG_FILE, `${LOG_FILE}.1`);
      fs.truncateSync(LOG_FILE, 0);
    } catch {
      /* ignore */
    }
  } catch {
    /* never break logging on rotation failure */
  }
}

export function cleanLogs(): { removed: string[]; truncated: string } {
  const removed: string[] = [];
  for (let i = 1; i <= MAX_ROTATIONS; i++) {
    const f = `${LOG_FILE}.${i}`;
    try {
      if (fs.existsSync(f)) {
        fs.unlinkSync(f);
        removed.push(f);
      }
    } catch {
      /* ignore */
    }
  }
  try {
    if (fs.existsSync(LOG_FILE)) fs.truncateSync(LOG_FILE, 0);
  } catch {
    /* ignore */
  }
  return { removed, truncated: LOG_FILE };
}

// Dedicated append-mode FD to LOG_FILE. O_APPEND guarantees every write lands
// at the current end-of-file, which makes copytruncate rotation safe (after
// ftruncate the next write resumes at offset 0). This is independent of
// whatever stdout was wired to by launchd/systemd.
let logFd: number | null = null;
function openLogFd(): number | null {
  if (logFd !== null) return logFd;
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    logFd = fs.openSync(LOG_FILE, 'a');
  } catch {
    logFd = null;
  }
  return logFd;
}

function writeToLogFile(line: string): void {
  const fd = openLogFd();
  if (fd === null) return;
  const clean = stripAnsi(line);
  const buf = Buffer.from(clean.endsWith('\n') ? clean : clean + '\n');
  try {
    rotateLogsIfNeeded(buf.byteLength);
    fs.writeSync(fd, buf);
  } catch {
    /* never break the pipeline on log failure */
  }
}

// If launchd/systemd has wired stdout/stderr directly to predmcp.log, take over:
// replace stdout.write/stderr.write so console.log goes through OUR rotating
// O_APPEND fd. Otherwise log() would write the line twice (once via console,
// once via writeToLogFile). When stdout is a TTY (foreground/dev mode), we
// keep console output and ALSO mirror to the file.
let stdoutOwnsLogFile = false;
try {
  const stdoutStat = fs.fstatSync(1);
  const fileStat = fs.statSync(LOG_FILE);
  if (stdoutStat.ino === fileStat.ino && stdoutStat.dev === fileStat.dev) {
    stdoutOwnsLogFile = true;
  }
} catch {
  /* LOG_FILE may not exist yet, or stdout not a file — fine */
}

if (stdoutOwnsLogFile) {
  const noop = (
    _chunk: string | Uint8Array,
    cbOrEnc?: unknown,
    cb?: unknown,
  ): boolean => {
    // Resolve callback like the real write() so any awaited drains keep working.
    const callback = typeof cbOrEnc === 'function' ? cbOrEnc : cb;
    if (typeof callback === 'function') (callback as () => void)();
    return true;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (process.stdout.write as any) = noop;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (process.stderr.write as any) = noop;
}

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const COLORS: Record<LogLevel, string> = {
  debug: '\x1b[90m', // gray
  info: '\x1b[36m', // cyan
  warn: '\x1b[33m', // yellow
  error: '\x1b[31m', // red
};

const RESET = '\x1b[0m';

// Patterns that indicate secrets — redacted before logging
const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9\-_]{20,}/g, // Anthropic / Stripe API keys
  /pk-[A-Za-z0-9\-_]{20,}/g, // Public keys
  /Bearer\s+[A-Za-z0-9\-_.~+/]{20,}/g, // Bearer tokens
  /ntn_[A-Za-z0-9]{20,}/g, // Notion tokens
  /xoxb-[A-Za-z0-9\-]{20,}/g, // Slack bot tokens
  /ghp_[A-Za-z0-9]{20,}/g, // GitHub PATs
  /gho_[A-Za-z0-9]{20,}/g, // GitHub OAuth tokens
  /eyJ[A-Za-z0-9\-_]{30,}\.[A-Za-z0-9\-_]{30,}/g, // JWTs
];

function sanitizeLogData(data: unknown): unknown {
  if (typeof data === 'string') {
    let sanitized = data;
    for (const pattern of SECRET_PATTERNS) {
      sanitized = sanitized.replace(pattern, (match) => match.slice(0, 6) + '…[REDACTED]');
    }
    return sanitized;
  }
  if (typeof data === 'object' && data !== null) {
    return JSON.parse(
      JSON.stringify(data, (_key, value) => {
        if (typeof value !== 'string') return value;
        let sanitized = value;
        for (const pattern of SECRET_PATTERNS) {
          sanitized = sanitized.replace(pattern, (match) => match.slice(0, 6) + '…[REDACTED]');
        }
        return sanitized;
      }),
    );
  }
  return data;
}

// Default to 'info' so tool-call arguments (passed as the second arg to
// log.debug in sources/*) are NOT written to the log file. Operators who
// need fine-grained traces in dev can opt-in with LOG_LEVEL=debug.
let currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
let auditCallback: ((level: LogLevel, module: string, msg: string, data?: unknown) => void) | null =
  null;

export function setLogLevel(level: LogLevel) {
  currentLevel = level;
}

export function setAuditCallback(cb: typeof auditCallback) {
  auditCallback = cb;
}

function log(level: LogLevel, module: string, msg: string, data?: unknown) {
  if (LEVELS[level] < LEVELS[currentLevel]) return;

  const ts = new Date().toISOString();
  const color = COLORS[level];
  const prefix = `${color}[${level.toUpperCase().padEnd(5)}]${RESET} ${ts} [${module}]`;

  let line: string;
  if (data !== undefined) {
    const safe = sanitizeLogData(data);
    const tail = typeof safe === 'object' ? JSON.stringify(safe, null, 2) : String(safe);
    line = `${prefix} ${msg} ${tail}`;
  } else {
    line = `${prefix} ${msg}`;
  }
  console.log(line); // eslint-disable-line no-console
  writeToLogFile(line);

  auditCallback?.(level, module, msg, data);
}

export function createLogger(module: string) {
  return {
    debug: (msg: string, data?: unknown) => log('debug', module, msg, data),
    info: (msg: string, data?: unknown) => log('info', module, msg, data),
    warn: (msg: string, data?: unknown) => log('warn', module, msg, data),
    error: (msg: string, data?: unknown) => log('error', module, msg, data),
  };
}

export type Logger = ReturnType<typeof createLogger>;
