// src/core/server/market-store.ts
//
// Persistence layer for the 24/7 collection loop. Every function here is
// fire-and-forget safe: errors are logged and swallowed so a SQLite hiccup
// can never take down the poller or a request path.
//
// Tables (migration 8): signal_events, signal_outcomes, market_snapshots,
// whale_tape, wallet_stats, funding_baselines.

import { getDb } from '../db/index.js';
import { createLogger } from '../logger.js';
import type { SignalEvent } from './signal-bus.js';
import type { BufferedTrade } from './trade-buffer.js';

const log = createLogger('market-store');

const RETENTION_DAYS = 90;
const SNAPSHOT_TOP_N = 30;          // coins per snapshot cycle
const TAPE_MIN_NOTIONAL = 25_000;   // USD — persist trades above this

// ─── Signal events + outcomes ────────────────────────────────────────────────

export function persistSignalEvent(ev: SignalEvent, markPx: number | null): number | null {
  try {
    const res = getDb()
      .prepare(
        'INSERT INTO signal_events (type, coin, detected_at, mark_px, payload) VALUES (?, ?, ?, ?, ?)',
      )
      .run(
        ev.type,
        (ev as { coin?: string }).coin ?? '*',
        Date.parse((ev as { detected_at?: string }).detected_at ?? '') || Date.now(),
        markPx,
        JSON.stringify(ev),
      );
    const id = Number(res.lastInsertRowid);
    if (markPx !== null && Number.isFinite(markPx)) {
      getDb()
        .prepare('INSERT INTO signal_outcomes (event_id, px_detect) VALUES (?, ?)')
        .run(id, markPx);
    }
    return id;
  } catch (err) {
    log.warn('persistSignalEvent failed', { err: String(err) });
    return null;
  }
}

export interface SignalEventRow {
  id: number;
  type: string;
  coin: string;
  detected_at: number;
  mark_px: number | null;
  payload: string;
  ret_1h?: number | null;
  ret_4h?: number | null;
  ret_24h?: number | null;
}

export function querySignalEvents(opts: {
  sinceId?: number;
  sinceMs?: number;
  coin?: string;
  types?: string[];
  limit?: number;
}): SignalEventRow[] {
  try {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (opts.sinceId !== undefined) {
      clauses.push('e.id > ?');
      params.push(opts.sinceId);
    }
    if (opts.sinceMs !== undefined) {
      clauses.push('e.detected_at >= ?');
      params.push(opts.sinceMs);
    }
    if (opts.coin) {
      clauses.push('e.coin = ?');
      params.push(opts.coin.toUpperCase());
    }
    if (opts.types && opts.types.length > 0) {
      clauses.push(`e.type IN (${opts.types.map(() => '?').join(',')})`);
      params.push(...opts.types);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const limit = Math.min(opts.limit ?? 50, 500);
    return getDb()
      .prepare(
        `SELECT e.id, e.type, e.coin, e.detected_at, e.mark_px, e.payload,
                o.ret_1h, o.ret_4h, o.ret_24h
           FROM signal_events e
           LEFT JOIN signal_outcomes o ON o.event_id = e.id
           ${where}
           ORDER BY e.id DESC
           LIMIT ?`,
      )
      .all(...params, limit) as SignalEventRow[];
  } catch (err) {
    log.warn('querySignalEvents failed', { err: String(err) });
    return [];
  }
}

/** Aggregate hit-rate stats per signal type (and optionally coin) over a window. */
export function signalPerformance(opts: { type?: string; coin?: string; days: number }) {
  try {
    const clauses = ['o.resolved_at IS NOT NULL', 'e.detected_at >= ?'];
    const params: unknown[] = [Date.now() - opts.days * 86_400_000];
    if (opts.type) {
      clauses.push('e.type = ?');
      params.push(opts.type);
    }
    if (opts.coin) {
      clauses.push('e.coin = ?');
      params.push(opts.coin.toUpperCase());
    }
    return getDb()
      .prepare(
        `SELECT e.type, e.coin,
                COUNT(*)                              AS n,
                AVG(o.ret_1h)                         AS avg_ret_1h,
                AVG(o.ret_4h)                         AS avg_ret_4h,
                AVG(o.ret_24h)                        AS avg_ret_24h,
                AVG(CASE WHEN o.ret_24h > 0 THEN 1.0 ELSE 0.0 END) AS win_rate_24h
           FROM signal_events e
           JOIN signal_outcomes o ON o.event_id = e.id
          WHERE ${clauses.join(' AND ')}
          GROUP BY e.type, e.coin
          ORDER BY n DESC`,
      )
      .all(...params) as Array<{
      type: string;
      coin: string;
      n: number;
      avg_ret_1h: number | null;
      avg_ret_4h: number | null;
      avg_ret_24h: number | null;
      win_rate_24h: number | null;
    }>;
  } catch (err) {
    log.warn('signalPerformance failed', { err: String(err) });
    return [];
  }
}

/** Events with unresolved forward returns past maturity, grouped for the sweep. */
export function unresolvedOutcomes(): Array<{
  event_id: number;
  coin: string;
  detected_at: number;
  px_detect: number;
  ret_1h: number | null;
  ret_4h: number | null;
  ret_24h: number | null;
}> {
  try {
    return getDb()
      .prepare(
        `SELECT o.event_id, e.coin, e.detected_at, o.px_detect, o.ret_1h, o.ret_4h, o.ret_24h
           FROM signal_outcomes o
           JOIN signal_events e ON e.id = o.event_id
          WHERE o.resolved_at IS NULL
            AND e.detected_at <= ?
          LIMIT 200`,
      )
      .all(Date.now() - 3_600_000) as Array<{
      event_id: number;
      coin: string;
      detected_at: number;
      px_detect: number;
      ret_1h: number | null;
      ret_4h: number | null;
      ret_24h: number | null;
    }>;
  } catch (err) {
    log.warn('unresolvedOutcomes failed', { err: String(err) });
    return [];
  }
}

export function updateOutcome(
  eventId: number,
  fields: { ret_1h?: number | null; ret_4h?: number | null; ret_24h?: number | null; resolved?: boolean },
): void {
  try {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (fields.ret_1h !== undefined) { sets.push('ret_1h = ?'); params.push(fields.ret_1h); }
    if (fields.ret_4h !== undefined) { sets.push('ret_4h = ?'); params.push(fields.ret_4h); }
    if (fields.ret_24h !== undefined) { sets.push('ret_24h = ?'); params.push(fields.ret_24h); }
    if (fields.resolved) { sets.push('resolved_at = ?'); params.push(Date.now()); }
    if (!sets.length) return;
    getDb()
      .prepare(`UPDATE signal_outcomes SET ${sets.join(', ')} WHERE event_id = ?`)
      .run(...params, eventId);
  } catch (err) {
    log.warn('updateOutcome failed', { err: String(err) });
  }
}

// ─── Market snapshots ────────────────────────────────────────────────────────

export interface SnapshotInput {
  coin: string;
  funding: number;
  oi: number;
  mark_px: number;
  day_vlm: number;
}

export function persistSnapshots(rows: SnapshotInput[], ts: number): void {
  try {
    const db = getDb();
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO market_snapshots (coin, ts, funding, oi, mark_px, day_vlm)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    const insertAll = db.transaction((items: SnapshotInput[]) => {
      for (const r of items.slice(0, SNAPSHOT_TOP_N)) {
        stmt.run(r.coin, ts, r.funding, r.oi, r.mark_px, r.day_vlm);
      }
    });
    insertAll(rows);
  } catch (err) {
    log.warn('persistSnapshots failed', { err: String(err) });
  }
}

export function querySnapshots(coin: string, sinceMs: number): Array<{
  ts: number;
  funding: number;
  oi: number;
  mark_px: number;
  day_vlm: number;
}> {
  try {
    return getDb()
      .prepare(
        `SELECT ts, funding, oi, mark_px, day_vlm
           FROM market_snapshots
          WHERE coin = ? AND ts >= ?
          ORDER BY ts ASC`,
      )
      .all(coin.toUpperCase(), sinceMs) as Array<{
      ts: number;
      funding: number;
      oi: number;
      mark_px: number;
      day_vlm: number;
    }>;
  } catch (err) {
    log.warn('querySnapshots failed', { err: String(err) });
    return [];
  }
}

export function snapshotCoins(): string[] {
  try {
    return (
      getDb()
        .prepare(
          `SELECT DISTINCT coin FROM market_snapshots WHERE ts >= ?`,
        )
        .all(Date.now() - 86_400_000) as Array<{ coin: string }>
    ).map((r) => r.coin);
  } catch {
    return [];
  }
}

// ─── Whale tape + wallet stats ───────────────────────────────────────────────

export function persistWhaleTrades(coin: string, trades: BufferedTrade[]): void {
  const big = trades.filter((t) => t.notional >= TAPE_MIN_NOTIONAL);
  if (!big.length) return;
  try {
    const db = getDb();
    const stmt = db.prepare(
      `INSERT OR IGNORE INTO whale_tape (coin, time, px, sz, side, notional)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    const insertAll = db.transaction((items: BufferedTrade[]) => {
      for (const t of items) stmt.run(coin, t.time, t.px, t.sz, t.side, t.notional);
    });
    insertAll(big);
  } catch (err) {
    log.warn('persistWhaleTrades failed', { err: String(err) });
  }
}

export function queryWhaleFlow(coin: string, sinceMs: number): {
  buy_usd: number;
  sell_usd: number;
  trade_count: number;
} {
  try {
    const row = getDb()
      .prepare(
        `SELECT
            COALESCE(SUM(CASE WHEN side = 'B' THEN notional END), 0) AS buy_usd,
            COALESCE(SUM(CASE WHEN side = 'A' THEN notional END), 0) AS sell_usd,
            COUNT(*) AS trade_count
           FROM whale_tape
          WHERE coin = ? AND time >= ?`,
      )
      .get(coin.toUpperCase(), sinceMs) as { buy_usd: number; sell_usd: number; trade_count: number };
    return row;
  } catch (err) {
    log.warn('queryWhaleFlow failed', { err: String(err) });
    return { buy_usd: 0, sell_usd: 0, trade_count: 0 };
  }
}

export function queryWhaleTape(coin: string, sinceMs: number, minNotional: number, limit = 100): BufferedTrade[] {
  try {
    return getDb()
      .prepare(
        `SELECT time, px, sz, side, notional
           FROM whale_tape
          WHERE coin = ? AND time >= ? AND notional >= ?
          ORDER BY time DESC LIMIT ?`,
      )
      .all(coin.toUpperCase(), sinceMs, minNotional, Math.min(limit, 500)) as BufferedTrade[];
  } catch (err) {
    log.warn('queryWhaleTape failed', { err: String(err) });
    return [];
  }
}

// ─── Funding baselines (warm restart) ────────────────────────────────────────

export function persistBaselines(baselines: Map<string, number>, samples: Map<string, number>): void {
  try {
    const db = getDb();
    const now = Date.now();
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO funding_baselines (coin, computed_at, baseline_abs, samples)
       VALUES (?, ?, ?, ?)`,
    );
    const insertAll = db.transaction(() => {
      for (const [coin, b] of baselines) stmt.run(coin, now, b, samples.get(coin) ?? 0);
    });
    insertAll();
  } catch (err) {
    log.warn('persistBaselines failed', { err: String(err) });
  }
}

export function loadLatestBaselines(): { computed_at: number; baselines: Map<string, number> } | null {
  try {
    const latest = getDb()
      .prepare('SELECT MAX(computed_at) AS t FROM funding_baselines')
      .get() as { t: number | null };
    if (!latest.t) return null;
    const rows = getDb()
      .prepare('SELECT coin, baseline_abs FROM funding_baselines WHERE computed_at = ?')
      .all(latest.t) as Array<{ coin: string; baseline_abs: number }>;
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.coin, r.baseline_abs);
    return { computed_at: latest.t, baselines: map };
  } catch (err) {
    log.warn('loadLatestBaselines failed', { err: String(err) });
    return null;
  }
}

// ─── Retention ───────────────────────────────────────────────────────────────

export function pruneOldRows(): void {
  try {
    const db = getDb();
    const cutoff = Date.now() - RETENTION_DAYS * 86_400_000;
    db.prepare('DELETE FROM market_snapshots WHERE ts < ?').run(cutoff);
    db.prepare('DELETE FROM whale_tape WHERE time < ?').run(cutoff);
    db.prepare(
      'DELETE FROM signal_outcomes WHERE event_id IN (SELECT id FROM signal_events WHERE detected_at < ?)',
    ).run(cutoff);
    db.prepare('DELETE FROM signal_events WHERE detected_at < ?').run(cutoff);
    db.prepare('DELETE FROM funding_baselines WHERE computed_at < ?').run(cutoff);
  } catch (err) {
    log.warn('pruneOldRows failed', { err: String(err) });
  }
}
