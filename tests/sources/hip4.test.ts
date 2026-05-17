import { describe, it, expect } from 'vitest';
import { fetchHip4Markets, fetchHip4Odds } from '../../src/sources/hip4.js';

describe('hip4 source integration', () => {
  it('fetchHip4Markets returns live markets with correct shape', async () => {
    const markets = await fetchHip4Markets();
    expect(markets).toBeInstanceOf(Array);
    // HIP-4 may have zero markets if none are active — just verify shape
    if (markets.length > 0) {
      const m = markets[0];
      expect(m).toHaveProperty('base');
      expect(m).toHaveProperty('outcome_id');
      expect(m).toHaveProperty('yes_coin');
      expect(m).toHaveProperty('no_coin');
      expect(typeof m.yes_price).toBe('number');
      expect(typeof m.no_price).toBe('number');
      expect(m.yes_price + m.no_price).toBeCloseTo(1, 1);
    }
  }, 10000);

  it('fetchHip4Odds throws for unknown base', async () => {
    await expect(fetchHip4Odds('NOTACOIN_XXXX')).rejects.toThrow('market not found');
  }, 10000);
});
