// tests/tools/search-markets.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/sources/polymarket.js', () => ({
  fetchMarkets: vi.fn().mockResolvedValue([
    { condition_id: 'c1', question: 'Will BTC reach 100k?', description: 'Bitcoin price', tokens: [], volume: 100, active: true },
    { condition_id: 'c2', question: 'Will ETH flip BTC?', description: 'Ethereum flippening', tokens: [], volume: 200, active: true },
  ]),
}));
vi.mock('../../src/sources/hip4.js', () => ({
  fetchHip4Markets: vi.fn().mockResolvedValue([
    { base: 'BTC', yes_market: 'BTC-YES/USDC', no_market: 'BTC-NO/USDC', yes_price: 0.63, no_price: 0.37 },
  ]),
}));
vi.mock('../../src/cache/index.js', () => ({
  TTLCache: vi.fn().mockImplementation(() => ({
    getOrFetch: vi.fn((_k: string, fn: () => Promise<unknown>) => fn()),
  })),
}));

import { searchMarketsHandler } from '../../src/tools/search-markets.js';

describe('search_markets tool', () => {
  it('matches by keyword in question', async () => {
    const result = await searchMarketsHandler({ query: 'BTC', limit: 10 });
    const data = JSON.parse(result.content[0].text);
    expect(data.results.length).toBeGreaterThan(0);
    expect(data.results.some((r: { question?: string; base?: string }) =>
      r.question?.includes('BTC') || r.base === 'BTC'
    )).toBe(true);
  });

  it('returns empty array for no match', async () => {
    const result = await searchMarketsHandler({ query: 'xyzabc_noexist', limit: 10 });
    const data = JSON.parse(result.content[0].text);
    expect(data.results).toHaveLength(0);
  });

  it('respects limit', async () => {
    const result = await searchMarketsHandler({ query: 'BTC ETH', limit: 1 });
    const data = JSON.parse(result.content[0].text);
    expect(data.results.length).toBeLessThanOrEqual(1);
  });
});
