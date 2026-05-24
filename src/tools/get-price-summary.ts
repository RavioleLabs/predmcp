// src/tools/get-price-summary.ts
//
// Single-asset price snapshot from HL candles:
// - current mark
// - 24h / 7d returns
// - 30d high and low
// - distance from 30d high (% drawdown)
// - distance from 30d low (% rally from bottom)
// - simple realised volatility (annualized) from 7d hourly returns
//
// Useful as a one-call orientation for an agent before deeper analysis.

import { z } from 'zod';
import { TTLCache } from '../core/cache/index.js';
import { fetchFundingRates, fetchCandles } from '../sources/hyperliquid.js';

const cache = new TTLCache<unknown>(30_000);

export const getPriceSummarySchema = {
  asset: z.string().describe('Asset ticker, e.g. "BTC", "HYPE"'),
};

export async function getPriceSummaryHandler(input: { asset: string }) {
  const { asset } = input;
  const data = await cache.getOrFetch(`ps:${asset}`, async () => {
    const now = Date.now();
    const start = now - 30 * 86_400_000;
    const [rates, candles] = await Promise.all([
      fetchFundingRates([asset]),
      fetchCandles(asset, '1h', start, now).catch(() => []),
    ]);
    if (!rates.length) return { asset, error: 'asset not found on Hyperliquid' };
    const mark = parseFloat(rates[0].mark_px);
    if (!candles.length) {
      return { asset, mark_px: mark, error: 'no candle history available' };
    }
    const closes = candles.map((c) => c.c);
    const highs = candles.map((c) => c.h);
    const lows = candles.map((c) => c.l);

    const last = closes[closes.length - 1];
    const ago1d = closes.length >= 24 ? closes[closes.length - 24] : closes[0];
    const ago7d = closes.length >= 24 * 7 ? closes[closes.length - 24 * 7] : closes[0];

    const ret24h = (last - ago1d) / ago1d;
    const ret7d = (last - ago7d) / ago7d;

    const high30d = Math.max(...highs);
    const low30d = Math.min(...lows);
    const drawdownFromHigh = (mark - high30d) / high30d;
    const rallyFromLow = (mark - low30d) / low30d;

    // Annualised vol from last 7d of hourly returns
    const rets = closes.slice(-24 * 7).slice(1).map((c, i) => (c - closes[closes.length - 24 * 7 + i]) / closes[closes.length - 24 * 7 + i]);
    const mean = rets.length ? rets.reduce((s, r) => s + r, 0) / rets.length : 0;
    const vol1h = rets.length ? Math.sqrt(rets.reduce((s, r) => s + (r - mean) ** 2, 0) / Math.max(rets.length - 1, 1)) : 0;
    const annVolPct = vol1h * Math.sqrt(24 * 365) * 100;

    return {
      asset,
      mark_px: mark,
      change_24h_pct: Math.round(ret24h * 10000) / 100,
      change_7d_pct: Math.round(ret7d * 10000) / 100,
      high_30d: high30d,
      low_30d: low30d,
      drawdown_from_30d_high_pct: Math.round(drawdownFromHigh * 10000) / 100,
      rally_from_30d_low_pct: Math.round(rallyFromLow * 10000) / 100,
      annualized_vol_pct: Math.round(annVolPct),
      candle_count: candles.length,
    };
  });
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
}
