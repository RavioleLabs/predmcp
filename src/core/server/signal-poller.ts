// src/core/server/signal-poller.ts
//
// Background task that polls Hyperliquid every N seconds and emits state-change
// events on the signalBus. One poller for the whole server, fanning out to all
// SSE-subscribed clients.

import { signalBus, type SignalEvent } from './signal-bus.js';
import { fetchFundingRates, fetchPerpsAtOiCap, fetchWhaleTrades, fetchFundingHistory, fetchRecentTradesDirect } from '../../sources/hyperliquid.js';
import { tradeBuffer } from './trade-buffer.js';
import { createLogger } from '../logger.js';

const log = createLogger('signal-poller');

const POLL_INTERVAL_MS = 60_000;            // 1 minute (funding/OI)
const TRADE_POLL_INTERVAL_MS = 30_000;      // 30 seconds (trades — balance whale-tracking vs HL rate limit)
const TRADE_POLL_TOP_N = 10;                // top N coins by OI to track in buffer
const TRADE_POLL_STAGGER_MS = 200;          // delay between coin polls within a cycle
const WHALE_NOTIONAL_USDC = 100_000;        // emit whale_trade events above this
const FUNDING_Z_THRESHOLD = 3;              // emit funding_outlier_new at z >= 3
const FUNDING_BASELINE_REFRESH_MS = 30 * 60_000; // recompute 7d baseline every 30 min

let trackedCoins: string[] = []; // refreshed by main poller — used by trade poller

interface BaselineCache {
  computed_at: number;
  baselines: Map<string, number>;
}

let baseline: BaselineCache | null = null;
let lastWhaleScan: Map<string, number> = new Map(); // per-coin last seen trade time

async function refreshBaselines(coins: string[]): Promise<Map<string, number>> {
  const baselines = new Map<string, number>();
  const startMs = Date.now() - 7 * 86_400_000;
  // Sample top 20 by OI to limit API load
  const top = coins.slice(0, 20);
  for (const coin of top) {
    try {
      const history = await fetchFundingHistory(coin, startMs);
      if (history.length < 10) continue;
      const absAvg = history.reduce((s, h) => s + Math.abs(h.fundingRate), 0) / history.length;
      baselines.set(coin, absAvg);
    } catch (err) {
      log.debug('baseline fetch failed');
    }
  }
  return baselines;
}

async function pollOnce(): Promise<void> {
  const now = Date.now();
  let rates;
  try {
    rates = await fetchFundingRates();
  } catch (err) {
    log.warn('fetchFundingRates failed, skipping cycle');
    return;
  }

  // 1. Refresh baselines if stale
  if (!baseline || now - baseline.computed_at > FUNDING_BASELINE_REFRESH_MS) {
    const sorted = [...rates].sort((a, b) => parseFloat(b.open_interest) * parseFloat(b.mark_px) - parseFloat(a.open_interest) * parseFloat(a.mark_px));
    const top = sorted.slice(0, 20).map((r) => r.coin);
    log.info('refreshing baselines for top OI coins');
    baseline = { computed_at: now, baselines: await refreshBaselines(top) };
  }

  // 2. Detect funding outliers vs baseline
  for (const r of rates) {
    const baseAbs = baseline.baselines.get(r.coin);
    if (!baseAbs || baseAbs === 0) continue;
    const funding = parseFloat(r.funding_rate);
    const z = Math.abs(funding) / baseAbs;
    const stateKey = `funding_z:${r.coin}`;
    const previousZ = (signalBus.getLast(stateKey) as number) ?? 0;
    if (z >= FUNDING_Z_THRESHOLD && z > previousZ * 1.2) {
      const ev: SignalEvent = {
        type: 'funding_outlier_new',
        coin: r.coin,
        funding_rate: funding,
        baseline_abs: baseAbs,
        z_score: Math.round(z * 10) / 10,
        direction: funding > 0 ? 'longs_pay' : 'shorts_pay',
        detected_at: new Date(now).toISOString(),
      };
      signalBus.emitSignal(ev);
    }
    signalBus.setLast(stateKey, z);
  }

  // 3. OI cap reached — only emit on transition into the cap list
  try {
    const capped = await fetchPerpsAtOiCap();
    const cappedSet = new Set(capped.map((c) => c.coin));
    const prevCapped = (signalBus.getLast('oi_capped_set') as string)?.split(',').filter(Boolean) ?? [];
    const prevSet = new Set(prevCapped);
    for (const c of capped) {
      if (!prevSet.has(c.coin)) {
        signalBus.emitSignal({
          type: 'oi_cap_reached',
          coin: c.coin,
          oi_usd: c.oi_usd,
          detected_at: new Date(now).toISOString(),
        });
      }
    }
    signalBus.setLast('oi_capped_set', [...cappedSet].join(','));
  } catch {
    /* skip */
  }

  // 4. Refresh the tracked-coins list used by the fast trade poller (top N by OI)
  trackedCoins = [...rates]
    .sort((a, b) => parseFloat(b.open_interest) * parseFloat(b.mark_px) - parseFloat(a.open_interest) * parseFloat(a.mark_px))
    .slice(0, TRADE_POLL_TOP_N)
    .map((r) => r.coin);
}

/**
 * Fast trade poll. Runs every TRADE_POLL_INTERVAL_MS, fetches recent trades
 * for the tracked-coins list, appends to the buffer (deduped), and emits
 * whale_trade events for any new trades above WHALE_NOTIONAL_USDC.
 *
 * recentTrades returns ~10 trades per call. At 10s intervals on a coin with
 * 1k trades/min, we still miss most — but we catch whales (which by definition
 * are large and rare). The buffer accumulates ~600/hour per coin on average.
 */
async function pollTradesOnce(): Promise<void> {
  if (trackedCoins.length === 0) return;
  const now = Date.now();
  for (const coin of trackedCoins) {
    // Stagger calls within a cycle to avoid bursts that trip HL's per-IP rate limit
    await new Promise((r) => setTimeout(r, TRADE_POLL_STAGGER_MS));
    try {
      const direct = await fetchRecentTradesDirect(coin);
      if (direct.length === 0) continue;
      const added = tradeBuffer.add(coin, direct);
      if (added === 0) continue;

      // Emit whale_trade events for the newly-seen large trades.
      const lastSeen = lastWhaleScan.get(coin) ?? now - 30_000;
      const fresh = direct.filter((t) => t.time > lastSeen && t.notional >= WHALE_NOTIONAL_USDC);
      for (const t of fresh) {
        signalBus.emitSignal({
          type: 'whale_trade',
          coin,
          side: (t.side === 'B' ? 'B' : 'S') as 'B' | 'S',
          notional_usdc: Math.round(t.notional),
          px: t.px,
          sz: t.sz,
          detected_at: new Date(t.time).toISOString(),
        });
      }
      lastWhaleScan.set(coin, now);
    } catch {
      /* skip — transient API errors are normal */
    }
  }
}

export function startSignalPoller(): void {
  if (!signalBus.markStarted()) {
    log.debug('poller already started');
    return;
  }
  log.info(`signal poller started — funding/OI every ${POLL_INTERVAL_MS / 1000}s, trades every ${TRADE_POLL_INTERVAL_MS / 1000}s`);
  // Initial run after a small delay
  setTimeout(() => {
    pollOnce().catch((err) => log.warn('pollOnce failed'));
  }, 5_000);
  setInterval(() => {
    pollOnce().catch((err) => log.warn('pollOnce failed'));
  }, POLL_INTERVAL_MS);
  // Trade poller runs after the first pollOnce populates trackedCoins
  setTimeout(() => {
    setInterval(() => {
      pollTradesOnce().catch((err) => log.warn('pollTradesOnce failed'));
    }, TRADE_POLL_INTERVAL_MS);
  }, 10_000);
}
