// src/tools/get-basic-macro.ts
//
// Simple macro snapshot from free Yahoo Finance JSON. Pro version
// (get_macro_context) adds CoinGecko dominance/total mcap + a regime classifier.

import { TTLCache } from '../core/cache/index.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('tool:basic-macro');
const cache = new TTLCache<unknown>(5 * 60_000);

const YF_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

async function yfQuote(symbol: string): Promise<{ price: number | null; change_pct: number | null }> {
  try {
    const res = await fetch(`${YF_BASE}/${encodeURIComponent(symbol)}?interval=1d&range=5d`, {
      signal: AbortSignal.timeout(7000),
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) return { price: null, change_pct: null };
    const data = (await res.json()) as any;
    const result = data?.chart?.result?.[0];
    const closes: number[] = result?.indicators?.quote?.[0]?.close ?? [];
    const valid = closes.filter((c) => Number.isFinite(c)) as number[];
    if (valid.length < 2) return { price: null, change_pct: null };
    const last = valid[valid.length - 1];
    const prev = valid[valid.length - 2];
    return {
      price: Math.round(last * 1e4) / 1e4,
      change_pct: prev > 0 ? Math.round(((last - prev) / prev) * 10000) / 100 : null,
    };
  } catch {
    log.debug('yfQuote failed');
    return { price: null, change_pct: null };
  }
}

export const getBasicMacroSchema = {};

export async function getBasicMacroHandler(_input: Record<string, never>) {
  const data = await cache.getOrFetch('basic-macro', async () => {
    const [dxy, us10y, spx, vix, gold] = await Promise.all([
      yfQuote('DX-Y.NYB'),
      yfQuote('^TNX'),
      yfQuote('^GSPC'),
      yfQuote('^VIX'),
      yfQuote('GC=F'),
    ]);
    return {
      dxy,
      us10y_yield_pct: us10y,
      spx,
      vix,
      gold_usd: gold,
      source: 'yahoo_finance_public',
    };
  });
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
}
