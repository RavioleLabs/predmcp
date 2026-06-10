// src/tools/get-oi-history.ts
//
// Open-interest time series from our own 5-min snapshots. Hyperliquid's API
// has NO OI-history endpoint — this data exists only because the server
// records it continuously. Free tier: 24h window. Pro: get_oi_divergence
// adds price-vs-OI regime classification over longer windows.

import { z } from 'zod';
import { querySnapshots } from '../core/server/market-store.js';

export const getOiHistorySchema = {
  coin: z.string().describe('Coin, e.g. "BTC" (top ~30 by OI are tracked)'),
  hours: z.number().int().min(1).max(24).optional().default(24).describe('Lookback window in hours (free tier max: 24)'),
};

export async function getOiHistoryHandler(input: { coin: string; hours: number }) {
  const since = Date.now() - input.hours * 3_600_000;
  const rows = querySnapshots(input.coin, since);

  // Downsample to at most ~100 points so the payload stays LLM-friendly
  const step = Math.max(1, Math.floor(rows.length / 100));
  const series = rows.filter((_, i) => i % step === 0).map((r) => ({
    ts: new Date(r.ts).toISOString(),
    oi: r.oi,
    oi_usd: Math.round(r.oi * r.mark_px),
    mark_px: r.mark_px,
    funding: r.funding,
  }));

  const first = rows[0];
  const last = rows[rows.length - 1];
  const summary = first && last && first.oi > 0
    ? {
        oi_change_pct: Math.round(((last.oi - first.oi) / first.oi) * 10000) / 100,
        price_change_pct: first.mark_px > 0 ? Math.round(((last.mark_px - first.mark_px) / first.mark_px) * 10000) / 100 : null,
      }
    : null;

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        coin: input.coin.toUpperCase(),
        hours: input.hours,
        points: series.length,
        summary,
        series,
        note: rows.length === 0
          ? 'No snapshots yet for this coin — we track the top ~30 coins by OI, sampled every 5 minutes. Data accumulates from server uptime; this dataset does not exist in any public API.'
          : 'Sampled every 5 min from our continuous collector. Hyperliquid has no OI-history endpoint — this series is unique to predmcp.',
      }),
    }],
  };
}
