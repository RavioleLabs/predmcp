// src/core/billing/stripe.ts
//
// Minimal Stripe billing: Checkout sessions + webhook signature verification.
// No SDK — uses fetch directly to keep the dependency surface small and the
// code auditable (~170 lines).
//
// Stripe docs:
//   - Checkout sessions:  https://docs.stripe.com/api/checkout/sessions/create
//   - Webhook signatures: https://docs.stripe.com/webhooks/signatures

import { createHmac, timingSafeEqual } from 'crypto';
import { createLogger } from '../logger.js';

const log = createLogger('billing:stripe');

const STRIPE_API = 'https://api.stripe.com/v1';

const _secretKey = process.env.STRIPE_SECRET_KEY;
const _webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const _priceId = process.env.STRIPE_PRICE_ID;

export function isStripeConfigured(): boolean {
  return Boolean(_secretKey && _webhookSecret && _priceId);
}

function requireConfig(): { secretKey: string; webhookSecret: string; priceId: string } {
  if (!_secretKey || !_webhookSecret || !_priceId) {
    throw new Error(
      'Stripe not configured. Set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID.',
    );
  }
  return { secretKey: _secretKey, webhookSecret: _webhookSecret, priceId: _priceId };
}

// ─── Checkout ────────────────────────────────────────────────────────────────

export interface CheckoutResult {
  url: string;
  checkoutId: string;
}

/**
 * Create a Stripe Checkout Session for a subscription tied to an email.
 * `metadata.apiKey` is attached so the webhook can look up the local key on
 * checkout.session.completed.
 */
export async function createCheckout(opts: {
  email: string;
  apiKey: string;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<CheckoutResult> {
  const { secretKey, priceId } = requireConfig();

  // Stripe expects application/x-www-form-urlencoded — flatten the body.
  // 7-day free trial: card collected at signup, first charge after 7 days.
  const params = new URLSearchParams({
    mode: 'subscription',
    customer_email: opts.email,
    success_url: opts.successUrl ?? 'https://predmcp.com/upgrade/success?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: opts.cancelUrl ?? 'https://predmcp.com/upgrade/cancel',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    'metadata[apiKey]': opts.apiKey,
    'subscription_data[metadata][apiKey]': opts.apiKey,
    'subscription_data[trial_period_days]': '7',
  });

  const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    log.error('Stripe checkout creation failed', { status: res.status });
    throw new Error(`Stripe checkout failed: ${res.status} ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as { id: string; url: string };
  return { url: data.url, checkoutId: data.id };
}

// ─── Webhook verification ────────────────────────────────────────────────────

/**
 * Verify a Stripe webhook signature. Header format:
 *   stripe-signature: t=<timestamp>,v1=<hex-hmac>,v1=<hex-hmac>
 *
 * Signed content: `${timestamp}.${rawBody}`. HMAC-SHA-256 with the webhook
 * signing secret. Constant-time compare.
 *
 * Also enforces a 5-minute timestamp tolerance to prevent replay attacks.
 */
export function verifyWebhookSignature(opts: {
  rawBody: string;
  signatureHeader: string | undefined;
  toleranceSeconds?: number;
}): boolean {
  const { webhookSecret } = requireConfig();
  const { rawBody, signatureHeader } = opts;
  const tolerance = opts.toleranceSeconds ?? 300;
  if (!signatureHeader) return false;

  // Parse the header
  const entries = Object.fromEntries(
    signatureHeader.split(',').map((kv) => {
      const idx = kv.indexOf('=');
      return idx < 0 ? [kv, ''] : [kv.slice(0, idx), kv.slice(idx + 1)];
    }),
  );

  const timestamp = entries.t;
  if (!timestamp) return false;

  // Replay protection
  const tsSec = parseInt(timestamp, 10);
  if (!Number.isFinite(tsSec) || Math.abs(Date.now() / 1000 - tsSec) > tolerance) {
    log.warn('Webhook timestamp outside tolerance', { tsSec });
    return false;
  }

  const signedContent = `${timestamp}.${rawBody}`;
  const expected = createHmac('sha256', webhookSecret).update(signedContent).digest('hex');

  // Compare against every v1 signature in the header (Stripe sends multiple during key rotation)
  for (const [k, sig] of Object.entries(entries)) {
    if (k !== 'v1') continue;
    try {
      const a = Buffer.from(sig, 'hex');
      const b = Buffer.from(expected, 'hex');
      if (a.length === b.length && timingSafeEqual(a, b)) return true;
    } catch {
      /* malformed entry — skip */
    }
  }
  return false;
}

// ─── Event types we care about ───────────────────────────────────────────────

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: {
      id: string;
      status?: string;
      customer?: string;
      customer_email?: string;
      subscription?: string;
      metadata?: Record<string, string>;
    };
  };
}

/**
 * Returns the apiKey from event metadata (preferred), falling back to
 * subscription metadata if it's a subscription event.
 */
export function extractApiKeyFromEvent(event: StripeWebhookEvent): string | undefined {
  return event.data.object.metadata?.apiKey;
}

export function isActivationEvent(event: StripeWebhookEvent): boolean {
  // checkout.session.completed for the initial purchase
  // customer.subscription.updated where status is active/trialing for ongoing
  if (event.type === 'checkout.session.completed') return true;
  if (event.type === 'customer.subscription.updated') {
    const s = event.data.object.status?.toLowerCase();
    return s === 'active' || s === 'trialing';
  }
  return false;
}

export function isCancellationEvent(event: StripeWebhookEvent): boolean {
  if (event.type === 'customer.subscription.deleted') return true;
  if (event.type === 'customer.subscription.updated') {
    const s = event.data.object.status?.toLowerCase();
    return s === 'canceled' || s === 'past_due' || s === 'unpaid' || s === 'incomplete_expired';
  }
  return false;
}
