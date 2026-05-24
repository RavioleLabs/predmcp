// src/tools/get-funding-rates.ts
import { z } from 'zod';
import { TTLCache } from '../core/cache/index.js';
import { fetchFundingRates } from '../sources/hyperliquid.js';

const cache = new TTLCache<unknown>(30_000);

export const getFundingRatesSchema = {
  coins: z.array(z.string()).optional().describe('Coin list e.g. ["BTC","ETH"]. Omit for all.'),
};

export type GetFundingRatesInput = { coins?: string[] };

export async function getFundingRatesHandler(input: GetFundingRatesInput) {
  const { coins } = input;
  const key = `hl:funding:${coins?.join(',') ?? 'all'}`;
  const rates = await cache.getOrFetch(key, () => fetchFundingRates(coins));
  return { content: [{ type: 'text' as const, text: JSON.stringify({ rates }) }] };
}
