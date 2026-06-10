import { describe, it, expect } from 'vitest';
import { getMarketContextHandler } from '../../src/tools/private/get-market-context.js';

describe('get_market_context integration', () => {
  it('returns polymarket and hip4 arrays for a geopolitical query', async () => {
    const result = await getMarketContextHandler({ query: 'Iran' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.query).toBe('Iran');
    expect(parsed.polymarket).toBeInstanceOf(Array);
    expect(parsed.hip4).toBeInstanceOf(Array);
    expect(parsed.perp).toBeNull(); // Iran is not a known coin
    // At least one Polymarket result about Iran
    expect(parsed.polymarket.length).toBeGreaterThan(0);
    expect(parsed.polymarket[0]).toHaveProperty('question');
    expect(parsed.polymarket[0]).toHaveProperty('volume');
  }, 10000);

  it('includes perp data when query matches a known coin', async () => {
    const result = await getMarketContextHandler({ query: 'BTC' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.perp).not.toBeNull();
    expect(parsed.perp.mark_px).toBeTruthy();
    expect(parsed.recent_whale_trades).toBeInstanceOf(Array);
  }, 10000);
});
