// src/core/server/signal-poller.ts
//
// Background task that polls Hyperliquid every N seconds, emits state-change
// events on the signalBus, and persists everything worth keeping into SQLite
// (market-store): signal events + outcomes, OI/funding snapshots, whale tape,
// funding baselines. One poller for the whole server.

import { signalBus, type SignalEvent } from './signal-bus.js';
import { fetchFundingRates, fetchPerpsAtOiCap, fetchFundingHistory, fetchRecentTradesDirect, fetchCandles } from '../../sources/hyperliquid.js';
import { tradeBuffer } from './trade-buffer.js';
import {
  persistSignalEvent,
  persistSnapshots,
  persistWhaleTrades,
  persistBaselines,
  loadLatestBaselines,
  unresolvedOutcomes,
  updateOutcome,
  pruneOldRows,
} from './market-store.js';
import { createLogger } from '../logger.js';

const log = createLogger('signal-poller');

const POLL_INTERVAL_MS = 60_000;            // 1 minute (funding/OI)
const TRADE_POLL_INTERVAL_MS = 30_000;      // 30 seconds (trades — balance whale-tracking vs HL rate limit)
const TRADE_POLL_TOP_N = 10;                // top N coins by OI to track in buffer
const TRADE_POLL_STAGGER_MS = 200;          // delay between coin polls within a cycle
const WHALE_NOTIONAL_USDC = 100_000;        // emit whale_trade events above this
const FUNDING_Z_THRESHOLD = 3;              // emit funding_outlier_new at z >= 3
const FUNDING_BASELINE_REFRESH_MS = 30 * 60_000; // recompute 7d baseline every 30 min
const SNAPSHOT_EVERY_N_CYCLES = 5;          // persist market snapshots every 5 min
const OUTCOME_SWEEP_MS = 15 * 60_000;       // resolve forward returns every 15 min
const PRUNE_EVERY_MS = 24 * 3_600_000;      // retention prune daily

let trackedCoins: string[] = []; // refreshed by main poller — used by trade poller
let cycleCount = 0;

// Latest mark price per coin, refreshed every cycle — used to stamp signal
// events with the price at detection so outcomes can be measured later.
const lastMarkPx = new Map<string, number>();

interface BaselineCache {
  computed_at: number;
  baselines: Map<string, number>;
}

let baseline: BaselineCache | null = null;
let lastWhaleScan: Map<string, number> = new Map(); // per-coin last seen trade time

function emitAndPersist(ev: SignalEvent): void {
  signalBus.emitSignal(ev);
  const coin = (ev as { coin?: string }).coin;
  persistSignalEvent(ev, coin ? lastMarkPx.get(coin) ?? null : null);
}

async function refreshBaselines(coins: string[]): Promise<Map<string, number>> {
  const baselines = new Map<string, number>();
  const samples = new Map<string, number>();
  const startMs = Date.now() - 7 * 86_400_000;
  // Sample top 20 by OI to limit API load
  const top = coins.slice(0, 20);
  for (const coin of top) {
    try {
      const history = await fetchFundingHistory(coin, startMs);
      if (history.length < 10) continue;
      const absAvg = history.reduce((s, h) => s + Math.abs(h.fundingRate), 0) / history.length;
      baselines.set(coin, absAvg);
      samples.set(coin, history.length);
    } catch (err) {
      log.debug('baseline fetch failed');
    }
  }
  persistBaselines(baselines, samples);
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

  // 0. Track mark prices + persist snapshots every Nth cycle (5-min resolution)
  const byOi = [...rates].sort(
    (a, b) => parseFloat(b.open_interest) * parseFloat(b.mark_px) - parseFloat(a.open_interest) * parseFloat(a.mark_px),
  );
  for (const r of rates) {
    const px = parseFloat(r.mark_px);
    if (Number.isFinite(px) && px > 0) lastMarkPx.set(r.coin, px);
  }
  cycleCount++;
  if (cycleCount % SNAPSHOT_EVERY_N_CYCLES === 1) {
    persistSnapshots(
      byOi.map((r) => ({
        coin: r.coin,
        funding: parseFloat(r.funding_rate) || 0,
        oi: parseFloat(r.open_interest) || 0,
        mark_px: parseFloat(r.mark_px) || 0,
        day_vlm: parseFloat(r.day_ntl_vlm ?? '0') || 0,
      })),
      now,
    );
  }

  // 1. Refresh baselines if stale
  if (!baseline || now - baseline.computed_at > FUNDING_BASELINE_REFRESH_MS) {
    const top = byOi.slice(0, 20).map((r) => r.coin);
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
      emitAndPersist({
        type: 'funding_outlier_new',
        coin: r.coin,
        funding_rate: funding,
        baseline_abs: baseAbs,
        z_score: Math.round(z * 10) / 10,
        direction: funding > 0 ? 'longs_pay' : 'shorts_pay',
        detected_at: new Date(now).toISOString(),
      });
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
        emitAndPersist({
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
  trackedCoins = byOi.slice(0, TRADE_POLL_TOP_N).map((r) => r.coin);
}

/**
 * Fast trade poll. Runs every TRADE_POLL_INTERVAL_MS, fetches recent trades
 * for the tracked-coins list, appends to the buffer (deduped), persists the
 * big ones to the durable whale tape, and emits whale_trade events above
 * WHALE_NOTIONAL_USDC.
 *
 * recentTrades returns ~10 trades per call. At 30s intervals on a coin with
 * 1k trades/min, we still miss most — but we catch whales (which by definition
 * are large and rare).
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

      // Durable tape: everything ≥ $25k survives restarts and feeds whale-flow tools.
      persistWhaleTrades(coin, direct);

      // Emit whale_trade events for the newly-seen large trades.
      const lastSeen = lastWhaleScan.get(coin) ?? now - 30_000;
      const fresh = direct.filter((t) => t.time > lastSeen && t.notional >= WHALE_NOTIONAL_USDC);
      for (const t of fresh) {
        emitAndPersist({
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

/**
 * Outcome resolver. Every 15 min, finds signal events past maturity with
 * unresolved forward returns and fills them from 1h candles. One candle
 * fetch per distinct coin per sweep.
 */
async function resolveOutcomesOnce(): Promise<void> {
  const pending = unresolvedOutcomes();
  if (!pending.length) return;
  const now = Date.now();

  const byCoin = new Map<string, typeof pending>();
  for (const p of pending) {
    if (!byCoin.has(p.coin)) byCoin.set(p.coin, []);
    byCoin.get(p.coin)!.push(p);
  }

  for (const [coin, events] of byCoin) {
    if (coin === '*') {
      // Non-coin events (none currently) — mark resolved so they don't loop.
      for (const e of events) updateOutcome(e.event_id, { resolved: true });
      continue;
    }
    try {
      const oldest = Math.min(...events.map((e) => e.detected_at));
      const candles = await fetchCandles(coin, '1h', oldest - 3_600_000, now);
      if (!candles.length) continue;

      const priceAt = (targetMs: number): number | null => {
        // candles sorted ascending; find last candle with open time <= target
        let best: number | null = null;
        for (const c of candles) {
          if (c.t <= targetMs) best = c.c;
          else break;
        }
        return best;
      };

      for (const e of events) {
        const fields: { ret_1h?: number | null; ret_4h?: number | null; ret_24h?: number | null; resolved?: boolean } = {};
        const ages = now - e.detected_at;
        if (e.ret_1h === null && ages >= 3_600_000) {
          const p = priceAt(e.detected_at + 3_600_000);
          fields.ret_1h = p !== null && e.px_detect > 0 ? Math.round(((p - e.px_detect) / e.px_detect) * 1e6) / 1e4 : null;
        }
        if (e.ret_4h === null && ages >= 4 * 3_600_000) {
          const p = priceAt(e.detected_at + 4 * 3_600_000);
          fields.ret_4h = p !== null && e.px_detect > 0 ? Math.round(((p - e.px_detect) / e.px_detect) * 1e6) / 1e4 : null;
        }
        if (e.ret_24h === null && ages >= 24 * 3_600_000) {
          const p = priceAt(e.detected_at + 24 * 3_600_000);
          fields.ret_24h = p !== null && e.px_detect > 0 ? Math.round(((p - e.px_detect) / e.px_detect) * 1e6) / 1e4 : null;
          fields.resolved = true; // 24h is the final horizon
        }
        if (Object.keys(fields).length) updateOutcome(e.event_id, fields);
      }
    } catch {
      /* transient — retry next sweep */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
}

export function startSignalPoller(): void {
  if (!signalBus.markStarted()) {
    log.debug('poller already started');
    return;
  }

  // Warm restart: load the most recent persisted baselines so outlier
  // detection works immediately instead of being blind for the first cycle.
  const persisted = loadLatestBaselines();
  if (persisted && Date.now() - persisted.computed_at < 2 * FUNDING_BASELINE_REFRESH_MS) {
    baseline = persisted;
    log.info(`warm-start: loaded ${persisted.baselines.size} funding baselines from disk`);
  }

  log.info(`signal poller started — funding/OI every ${POLL_INTERVAL_MS / 1000}s, trades every ${TRADE_POLL_INTERVAL_MS / 1000}s`);
  // Initial run after a small delay
  setTimeout(() => {
    pollOnce().catch(() => log.warn('pollOnce failed'));
  }, 5_000);
  setInterval(() => {
    pollOnce().catch(() => log.warn('pollOnce failed'));
  }, POLL_INTERVAL_MS);
  // Trade poller runs after the first pollOnce populates trackedCoins
  setTimeout(() => {
    setInterval(() => {
      pollTradesOnce().catch(() => log.warn('pollTradesOnce failed'));
    }, TRADE_POLL_INTERVAL_MS);
  }, 10_000);
  // Outcome resolver — fills forward returns on persisted signal events
  setInterval(() => {
    resolveOutcomesOnce().catch(() => log.warn('resolveOutcomesOnce failed'));
  }, OUTCOME_SWEEP_MS);
  // Daily retention prune
  setInterval(() => pruneOldRows(), PRUNE_EVERY_MS);
}
