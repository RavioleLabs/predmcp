// src/tools/get-funding-momentum.ts
//
// Simple version of the funding curve: current funding vs 24h average for one
// asset. The Pro version (get_funding_curve_anomaly) adds 7d baseline + term
// structure + anomaly classification.

import { z } from 'zod';
import { TTLCache } from '../core/cache/index.js';
import { fetchFundingRates, fetchFundingHistory } from '../sources/hyperliquid.js';

const cache = new TTLCache<unknown>(60_000);

export const getFundingMomentumSchema = {
  asset: z.string().describe('Asset ticker, e.g. "BTC", "ETH", "HYPE"'),
};

export async function getFundingMomentumHandler(input: { asset: string }) {
  const { asset } = input;
  const data = await cache.getOrFetch(`fm:${asset}`, async () => {
    const now = Date.now();
    const start24h = now - 24 * 3_600_000;
    const [rates, history] = await Promise.all([
      fetchFundingRates([asset]),
      fetchFundingHistory(asset, start24h, now).catch(() => []),
    ]);
    if (!rates.length) return { asset, error: 'asset not found on Hyperliquid' };
    const current = parseFloat(rates[0].funding_rate);
    const avg24h = history.length ? history.reduce((s, h) => s + h.fundingRate, 0) / history.length : 0;
    const ratio = avg24h !== 0 ? current / avg24h : 0;
    return {
      asset,
      current_funding: Math.round(current * 1e8) / 1e8,
      avg_24h: Math.round(avg24h * 1e8) / 1e8,
      ratio_current_vs_24h: Math.round(ratio * 100) / 100,
      direction: current > 0 ? 'longs_pay' : current < 0 ? 'shorts_pay' : 'neutral',
      annualized_current_pct: Math.round(current * 365 * 3 * 100 * 10000) / 10000,
      samples_24h: history.length,
    };
  });
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
}
