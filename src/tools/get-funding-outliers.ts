import { z } from 'zod';
import { TTLCache } from '../core/cache/index.js';
import { fetchFundingOutliers } from '../sources/hyperliquid.js';

const cache = new TTLCache<unknown>(120_000);

export const getFundingOutliersSchema = {
  days: z.number().int().min(1).max(30).optional().default(7).describe('Historical window in days to compute the baseline average (default: 7)'),
  min_deviation_factor: z.number().optional().default(2).describe('Minimum ratio of |current_rate| / |avg_rate| to qualify as outlier (default: 2x)'),
};

export async function getFundingOutliersHandler(input: { days: number; min_deviation_factor: number }) {
  const { days, min_deviation_factor } = input;
  const outliers = await cache.getOrFetch(`funding_outliers:${days}:${min_deviation_factor}`, () => fetchFundingOutliers(days, min_deviation_factor)) as Awaited<ReturnType<typeof fetchFundingOutliers>>;
  return { content: [{ type: 'text' as const, text: JSON.stringify({ count: outliers.length, outliers }) }] };
}
