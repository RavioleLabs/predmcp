// src/tools/get-whale-positions.ts
//
// Polymarket data-api /positions endpoint requires a `user` wallet — there is
// no public "top holders by market" endpoint anymore. This tool returns the
// positions of a specific wallet, optionally filtered to one market.
//
// Useful for: tracking known smart-money wallets, verifying counterparty in a
// HIP-4 ↔ PM arb, building watchlists.

import { z } from 'zod';
import { TTLCache } from '../core/cache/index.js';
import { fetchUserPositions } from '../sources/polymarket.js';

const cache = new TTLCache<unknown>(60_000);

export const getWhalePositionsSchema = {
  user: z.string().describe('Polygon wallet address (0x…) of the user whose positions you want.'),
  condition_id: z.string().optional().describe('Optional — filter results to a specific market by condition_id.'),
  min_size_usdc: z.number().optional().default(1000).describe('Minimum position size in USDC to include (default: 1000).'),
};

export type GetWhalePositionsInput = {
  user: string;
  condition_id?: string;
  min_size_usdc: number;
};

export async function getWhalePositionsHandler(input: GetWhalePositionsInput) {
  const { user, condition_id, min_size_usdc } = input;
  const positions = (await cache.getOrFetch(
    `pm:positions:${user}:${condition_id ?? '*'}:${min_size_usdc}`,
    () => fetchUserPositions(user, { conditionId: condition_id, minSizeUsdc: min_size_usdc }),
  )) as Awaited<ReturnType<typeof fetchUserPositions>>;
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({
          user,
          condition_id: condition_id ?? null,
          min_size_usdc,
          count: positions.length,
          positions,
        }),
      },
    ],
  };
}
