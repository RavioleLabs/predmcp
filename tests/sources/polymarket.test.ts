import { describe, it, expect } from 'vitest';
import { fetchMarkets, fetchOdds } from '../../src/sources/polymarket.js';

describe('polymarket source integration', () => {
  it('fetchMarkets returns live active markets sorted by volume', async () => {
    const markets = await fetchMarkets({ limit: 5, active: true });
    expect(markets).toBeInstanceOf(Array);
    expect(markets.length).toBeGreaterThan(0);
    expect(markets.length).toBeLessThanOrEqual(5);

    const m = markets[0];
    expect(m).toHaveProperty('condition_id');
    expect(m).toHaveProperty('question');
    expect(m.tokens).toBeInstanceOf(Array);
    expect(m.tokens.length).toBeGreaterThan(0);
    expect(typeof m.volume).toBe('number');
    expect(m.volume).toBeGreaterThan(0);
    // Sorted by volume descending
    if (markets.length > 1) {
      expect(markets[0].volume).toBeGreaterThanOrEqual(markets[1].volume);
    }
  }, 10000);

  it('fetchOdds returns prices for valid token IDs', async () => {
    const markets = await fetchMarkets({ limit: 1 });
    expect(markets.length).toBeGreaterThan(0);
    const tokenId = markets[0].tokens[0].token_id;
    const odds = await fetchOdds([tokenId]);
    expect(odds).toHaveProperty(tokenId);
    expect(typeof odds[tokenId]).toBe('number');
  }, 10000);
});
