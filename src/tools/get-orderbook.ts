// src/tools/get-orderbook.ts
import { z } from 'zod';
import { TTLCache } from '../core/cache/index.js';
import { fetchOrderbook } from '../sources/polymarket.js';

const cache = new TTLCache<unknown>(15_000);

export const getOrderbookSchema = {
  token_id: z.string().describe('Polymarket token ID (YES or NO side)'),
};

export type GetOrderbookInput = { token_id: string };

export async function getOrderbookHandler(input: GetOrderbookInput) {
  const { token_id } = input;
  const book = await cache.getOrFetch(`pm:orderbook:${token_id}`, () => fetchOrderbook(token_id));
  return { content: [{ type: 'text' as const, text: JSON.stringify({ token_id, orderbook: book }) }] };
}
