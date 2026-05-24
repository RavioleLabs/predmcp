// tests/tools/get-markets.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/sources/polymarket.js', () => ({
  fetchMarkets: vi.fn().mockResolvedValue([
    { condition_id: 'c1', question: 'Will X happen?', tokens: [], volume: 100, active: true },
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

import { getMarketsHandler } from '../../src/tools/get-markets.js';

describe('get_markets tool', () => {
  it('returns polymarket markets when platform=polymarket', async () => {
    const result = await getMarketsHandler({ platform: 'polymarket', limit: 10, active: true });
    const data = JSON.parse(result.content[0].text);
    expect(data.platform).toBe('polymarket');
    expect(data.markets).toHaveLength(1);
  });

  it('returns hip4 markets when platform=hip4', async () => {
    const result = await getMarketsHandler({ platform: 'hip4', limit: 10, active: true });
    const data = JSON.parse(result.content[0].text);
    expect(data.platform).toBe('hip4');
    expect(data.markets[0].base).toBe('BTC');
  });

  it('merges both when platform=all', async () => {
    const result = await getMarketsHandler({ platform: 'all', limit: 10, active: true });
    const data = JSON.parse(result.content[0].text);
    expect(data.polymarket).toBeDefined();
    expect(data.hip4).toBeDefined();
  });
});
