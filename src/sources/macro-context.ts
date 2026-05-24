// src/sources/macro-context.ts
//
// Free macro data feeds:
//   - Yahoo Finance unofficial JSON (DXY, US10Y, S&P, gold) — no key
//   - CoinGecko /global (BTC dominance, ETH/BTC, total mcap) — no key

import { createLogger } from '../core/logger.js';

const log = createLogger('sources:macro-context');

const YF_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

async function yfQuote(symbol: string): Promise<{ price: number | null; change_pct: number | null } | null> {
  try {
    const res = await fetch(`${YF_BASE}/${encodeURIComponent(symbol)}?interval=1d&range=5d`, {
      signal: AbortSignal.timeout(7000),
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    const result = data?.chart?.result?.[0];
    if (!result) return null;
    const closes: number[] = result?.indicators?.quote?.[0]?.close ?? [];
    const valid = closes.filter((c) => Number.isFinite(c)) as number[];
    if (valid.length < 2) return null;
    const last = valid[valid.length - 1];
    const prev = valid[valid.length - 2];
    return {
      price: Math.round(last * 1e4) / 1e4,
      change_pct: prev > 0 ? Math.round(((last - prev) / prev) * 10000) / 100 : null,
    };
  } catch (err) {
    log.debug('yfQuote failed');
    return null;
  }
}

export interface MacroSnapshot {
  detected_at: string;
  dxy: { price: number | null; change_pct: number | null } | null;
  us10y_yield_pct: { price: number | null; change_pct: number | null } | null;
  spx: { price: number | null; change_pct: number | null } | null;
  gold_usd: { price: number | null; change_pct: number | null } | null;
  vix: { price: number | null; change_pct: number | null } | null;
  btc_dominance_pct: number | null;
  eth_btc: number | null;
  crypto_market_cap_usd_t: number | null;
  regime: 'RISK_ON' | 'RISK_OFF' | 'MIXED' | 'NEUTRAL';
  sources: string[];
}

export async function fetchMacroSnapshot(): Promise<MacroSnapshot> {
  const [dxy, us10y, spx, gold, vix, cg] = await Promise.all([
    yfQuote('DX-Y.NYB'),    // DXY index
    yfQuote('^TNX'),         // 10-Year Treasury yield
    yfQuote('^GSPC'),        // S&P 500
    yfQuote('GC=F'),         // Gold futures
    yfQuote('^VIX'),         // Volatility index
    fetchCoinGeckoGlobal(),
  ]);

  // Risk regime — coarse heuristic:
  //   DXY up + US10Y up + VIX up → RISK_OFF (crypto pressure)
  //   DXY down + SPX up + VIX down → RISK_ON
  let regime: MacroSnapshot['regime'] = 'NEUTRAL';
  const signals = {
    dxyUp: (dxy?.change_pct ?? 0) > 0.2,
    yieldUp: (us10y?.change_pct ?? 0) > 1,
    vixUp: (vix?.change_pct ?? 0) > 5,
    spxUp: (spx?.change_pct ?? 0) > 0.3,
    spxDown: (spx?.change_pct ?? 0) < -0.5,
    dxyDown: (dxy?.change_pct ?? 0) < -0.2,
    vixDown: (vix?.change_pct ?? 0) < -3,
  };
  const offCount = [signals.dxyUp, signals.yieldUp, signals.vixUp, signals.spxDown].filter(Boolean).length;
  const onCount = [signals.dxyDown, signals.spxUp, signals.vixDown].filter(Boolean).length;
  if (offCount >= 2 && onCount === 0) regime = 'RISK_OFF';
  else if (onCount >= 2 && offCount === 0) regime = 'RISK_ON';
  else if (offCount && onCount) regime = 'MIXED';

  return {
    detected_at: new Date().toISOString(),
    dxy,
    us10y_yield_pct: us10y,
    spx,
    gold_usd: gold,
    vix,
    btc_dominance_pct: cg?.btc_dominance ?? null,
    eth_btc: cg?.eth_btc ?? null,
    crypto_market_cap_usd_t: cg?.mcap_usd_t ?? null,
    regime,
    sources: ['yahoo_finance', 'coingecko'],
  };
}

async function fetchCoinGeckoGlobal(): Promise<{ btc_dominance: number | null; eth_btc: number | null; mcap_usd_t: number | null } | null> {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/global', {
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { market_cap_percentage?: Record<string, number>; total_market_cap?: Record<string, number> } };
    const pct = data.data?.market_cap_percentage ?? {};
    const tcap = data.data?.total_market_cap?.usd ?? 0;
    const btcDom = pct.btc ?? null;
    const ethDom = pct.eth ?? null;
    const ethBtc = btcDom && ethDom ? Math.round((ethDom / btcDom) * 10000) / 10000 : null;
    return {
      btc_dominance: btcDom !== null ? Math.round(btcDom * 100) / 100 : null,
      eth_btc: ethBtc,
      mcap_usd_t: tcap > 0 ? Math.round((tcap / 1e12) * 100) / 100 : null,
    };
  } catch {
    return null;
  }
}
