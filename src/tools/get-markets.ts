// src/tools/get-markets.ts
import { z } from 'zod';
import { TTLCache } from '../core/cache/index.js';
import { fetchMarkets } from '../sources/polymarket.js';
import { fetchHip4Markets } from '../sources/hip4.js';

const cache = new TTLCache<unknown>(60_000);

export const getMarketsSchema = {
  platform: z.enum(['polymarket', 'hip4', 'all']).optional().default('all'),
  limit: z.number().int().min(1).max(100).optional().default(20),
  active: z.boolean().optional().default(true),
};

export type GetMarketsInput = {
  platform: 'polymarket' | 'hip4' | 'all';
  limit: number;
  active: boolean;
};

export async function getMarketsHandler(input: GetMarketsInput) {
  const { platform, limit, active } = input;

  if (platform === 'polymarket') {
    const markets = await cache.getOrFetch(
      `pm:markets:${limit}:${active}`,
      () => fetchMarkets({ limit, active })
    );
    return { content: [{ type: 'text' as const, text: JSON.stringify({ platform: 'polymarket', markets }) }] };
  }

  if (platform === 'hip4') {
    const markets = await cache.getOrFetch('hip4:markets', () => fetchHip4Markets());
    return { content: [{ type: 'text' as const, text: JSON.stringify({ platform: 'hip4', markets }) }] };
  }

  const [polymarket, hip4] = await Promise.all([
    cache.getOrFetch(`pm:markets:${limit}:${active}`, () => fetchMarkets({ limit, active })),
    cache.getOrFetch('hip4:markets', () => fetchHip4Markets()),
  ]);
  return { content: [{ type: 'text' as const, text: JSON.stringify({ polymarket, hip4 }) }] };
}
