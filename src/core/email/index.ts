// src/core/email/index.ts
//
// Minimal transactional email sender. Uses Resend (https://resend.com) when
// RESEND_API_KEY is set; otherwise logs the message to the server log so
// developers can read the OTP during local testing.
//
// Resend free tier: 100 emails/day, 3000/month, single sender domain.

import { createLogger } from '../logger.js';

const log = createLogger('email');

const _resendKey = process.env.RESEND_API_KEY;
const _from = process.env.EMAIL_FROM ?? 'PredMCP <noreply@predmcp.com>';

export interface SendOpts {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(opts: SendOpts): Promise<{ ok: boolean; provider: 'resend' | 'console' }> {
  // Fallback: when no API key configured, log to server so we can develop without sending.
  if (!_resendKey) {
    log.info('email (console-fallback)', { to: opts.to, subject: opts.subject, body: opts.text });
    return { ok: true, provider: 'console' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${_resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: _from,
        to: [opts.to],
        subject: opts.subject,
        text: opts.text,
        html: opts.html ?? undefined,
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      log.error('Resend send failed', { status: res.status, body: txt.slice(0, 200) });
      return { ok: false, provider: 'resend' };
    }
    return { ok: true, provider: 'resend' };
  } catch (err) {
    log.error('Resend error', { err: String(err) });
    return { ok: false, provider: 'resend' };
  }
}

export function buildOtpEmail(code: string): { subject: string; text: string; html: string } {
  return {
    subject: `PredMCP — your one-time code: ${code}`,
    text: `Your PredMCP one-time code is: ${code}\n\nIt expires in 10 minutes. If you did not request this, ignore the email.`,
    html: `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0a0a0f;color:#e2e2f0;padding:2rem">
<div style="max-width:480px;margin:0 auto;background:#111118;border:1px solid #1e1e2e;border-radius:12px;padding:2rem">
<h1 style="font-size:1.2rem;margin:0 0 1rem">PredMCP — sign-in code</h1>
<p style="color:#6b6b8a;font-size:0.95rem;line-height:1.6">Enter this code on predmcp.com to access your account:</p>
<div style="font-family:monospace;font-size:2rem;font-weight:700;color:#7c5cfc;letter-spacing:0.3em;text-align:center;padding:1rem;background:#0a0a0f;border-radius:8px;margin:1.5rem 0">${code}</div>
<p style="color:#6b6b8a;font-size:0.85rem">This code expires in 10 minutes. If you did not request it, ignore this email.</p>
</div></body></html>`,
  };
}
