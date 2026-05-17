// src/tools/get-whale-positions.ts
import { z } from 'zod';
import { TTLCache } from '../core/cache/index.js';
import { fetchWhalePositions } from '../sources/polymarket.js';

const cache = new TTLCache<unknown>(300_000);

export const getWhalePositionsSchema = {
  condition_id: z.string().describe('Polymarket condition ID'),
  min_size_usdc: z.number().optional().default(1000),
};

export type GetWhalePositionsInput = { condition_id: string; min_size_usdc: number };

export async function getWhalePositionsHandler(input: GetWhalePositionsInput) {
  const { condition_id, min_size_usdc } = input;
  const positions = await cache.getOrFetch(
    `pm:whales:${condition_id}:${min_size_usdc}`,
    () => fetchWhalePositions(condition_id, min_size_usdc)
  );
  return { content: [{ type: 'text' as const, text: JSON.stringify({ condition_id, positions }) }] };
}
