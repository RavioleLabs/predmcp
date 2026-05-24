import { z } from 'zod';
import { TTLCache } from '../core/cache/index.js';
import { fetchTopFundingRates } from '../sources/hyperliquid.js';

const cache = new TTLCache<unknown>(30_000);

export const getTopFundingRatesSchema = {
  limit: z.number().int().min(1).max(50).optional().default(10).describe('Number of top results to return (default: 10)'),
  min_abs_rate: z.number().optional().default(0).describe('Minimum absolute funding rate to include, e.g. 0.0001. Omit to include all.'),
};

export async function getTopFundingRatesHandler(input: { limit: number; min_abs_rate: number }) {
  const { limit, min_abs_rate } = input;
  const rates = await cache.getOrFetch(`top_funding:${limit}:${min_abs_rate}`, () => fetchTopFundingRates(limit, min_abs_rate)) as Awaited<ReturnType<typeof fetchTopFundingRates>>;
  const annotated = rates.map(r => ({
    ...r,
    funding_rate_pct: (parseFloat(r.funding_rate) * 100).toFixed(5) + '%',
    annualized_pct: (parseFloat(r.funding_rate) * 3 * 365 * 100).toFixed(1) + '%',
    oi_usd: Math.round(parseFloat(r.open_interest) * parseFloat(r.mark_px)),
    direction: parseFloat(r.funding_rate) > 0 ? 'longs_pay_shorts' : 'shorts_pay_longs',
  }));
  return { content: [{ type: 'text' as const, text: JSON.stringify({ count: annotated.length, rates: annotated }) }] };
}
