// src/tools/get-open-interest.ts
import { z } from 'zod';
import { TTLCache } from '../core/cache/index.js';
import { fetchOpenInterest } from '../sources/hyperliquid.js';

const cache = new TTLCache<unknown>(60_000);

export const getOpenInterestSchema = {
  coins: z.array(z.string()).optional(),
};

export type GetOpenInterestInput = { coins?: string[] };

export async function getOpenInterestHandler(input: GetOpenInterestInput) {
  const { coins } = input;
  const key = `hl:oi:${coins?.join(',') ?? 'all'}`;
  const data = await cache.getOrFetch(key, () => fetchOpenInterest(coins));
  return { content: [{ type: 'text' as const, text: JSON.stringify({ open_interest: data }) }] };
}
