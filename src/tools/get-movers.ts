import { z } from 'zod';
import { TTLCache } from '../core/cache/index.js';
import { fetchMovers } from '../sources/polymarket.js';

const cache = new TTLCache<unknown>(120_000);

export const getMoversSchema = {
  limit: z.number().int().min(1).max(20).optional().default(10),
};

export type GetMoversInput = { limit: number };

export async function getMoversHandler(input: GetMoversInput) {
  const { limit } = input;
  const movers = await cache.getOrFetch(`pm:movers:${limit}`, () => fetchMovers({ limit }));
  return { content: [{ type: 'text' as const, text: JSON.stringify(movers) }] };
}
