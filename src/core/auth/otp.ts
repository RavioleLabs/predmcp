// src/core/auth/otp.ts
//
// One-time codes for email-based key recovery.
// Stored as SHA-256 hashes (never plain text). Rate-limited per email.

import { randomInt, createHash } from 'crypto';
import { getDb } from '../db/index.js';
import { createLogger } from '../logger.js';

const log = createLogger('auth:otp');

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_OTPS_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function generateCode(): string {
  // 6-digit, zero-padded
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/**
 * Create and persist a new OTP for the given email.
 * Returns the plain code (caller emails it) or null if rate-limited.
 */
export function createOtp(email: string): { code: string } | { error: 'rate_limited' } {
  const db = getDb();
  const now = Date.now();

  // Rate limit: 5 OTPs per email per hour
  const recent = (
    db
      .prepare('SELECT COUNT(*) as n FROM otp_codes WHERE email = ? AND created_at >= ?')
      .get(email, now - HOUR_MS) as { n: number }
  ).n;
  if (recent >= MAX_OTPS_PER_HOUR) {
    log.warn('OTP rate limit', { email });
    return { error: 'rate_limited' };
  }

  const code = generateCode();
  db.prepare(
    'INSERT INTO otp_codes (email, code_hash, created_at, expires_at) VALUES (?, ?, ?, ?)',
  ).run(email, hashCode(code), now, now + OTP_TTL_MS);

  return { code };
}

/**
 * Verify an OTP. On success, marks it used and returns ok=true.
 * Each code can only be verified once.
 */
export function verifyOtp(email: string, code: string): boolean {
  const db = getDb();
  const now = Date.now();
  const codeHash = hashCode(code);
  const row = db
    .prepare(
      `SELECT id FROM otp_codes
        WHERE email = ? AND code_hash = ? AND used_at IS NULL AND expires_at > ?
        ORDER BY created_at DESC LIMIT 1`,
    )
    .get(email, codeHash, now) as { id: number } | undefined;
  if (!row) return false;
  db.prepare('UPDATE otp_codes SET used_at = ? WHERE id = ?').run(now, row.id);
  log.info('OTP verified', { email });
  return true;
}

/**
 * Clean up expired OTPs. Call from a periodic job or opportunistically.
 */
export function cleanupExpiredOtps(): number {
  const db = getDb();
  const result = db.prepare('DELETE FROM otp_codes WHERE expires_at < ?').run(Date.now());
  return result.changes;
}
