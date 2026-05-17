// src/tools/search-markets.ts
import { z } from 'zod';
import { TTLCache } from '../core/cache/index.js';
import { fetchMarkets, type PolymarketMarket } from '../sources/polymarket.js';
import { fetchHip4Markets, type Hip4Market } from '../sources/hip4.js';

const cache = new TTLCache<unknown>(300_000);

export const searchMarketsSchema = {
  query: z.string().describe('Keywords to search in market names and descriptions'),
  limit: z.number().int().min(1).max(50).optional().default(10),
};

export type SearchMarketsInput = { query: string; limit: number };

function matchesQuery(text: string, terms: string[]): boolean {
  const lower = text.toLowerCase();
  return terms.some(term => lower.includes(term.toLowerCase()));
}

export async function searchMarketsHandler(input: SearchMarketsInput) {
  const { query, limit } = input;
  const terms = query.split(/\s+/).filter(Boolean);

  const [pmMarkets, hip4Markets] = await Promise.all([
    cache.getOrFetch('search:pm', () => fetchMarkets({ limit: 200, active: true })) as Promise<PolymarketMarket[]>,
    cache.getOrFetch('search:hip4', () => fetchHip4Markets()) as Promise<Hip4Market[]>,
  ]);

  const pmResults = pmMarkets
    .filter(m => matchesQuery(m.question, terms) || matchesQuery(m.description ?? '', terms))
    .map(m => ({ source: 'polymarket', ...m }));

  const hip4Results = hip4Markets
    .filter(m => matchesQuery(m.base, terms) || matchesQuery(m.description ?? '', terms))
    .map(m => ({ source: 'hip4', ...m }));

  const results = [...pmResults, ...hip4Results].slice(0, limit);
  return { content: [{ type: 'text' as const, text: JSON.stringify({ query, results }) }] };
}
