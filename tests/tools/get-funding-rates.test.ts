// tests/tools/get-funding-rates.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/sources/hyperliquid.js', () => ({
  fetchFundingRates: vi.fn().mockResolvedValue([
    { coin: 'BTC', funding_rate: '0.0001', open_interest: '12500000', mark_px: '94000' },
    { coin: 'ETH', funding_rate: '-0.00005', open_interest: '4200000', mark_px: '3100' },
  ]),
}));
vi.mock('../../src/cache/index.js', () => ({
  TTLCache: vi.fn().mockImplementation(() => ({
    getOrFetch: vi.fn((_k: string, fn: () => Promise<unknown>) => fn()),
  })),
}));

import { getFundingRatesHandler } from '../../src/tools/get-funding-rates.js';

describe('get_funding_rates tool', () => {
  it('returns all funding rates without filter', async () => {
    const result = await getFundingRatesHandler({ coins: undefined });
    const data = JSON.parse(result.content[0].text);
    expect(data.rates).toHaveLength(2);
    expect(data.rates[0].coin).toBe('BTC');
  });

  it('passes coin filter to source', async () => {
    const result = await getFundingRatesHandler({ coins: ['BTC'] });
    const data = JSON.parse(result.content[0].text);
    expect(data.rates).toBeDefined();
  });
});
