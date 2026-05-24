import { z } from 'zod';
import { TTLCache } from '../core/cache/index.js';
import { fetchMarketsNearResolution } from '../sources/polymarket.js';

const cache = new TTLCache<unknown>(60_000);

export const getMarketsNearResolutionSchema = {
  hours: z.number().min(0.5).max(168).optional().default(24).describe('Maximum hours until resolution (default: 24h, max: 168h = 7 days)'),
  min_prob: z.number().min(0).max(1).optional().default(0.7).describe('Minimum leading outcome probability to include (default: 0.7 = 70%)'),
};

export async function getMarketsNearResolutionHandler(input: { hours: number; min_prob: number }) {
  const { hours, min_prob } = input;
  const markets = await cache.getOrFetch(`near_resolution:${hours}:${min_prob}`, () => fetchMarketsNearResolution(hours, min_prob)) as Awaited<ReturnType<typeof fetchMarketsNearResolution>>;
  return { content: [{ type: 'text' as const, text: JSON.stringify({ count: markets.length, markets }) }] };
}
