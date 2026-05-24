// src/core/server/trade-buffer.ts
//
// Per-coin rolling buffer of recent trades. Hyperliquid's `recentTrades`
// endpoint only returns the last ~10 trades per call, so a single tool
// invocation almost never sees a whale on a high-volume coin. The buffer
// is fed by the signal-poller (every 10s) and queried by get_whale_trades.
//
// Memory: ~1000 trades × 30 coins × ~120 bytes ≈ 4 MB worst case.

export interface BufferedTrade {
  time: number;          // ms epoch (from HL)
  px: number;
  sz: number;
  side: 'B' | 'A';        // B = buy, A = ask/sell (HL convention)
  notional: number;      // px * sz
}

const MAX_PER_COIN = 1000;
const MAX_AGE_MS = 60 * 60 * 1000; // 1h

class TradeBuffer {
  private buffers = new Map<string, BufferedTrade[]>();

  /**
   * Add trades for a coin. Dedupes against existing buffer by (time, px, sz, side)
   * since pollers may see overlapping windows. Drops trades older than MAX_AGE_MS.
   */
  add(coin: string, trades: BufferedTrade[]): number {
    if (trades.length === 0) return 0;
    const existing = this.buffers.get(coin) ?? [];
    const seen = new Set(existing.map(t => `${t.time}:${t.px}:${t.sz}:${t.side}`));
    let added = 0;
    for (const t of trades) {
      const key = `${t.time}:${t.px}:${t.sz}:${t.side}`;
      if (seen.has(key)) continue;
      seen.add(key);
      existing.push(t);
      added++;
    }
    // Sort by time desc, drop stale + cap
    existing.sort((a, b) => b.time - a.time);
    const cutoff = Date.now() - MAX_AGE_MS;
    const trimmed = existing.filter(t => t.time >= cutoff).slice(0, MAX_PER_COIN);
    this.buffers.set(coin, trimmed);
    return added;
  }

  /**
   * Recent trades for a coin, filtered by minimum notional and (optionally)
   * since a given time (ms epoch). Returns newest first.
   */
  recent(coin: string, opts: { minNotional?: number; sinceMs?: number; limit?: number } = {}): BufferedTrade[] {
    const buf = this.buffers.get(coin);
    if (!buf || buf.length === 0) return [];
    const minNot = opts.minNotional ?? 0;
    const since = opts.sinceMs ?? 0;
    const out: BufferedTrade[] = [];
    for (const t of buf) {
      if (t.time < since) break;     // buffer is sorted desc, can stop
      if (t.notional >= minNot) out.push(t);
      if (opts.limit && out.length >= opts.limit) break;
    }
    return out;
  }

  has(coin: string): boolean {
    const b = this.buffers.get(coin);
    return !!b && b.length > 0;
  }

  stats(): { coins: string[]; total_trades: number; per_coin: Record<string, { count: number; oldest_age_min: number }> } {
    const per_coin: Record<string, { count: number; oldest_age_min: number }> = {};
    let total = 0;
    const now = Date.now();
    for (const [coin, buf] of this.buffers) {
      const oldest = buf[buf.length - 1]?.time ?? now;
      per_coin[coin] = {
        count: buf.length,
        oldest_age_min: Math.round((now - oldest) / 60_000),
      };
      total += buf.length;
    }
    return { coins: [...this.buffers.keys()], total_trades: total, per_coin };
  }
}

export const tradeBuffer = new TradeBuffer();
