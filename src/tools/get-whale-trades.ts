// src/tools/get-whale-trades.ts
import { z } from 'zod';
import { TTLCache } from '../core/cache/index.js';
import { fetchWhaleTrades } from '../sources/hyperliquid.js';

const cache = new TTLCache<unknown>(120_000);

export const getWhaleTradesSchema = {
  coin: z.string().describe('e.g. BTC'),
  min_notional_usdc: z.number().optional().default(50000),
};

export type GetWhaleTradesInput = { coin: string; min_notional_usdc: number };

export async function getWhaleTradesHandler(input: GetWhaleTradesInput) {
  const { coin, min_notional_usdc } = input;
  const key = `hl:whale:${coin}:${min_notional_usdc}`;
  const trades = await cache.getOrFetch(key, () => fetchWhaleTrades(coin, min_notional_usdc));
  return { content: [{ type: 'text' as const, text: JSON.stringify({ coin, trades }) }] };
}
