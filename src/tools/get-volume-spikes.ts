import { z } from 'zod';
import { TTLCache } from '../core/cache/index.js';
import { fetchVolumeSpikes } from '../sources/polymarket.js';

const cache = new TTLCache<unknown>(60_000);

export const getVolumeSpikesSchema = {
  min_ratio: z.number().min(1).optional().default(3).describe('Minimum ratio of 24h volume vs 7-day daily average to qualify as a spike (default: 3x)'),
  limit: z.number().int().min(1).max(50).optional().default(15).describe('Number of results to return (default: 15)'),
};

export async function getVolumeSpikesHandler(input: { min_ratio: number; limit: number }) {
  const { min_ratio, limit } = input;
  const spikes = await cache.getOrFetch(`vol_spikes:${min_ratio}:${limit}`, () => fetchVolumeSpikes(min_ratio, limit)) as Awaited<ReturnType<typeof fetchVolumeSpikes>>;
  return { content: [{ type: 'text' as const, text: JSON.stringify({ count: spikes.length, spikes }) }] };
}
