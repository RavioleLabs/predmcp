import { describe, it, expect, vi } from 'vitest';

vi.mock('@nktkas/hyperliquid', () => {
  const mockClient = {
    metaAndAssetCtxs: vi.fn().mockResolvedValue([
      { universe: [{ name: 'BTC' }, { name: 'ETH' }] },
      [
        { funding: '0.0001', openInterest: '12500000', markPx: '94000' },
        { funding: '-0.00005', openInterest: '4200000', markPx: '3100' },
      ],
    ]),
    recentTrades: vi.fn().mockResolvedValue([
      { sz: '5.5', px: '94000', side: 'B', time: Date.now() },
      { sz: '0.01', px: '94000', side: 'A', time: Date.now() },
    ]),
  };
  return {
    HttpTransport: vi.fn().mockReturnValue({}),
    InfoClient: vi.fn().mockReturnValue(mockClient),
  };
});

import { fetchFundingRates, fetchOpenInterest, fetchWhaleTrades } from '../../src/sources/hyperliquid.js';

describe('hyperliquid source', () => {
  it('fetchFundingRates returns rates for all coins', async () => {
    const rates = await fetchFundingRates();
    expect(rates).toHaveLength(2);
    expect(rates[0].coin).toBe('BTC');
    expect(rates[0].funding_rate).toBe('0.0001');
  });

  it('fetchFundingRates filters by coin list', async () => {
    const rates = await fetchFundingRates(['BTC']);
    expect(rates).toHaveLength(1);
    expect(rates[0].coin).toBe('BTC');
  });

  it('fetchOpenInterest returns OI per coin', async () => {
    const oi = await fetchOpenInterest();
    expect(oi[0].coin).toBe('BTC');
    expect(oi[0].open_interest).toBe('12500000');
  });

  it('fetchWhaleTrades filters by min notional', async () => {
    // 5.5 * 94000 = 517000 > 100000 → included
    // 0.01 * 94000 = 940 < 100000 → excluded
    const trades = await fetchWhaleTrades('BTC', 100000);
    expect(trades).toHaveLength(1);
    expect(trades[0].sz).toBe('5.5');
  });
});
