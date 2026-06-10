import { describe, it, expect } from 'vitest';
import { getSignalsHandler } from '../../src/tools/private/get-signals.js';

describe('get_signals integration', () => {
  it('returns structured signal for BTC with perp data', async () => {
    const result = await getSignalsHandler({ coin: 'BTC' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.coin).toBe('BTC');
    expect(parsed.perp).not.toBeNull();
    expect(parsed.perp.mark_px).toBeTruthy();
    expect(parsed.perp.funding_rate).toBeDefined();
    expect(['bullish', 'bearish', 'neutral']).toContain(parsed.perp_sentiment);
    expect(typeof parsed.divergence).toBe('boolean');
    expect(typeof parsed.signal).toBe('string');
  }, 10000);

  it('includes hip4_markets array even if empty', async () => {
    const result = await getSignalsHandler({ coin: 'BTC' });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.hip4_markets).toBeInstanceOf(Array);
  }, 10000);
});
