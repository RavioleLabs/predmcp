import { describe, it, expect } from 'vitest';
import { getMoversHandler } from '../../src/tools/get-movers.js';

describe('get_movers integration', () => {
  it('returns volume_movers and price_movers with correct shape', async () => {
    const result = await getMoversHandler({ limit: 5 });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.volume_movers).toBeInstanceOf(Array);
    expect(parsed.price_movers).toBeInstanceOf(Array);

    const m = parsed.volume_movers[0];
    expect(m).toHaveProperty('condition_id');
    expect(m).toHaveProperty('question');
    expect(m).toHaveProperty('volume_24h');
    expect(typeof m.volume_24h).toBe('number');
    expect(m.volume_24h).toBeGreaterThan(0);

    const pm = parsed.price_movers[0];
    expect(pm).toHaveProperty('price_change_24h');
    expect(typeof pm.price_change_24h).toBe('number');
    expect(Math.abs(pm.price_change_24h)).toBeGreaterThan(0);
  }, 10000);
});
