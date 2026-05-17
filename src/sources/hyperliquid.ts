import * as hl from '@nktkas/hyperliquid';
import { createLogger } from '../core/logger.js';

const log = createLogger('sources:hyperliquid');

let _client: hl.InfoClient | null = null;

function getClient(): hl.InfoClient {
  if (!_client) {
    const transport = new hl.HttpTransport({ apiUrl: 'https://api.hyperliquid.xyz' });
    _client = new hl.InfoClient({ transport });
  }
  return _client;
}

export interface FundingRate {
  coin: string;
  funding_rate: string;
  open_interest: string;
  mark_px: string;
  day_ntl_vlm?: string;
}

export interface WhaleTrade {
  sz: string;
  px: string;
  side: string;
  time: number;
  notional: number;
}

export async function fetchFundingRates(coins?: string[]): Promise<FundingRate[]> {
  log.debug('fetchFundingRates');
  const [meta, assetCtxs] = await getClient().metaAndAssetCtxs();
  return meta.universe
    .map((asset: { name: string }, originalIndex: number) => ({ asset, originalIndex }))
    .filter(({ asset }: { asset: { name: string } }) => !coins || coins.includes(asset.name))
    .map(({ asset, originalIndex }: { asset: { name: string }; originalIndex: number }) => ({
      coin: asset.name,
      // @ts-ignore
      funding_rate: assetCtxs[originalIndex]?.funding ?? '0',
      // @ts-ignore
      open_interest: assetCtxs[originalIndex]?.openInterest ?? '0',
      // @ts-ignore
      mark_px: assetCtxs[originalIndex]?.markPx ?? '0',
      // @ts-ignore
      day_ntl_vlm: assetCtxs[originalIndex]?.dayNtlVlm ?? '0',
    }));
}

export async function fetchOpenInterest(coins?: string[]): Promise<{ coin: string; open_interest: string; mark_px: string }[]> {
  log.debug('fetchOpenInterest');
  const rates = await fetchFundingRates(coins);
  return rates.map(r => ({ coin: r.coin, open_interest: r.open_interest, mark_px: r.mark_px }));
}

export async function fetchWhaleTrades(coin: string, minNotionalUsdc = 50000): Promise<WhaleTrade[]> {
  log.debug('fetchWhaleTrades');
  const trades = await getClient().recentTrades({ coin });
  return trades
    .map((t: { sz: string; px: string; side: string; time: number }) => ({
      ...t,
      notional: parseFloat(t.sz) * parseFloat(t.px),
    }))
    .filter((t: WhaleTrade) => t.notional >= minNotionalUsdc);
}

export async function fetchTopFundingRates(limit = 10, minAbsRate = 0): Promise<FundingRate[]> {
  log.debug('fetchTopFundingRates');
  const all = await fetchFundingRates();
  return all
    .filter(r => Math.abs(parseFloat(r.funding_rate)) >= minAbsRate)
    .sort((a, b) => Math.abs(parseFloat(b.funding_rate)) - Math.abs(parseFloat(a.funding_rate)))
    .slice(0, limit);
}

export async function fetchFundingOutliers(days = 7, minDeviationFactor = 2): Promise<{
  coin: string;
  current_rate: number;
  avg_rate: number;
  deviation_factor: number;
  direction: string;
  mark_px: string;
  open_interest: string;
}[]> {
  log.debug('fetchFundingOutliers');
  const all = await fetchFundingRates();
  const startTime = Date.now() - days * 86400 * 1000;

  // Sample a subset of high-OI coins to avoid too many parallel requests
  const topCoins = all
    .sort((a, b) => parseFloat(b.open_interest) * parseFloat(b.mark_px) - parseFloat(a.open_interest) * parseFloat(a.mark_px))
    .slice(0, 30)
    .map(r => r.coin);

  const results = await Promise.allSettled(
    topCoins.map(async (coin) => {
      const history = await getClient().fundingHistory({ coin, startTime });
      if (!history || history.length < 10) return null;
      const rates = history.map((h: { fundingRate: string }) => parseFloat(h.fundingRate));
      const avg = rates.reduce((s: number, r: number) => s + r, 0) / rates.length;
      const absAvg = Math.abs(avg);
      const current = parseFloat(all.find(r => r.coin === coin)?.funding_rate ?? '0');
      const absDeviation = absAvg > 0 ? Math.abs(current) / absAvg : 0;
      if (absDeviation < minDeviationFactor && Math.abs(current) < 0.0002) return null;
      const row = all.find(r => r.coin === coin)!;
      return {
        coin,
        current_rate: current,
        avg_rate: avg,
        deviation_factor: Math.round(absDeviation * 10) / 10,
        direction: current > 0 ? 'longs_pay' : 'shorts_pay',
        mark_px: row.mark_px,
        open_interest: row.open_interest,
      };
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<NonNullable<typeof r extends PromiseFulfilledResult<infer T> ? T : never>> =>
      r.status === 'fulfilled' && r.value !== null)
    .map(r => (r as PromiseFulfilledResult<any>).value)
    .sort((a, b) => b.deviation_factor - a.deviation_factor)
    .slice(0, 15);
}

export async function fetchPerpsAtOiCap(): Promise<{ coin: string; mark_px: string; open_interest: string; oi_usd: number }[]> {
  log.debug('fetchPerpsAtOiCap');
  const [capCoins, all] = await Promise.all([
    getClient().perpsAtOpenInterestCap() as Promise<string[]>,
    fetchFundingRates(),
  ]);
  return capCoins.map(coin => {
    const row = all.find(r => r.coin === coin);
    const oi = parseFloat(row?.open_interest ?? '0');
    const px = parseFloat(row?.mark_px ?? '0');
    return {
      coin,
      mark_px: row?.mark_px ?? '0',
      open_interest: row?.open_interest ?? '0',
      oi_usd: Math.round(oi * px),
    };
  });
}

export async function fetchLiquidationClusters(coin: string): Promise<{
  coin: string;
  mark_px: number;
  clusters: { price: number; leverage: number; side: string; distance_pct: number }[];
}> {
  log.debug('fetchLiquidationClusters');
  const [book, rates] = await Promise.all([
    getClient().l2Book({ coin, nSigFigs: 4 }),
    fetchFundingRates([coin]),
  ]);
  const markPx = parseFloat(rates[0]?.mark_px ?? '0');
  if (!markPx) throw new Error(`No mark price for ${coin}`);

  // Estimate liquidation levels: for common leverages, longs liquidate at entry*(1-1/lev), shorts at entry*(1+1/lev)
  // Using mark price as proxy for average entry
  const leverages = [2, 3, 5, 10, 20, 25, 50];
  const clusters = leverages.flatMap(lev => [
    {
      price: Math.round(markPx * (1 - 1 / lev) * 100) / 100,
      leverage: lev,
      side: 'long_liquidation',
      distance_pct: Math.round((1 / lev) * 1000) / 10,
    },
    {
      price: Math.round(markPx * (1 + 1 / lev) * 100) / 100,
      leverage: lev,
      side: 'short_liquidation',
      distance_pct: Math.round((1 / lev) * 1000) / 10,
    },
  ]).sort((a, b) => a.price - b.price);

  // Annotate with orderbook depth near each cluster
  const allLevels = [...(book?.levels?.[0] ?? []), ...(book?.levels?.[1] ?? [])];
  clusters.forEach((c: any) => {
    const nearby = allLevels.filter((l: any) => Math.abs(parseFloat(l.px) - c.price) / c.price < 0.005);
    (c as any).nearby_liquidity_sz = nearby.reduce((s: number, l: any) => s + parseFloat(l.sz), 0);
  });

  return { coin, mark_px: markPx, clusters };
}

export async function fetchOrderbookDepth(
  coin: string,
  sizeUsdc: number,
  side: 'buy' | 'sell',
): Promise<{
  coin: string;
  bid: number;
  ask: number;
  mid: number;
  spread_pct: number;
  depth_tiers: { tier_usd: number; bid_size: number; ask_size: number }[];
  order: {
    side: 'buy' | 'sell';
    size_usdc: number;
    avg_fill_price: number | null;
    slippage_pct: number | null;
    filled_usdc: number;
    levels_consumed: number;
    warning: string | null;
  };
}> {
  log.debug('fetchOrderbookDepth');
  const book = await getClient().l2Book({ coin, nSigFigs: 4 });
  const bids = (book?.levels?.[0] ?? []).map((l: { px: string; sz: string }) => ({ px: parseFloat(l.px), sz: parseFloat(l.sz) }));
  const asks = (book?.levels?.[1] ?? []).map((l: { px: string; sz: string }) => ({ px: parseFloat(l.px), sz: parseFloat(l.sz) }));
  if (!bids.length || !asks.length) throw new Error(`Empty orderbook for ${coin}`);

  const bid = bids[0].px;
  const ask = asks[0].px;
  const mid = (bid + ask) / 2;
  const spreadPct = ((ask - bid) / mid) * 100;

  const tiers = [100, 500, 1000, 5000];
  const depthTiers = tiers.map(tier => {
    let bidUsd = 0, bidSz = 0;
    for (const l of bids) { const u = l.px * l.sz; if (bidUsd + u > tier) { bidSz += (tier - bidUsd) / l.px; break; } bidUsd += u; bidSz += l.sz; }
    let askUsd = 0, askSz = 0;
    for (const l of asks) { const u = l.px * l.sz; if (askUsd + u > tier) { askSz += (tier - askUsd) / l.px; break; } askUsd += u; askSz += l.sz; }
    return { tier_usd: tier, bid_size: Math.round(bidSz * 10000) / 10000, ask_size: Math.round(askSz * 10000) / 10000 };
  });

  const levels = side === 'buy' ? asks : bids;
  let remaining = sizeUsdc;
  let totalSize = 0;
  let totalUsd = 0;
  let levelsConsumed = 0;
  for (const l of levels) {
    const usdAtLevel = l.px * l.sz;
    if (remaining <= usdAtLevel) {
      const sz = remaining / l.px;
      totalSize += sz;
      totalUsd += remaining;
      remaining = 0;
      levelsConsumed++;
      break;
    }
    totalSize += l.sz;
    totalUsd += usdAtLevel;
    remaining -= usdAtLevel;
    levelsConsumed++;
  }
  const avgFill = totalSize > 0 ? totalUsd / totalSize : null;
  const refPx = side === 'buy' ? ask : bid;
  const slippagePct = avgFill ? ((avgFill - refPx) / refPx) * 100 * (side === 'buy' ? 1 : -1) : null;
  const warning = remaining > 0
    ? `Insufficient depth — only ${Math.round((sizeUsdc - remaining))}$ available (${Math.round((1 - remaining / sizeUsdc) * 100)}% of order). Reduce size or use a limit order.`
    : slippagePct && slippagePct > 1 ? `High slippage (${slippagePct.toFixed(2)}%) — consider a limit order.` : null;

  return {
    coin,
    bid,
    ask,
    mid: Math.round(mid * 10000) / 10000,
    spread_pct: Math.round(spreadPct * 1000) / 1000,
    depth_tiers: depthTiers,
    order: {
      side,
      size_usdc: sizeUsdc,
      avg_fill_price: avgFill ? Math.round(avgFill * 10000) / 10000 : null,
      slippage_pct: slippagePct !== null ? Math.round(slippagePct * 1000) / 1000 : null,
      filled_usdc: Math.round(sizeUsdc - remaining),
      levels_consumed: levelsConsumed,
      warning,
    },
  };
}
