import { z } from 'zod';
import { TTLCache } from '../core/cache/index.js';
import { fetchOrderbookDepth } from '../sources/hyperliquid.js';

const cache = new TTLCache<unknown>(5_000);

export const getOrderbookDepthSchema = {
  coin: z.string().describe('Asset ticker (BTC, ETH, SOL) or HIP-4 contract name (e.g. "BTC>81041@20260512-0600")'),
  size_usdc: z.number().min(10).max(1_000_000).optional().default(200).describe('Order size in USDC to estimate slippage for (default: 200)'),
  side: z.enum(['buy', 'sell']).optional().default('buy').describe('Order side: "buy" (taker into asks) or "sell" (taker into bids)'),
};

export async function getOrderbookDepthHandler(input: { coin: string; size_usdc: number; side: 'buy' | 'sell' }) {
  const { coin, size_usdc, side } = input;
  const key = `book:${coin}:${size_usdc}:${side}`;
  const data = await cache.getOrFetch(key, () => fetchOrderbookDepth(coin, size_usdc, side));
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify(data),
    }],
  };
}
