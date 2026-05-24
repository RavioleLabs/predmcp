// src/sources/deribit.ts
//
// Deribit public market data — no auth required.
// Docs: https://docs.deribit.com/

import { createLogger } from '../core/logger.js';

const log = createLogger('sources:deribit');

const BASE = 'https://www.deribit.com/api/v2/public';

interface DeribitOption {
  instrument_name: string;
  underlying_price: number;
  mark_price: number;
  bid_price: number | null;
  ask_price: number | null;
  mark_iv: number;
  open_interest: number;
  volume: number;
  base_currency: string;
  estimated_delivery_price?: number;
  interest_rate?: number;
}

export interface OptionsIvSummary {
  asset: string;
  spot_price: number;
  atm_iv_pct: number | null;
  put_call_skew_pct: number | null;
  term_structure: { dte_days: number; atm_iv_pct: number; oi_total: number }[];
  oi_total: number;
  volume_24h_total: number;
  source: 'deribit';
}

/**
 * Parses a Deribit instrument name into expiry and strike.
 * Example: "BTC-26DEC25-100000-C" → { dte_days, strike, type }
 */
function parseInstrument(name: string, now: number): { strike: number; type: 'C' | 'P'; dte_days: number } | null {
  // Format: ASSET-DDMMMYY-STRIKE-C|P
  const parts = name.split('-');
  if (parts.length !== 4) return null;
  const [, dateStr, strikeStr, typeStr] = parts;
  if (typeStr !== 'C' && typeStr !== 'P') return null;
  const strike = parseFloat(strikeStr);
  if (!Number.isFinite(strike)) return null;
  // Parse DDMMMYY → Date
  const day = parseInt(dateStr.slice(0, dateStr.length - 5), 10);
  const monthStr = dateStr.slice(-5, -2).toUpperCase();
  const year = 2000 + parseInt(dateStr.slice(-2), 10);
  const months = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 } as Record<string, number>;
  const month = months[monthStr];
  if (month === undefined || !Number.isFinite(day) || !Number.isFinite(year)) return null;
  const expiry = new Date(Date.UTC(year, month, day, 8, 0, 0)).getTime(); // Deribit expires at 08:00 UTC
  const dte = Math.max(0, (expiry - now) / 86_400_000);
  return { strike, type: typeStr as 'C' | 'P', dte_days: dte };
}

export async function fetchOptionsSummary(asset: 'BTC' | 'ETH'): Promise<OptionsIvSummary> {
  log.debug('fetchOptionsSummary');
  const res = await fetch(`${BASE}/get_book_summary_by_currency?currency=${asset}&kind=option`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Deribit fetch failed: ${res.status}`);
  const data = (await res.json()) as { result?: DeribitOption[] };
  const opts = data.result ?? [];
  if (!opts.length) {
    return { asset, spot_price: 0, atm_iv_pct: null, put_call_skew_pct: null, term_structure: [], oi_total: 0, volume_24h_total: 0, source: 'deribit' };
  }

  const now = Date.now();
  const spot = opts[0].underlying_price ?? 0;
  const oiTotal = opts.reduce((s, o) => s + (o.open_interest || 0), 0);
  const volTotal = opts.reduce((s, o) => s + (o.volume || 0), 0);

  // Group by expiry bucket → compute ATM IV per expiry
  const byExpiry: Record<string, { ivs: { iv: number; dist: number }[]; oi: number; dte: number }> = {};
  let allCallIvs: number[] = [];
  let allPutIvs: number[] = [];

  for (const o of opts) {
    const parsed = parseInstrument(o.instrument_name, now);
    if (!parsed || !o.mark_iv) continue;
    const ivPct = o.mark_iv; // Deribit already returns percent
    const dist = Math.abs(parsed.strike - spot) / spot;
    const key = `${Math.round(parsed.dte_days)}`;
    if (!byExpiry[key]) byExpiry[key] = { ivs: [], oi: 0, dte: parsed.dte_days };
    byExpiry[key].ivs.push({ iv: ivPct, dist });
    byExpiry[key].oi += o.open_interest || 0;
    // Skew: ATM = within 2% of spot
    if (dist <= 0.05) {
      if (parsed.type === 'C') allCallIvs.push(ivPct);
      else allPutIvs.push(ivPct);
    }
  }

  // Compute ATM IV per expiry = IV of closest-to-ATM strike
  const term: { dte_days: number; atm_iv_pct: number; oi_total: number }[] = [];
  for (const [, group] of Object.entries(byExpiry)) {
    if (!group.ivs.length) continue;
    group.ivs.sort((a, b) => a.dist - b.dist);
    term.push({
      dte_days: Math.round(group.dte * 10) / 10,
      atm_iv_pct: Math.round(group.ivs[0].iv * 10) / 10,
      oi_total: Math.round(group.oi),
    });
  }
  term.sort((a, b) => a.dte_days - b.dte_days);

  // ATM IV — nearest expiry, closest to spot
  const atmIv = term.length ? term[0].atm_iv_pct : null;

  // Put-call skew on ATM options
  const meanCallIv = allCallIvs.length ? allCallIvs.reduce((s, x) => s + x, 0) / allCallIvs.length : 0;
  const meanPutIv = allPutIvs.length ? allPutIvs.reduce((s, x) => s + x, 0) / allPutIvs.length : 0;
  const skew = meanCallIv && meanPutIv ? Math.round((meanPutIv - meanCallIv) * 10) / 10 : null;

  return {
    asset,
    spot_price: spot,
    atm_iv_pct: atmIv,
    put_call_skew_pct: skew,
    term_structure: term.slice(0, 12),
    oi_total: Math.round(oiTotal),
    volume_24h_total: Math.round(volTotal),
    source: 'deribit',
  };
}
