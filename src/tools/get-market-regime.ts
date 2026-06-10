// src/tools/get-market-regime.ts
//
// One-call regime classifier — the call an agent makes at the top of every
// session to condition its strategy. Composes breadth, funding crowding,
// BTC trend/vol, and IV-vs-RV premium into a single label.
//
// Free tier by design: it starts every agent session on this server.

import { TTLCache } from '../core/cache/index.js';
import { fetchFundingRates, fetchCandles } from '../sources/hyperliquid.js';
import { fetchOptionsSummary } from '../sources/deribit.js';

const cache = new TTLCache<unknown>(5 * 60_000);

export const getMarketRegimeSchema = {};

function realizedVolAnnualizedPct(closes: number[]): number | null {
  if (closes.length < 25) return null;
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) rets.push(Math.log(closes[i] / closes[i - 1]));
  }
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
  const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1);
  // hourly candles → annualize over 24*365 hours
  return Math.round(Math.sqrt(variance) * Math.sqrt(24 * 365) * 10000) / 100;
}

export async function getMarketRegimeHandler(_input: Record<string, never>) {
  const data = await cache.getOrFetch('market-regime', async () => {
    const now = Date.now();
    const [rates, btcCandles] = await Promise.all([
      fetchFundingRates(),
      fetchCandles('BTC', '1h', now - 7 * 86_400_000, now),
    ]);

    // Breadth: % of top-50 OI coins trading above their 7d mean is too
    // expensive to compute per-coin here; proxy with funding breadth instead —
    // % of top-50 coins with positive funding (longs paying = bullish bias).
    const topByOi = [...rates]
      .map((r) => ({ coin: r.coin, oiUsd: parseFloat(r.open_interest) * parseFloat(r.mark_px), funding: parseFloat(r.funding_rate) }))
      .filter((r) => Number.isFinite(r.oiUsd) && r.oiUsd > 0)
      .sort((a, b) => b.oiUsd - a.oiUsd)
      .slice(0, 50);
    const positiveFundingPct = Math.round((topByOi.filter((r) => r.funding > 0).length / Math.max(topByOi.length, 1)) * 100);

    // Crowding: OI-weighted average funding across top 50 (annualized %)
    const totalOi = topByOi.reduce((s, r) => s + r.oiUsd, 0);
    const weightedFunding = totalOi > 0 ? topByOi.reduce((s, r) => s + r.funding * r.oiUsd, 0) / totalOi : 0;
    const crowdingAnnualPct = Math.round(weightedFunding * 3 * 365 * 10000) / 100; // 8h funding → annual

    // BTC trend: price vs 7d mean + 24h change
    const closes = btcCandles.map((c) => c.c);
    const last = closes[closes.length - 1] ?? 0;
    const mean7d = closes.length ? closes.reduce((s, c) => s + c, 0) / closes.length : 0;
    const trendPct = mean7d > 0 ? Math.round(((last - mean7d) / mean7d) * 10000) / 100 : 0;
    const px24hAgo = closes[Math.max(0, closes.length - 25)] ?? last;
    const change24hPct = px24hAgo > 0 ? Math.round(((last - px24hAgo) / px24hAgo) * 10000) / 100 : 0;

    // Vol: realized 7d vs Deribit ATM IV
    const rvPct = realizedVolAnnualizedPct(closes);
    let ivPct: number | null = null;
    try {
      const opt = await fetchOptionsSummary('BTC');
      ivPct = opt.atm_iv_pct;
    } catch { /* deribit down — degrade gracefully */ }
    const ivRvPremium = ivPct !== null && rvPct !== null ? Math.round((ivPct - rvPct) * 100) / 100 : null;

    // Classification
    let regime: string;
    if (trendPct > 1.5 && positiveFundingPct > 60) regime = 'RISK_ON_TRENDING';
    else if (trendPct < -1.5 && positiveFundingPct < 40) regime = 'RISK_OFF';
    else if (Math.abs(crowdingAnnualPct) > 15 && Math.sign(crowdingAnnualPct) !== Math.sign(trendPct)) regime = 'SQUEEZE_RISK';
    else if (rvPct !== null && rvPct < 30 && Math.abs(trendPct) < 1) regime = 'CHOP_LOW_VOL';
    else regime = 'MIXED';

    return {
      regime,
      btc: {
        price: last,
        trend_vs_7d_mean_pct: trendPct,
        change_24h_pct: change24hPct,
        realized_vol_7d_annual_pct: rvPct,
        atm_iv_pct: ivPct,
        iv_rv_premium_pct: ivRvPremium,
      },
      breadth: {
        positive_funding_pct_top50: positiveFundingPct,
        crowding_oi_weighted_funding_annual_pct: crowdingAnnualPct,
      },
      interpretation: {
        RISK_ON_TRENDING: 'Trend-following longs favored; carry trades crowded — watch funding cost.',
        RISK_OFF: 'Defensive; shorts paying or flat. Mean-reversion setups need wider stops.',
        SQUEEZE_RISK: 'Funding crowded against trend — squeeze potential. Avoid joining the crowded side.',
        CHOP_LOW_VOL: 'Low vol + no trend. Carry/theta strategies over direction; breakouts unreliable.',
        MIXED: 'No dominant regime. Reduce size, prefer high-conviction setups only.',
      }[regime],
    };
  });
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
}
