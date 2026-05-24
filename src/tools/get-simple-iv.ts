// src/tools/get-simple-iv.ts
//
// Simple options IV snapshot from free Deribit public API. Pro version
// (get_options_iv) adds put-call skew + full term structure breakdown.

import { z } from 'zod';
import { TTLCache } from '../core/cache/index.js';
import { fetchOptionsSummary } from '../sources/deribit.js';

const cache = new TTLCache<unknown>(2 * 60_000);

export const getSimpleIvSchema = {
  asset: z.enum(['BTC', 'ETH']).describe('Underlying — Deribit free feed supports BTC and ETH.'),
};

export async function getSimpleIvHandler(input: { asset: 'BTC' | 'ETH' }) {
  const { asset } = input;
  const summary = await cache.getOrFetch(`simple-iv:${asset}`, () => fetchOptionsSummary(asset));
  const s = summary as Awaited<ReturnType<typeof fetchOptionsSummary>>;
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({
      asset: s.asset,
      spot_price: s.spot_price,
      atm_iv_pct: s.atm_iv_pct,
      oi_total: s.oi_total,
      volume_24h_total: s.volume_24h_total,
      source: s.source,
    }) }],
  };
}
