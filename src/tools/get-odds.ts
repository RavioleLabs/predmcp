// src/tools/get-odds.ts
import { z } from 'zod';
import { TTLCache } from '../core/cache/index.js';
import { fetchOdds } from '../sources/polymarket.js';
import { fetchHip4Odds } from '../sources/hip4.js';

const cache = new TTLCache<unknown>(30_000);

export const getOddsSchema = {
  platform: z.enum(['polymarket', 'hip4']),
  identifier: z.string().describe('token_id for Polymarket, base asset (e.g. BTC) for HIP-4'),
};

export type GetOddsInput = { platform: 'polymarket' | 'hip4'; identifier: string };

export async function getOddsHandler(input: GetOddsInput) {
  const { platform, identifier } = input;
  const cacheKey = `${platform}:odds:${identifier}`;
  if (platform === 'polymarket') {
    const odds = await cache.getOrFetch(cacheKey, () => fetchOdds([identifier]));
    return { content: [{ type: 'text' as const, text: JSON.stringify({ platform, identifier, odds }) }] };
  }
  const odds = await cache.getOrFetch(cacheKey, () => fetchHip4Odds(identifier));
  return { content: [{ type: 'text' as const, text: JSON.stringify({ platform, odds }) }] };
}
