// src/tools/get-recent-news.ts
//
// Recent headlines about an asset from public crypto RSS feeds. No price
// correlation — the Pro version (get_news_correlation) pairs each headline
// with the observed 1h price move that followed.

import { z } from 'zod';
import { TTLCache } from '../core/cache/index.js';
import { fetchNewsForAsset } from '../sources/rss-news.js';

const cache = new TTLCache<unknown>(5 * 60_000);

export const getRecentNewsSchema = {
  asset: z.string().describe('Asset ticker to filter on, e.g. "BTC", "ETH", "HYPE"'),
  hours_back: z.number().int().min(1).max(168).optional().default(24).describe('Lookback window in hours (default: 24, max: 168 = 7 days)'),
  limit: z.number().int().min(1).max(30).optional().default(10).describe('Max headlines returned (default: 10)'),
};

export async function getRecentNewsHandler(input: { asset: string; hours_back: number; limit: number }) {
  const { asset, hours_back, limit } = input;
  const items = await cache.getOrFetch(`recent-news:${asset}:${hours_back}`, () => fetchNewsForAsset(asset, hours_back));
  const list = (items as Awaited<ReturnType<typeof fetchNewsForAsset>>).slice(0, limit);
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({
      asset,
      hours_back,
      count: list.length,
      items: list,
      sources_consulted: ['CoinDesk', 'TheBlock', 'Decrypt', 'Cointelegraph'],
    }) }],
  };
}
