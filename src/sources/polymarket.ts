import { ClobClient } from '@polymarket/clob-client';
import { createLogger } from '../core/logger.js';

const log = createLogger('sources:polymarket');
const CLOB_HOST = 'https://clob.polymarket.com';
const GAMMA_HOST = 'https://gamma-api.polymarket.com';
const CHAIN_ID = 137;

let _client: ClobClient | null = null;

function getClient(): ClobClient {
  if (!_client) _client = new ClobClient(CLOB_HOST, CHAIN_ID);
  return _client;
}

export interface PolymarketToken {
  token_id: string;
  outcome: string;
  price: number;
}

export interface PolymarketMarket {
  condition_id: string;
  question: string;
  description: string;
  end_date_iso: string;
  tokens: PolymarketToken[];
  volume: number;
  active: boolean;
}

interface GammaMarket {
  conditionId: string;
  question: string;
  description: string;
  endDateIso: string;
  clobTokenIds: string;
  outcomes: string;
  outcomePrices: string;
  volumeClob: number;
  volume24hrClob: number;
  oneDayPriceChange: number | null;
  lastTradePrice: number;
  active: boolean;
  closed: boolean;
}

export async function fetchMarkets(params?: {
  limit?: number;
  active?: boolean;
  next_cursor?: string;
}): Promise<PolymarketMarket[]> {
  log.debug('fetchMarkets');
  const limit = params?.limit ?? 20;
  const active = params?.active !== false;
  const url = `${GAMMA_HOST}/markets?closed=false&active=${active}&order=volumeClob&ascending=false&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gamma API error: ${res.status} ${res.statusText}`);
  const data = (await res.json()) as GammaMarket[];

  return data.map(m => {
    const tokenIds: string[] = JSON.parse(m.clobTokenIds || '[]');
    const outcomes: string[] = JSON.parse(m.outcomes || '[]');
    const prices: string[] = JSON.parse(m.outcomePrices || '[]');
    const tokens: PolymarketToken[] = tokenIds.map((id, i) => ({
      token_id: id,
      outcome: outcomes[i] ?? '',
      price: parseFloat(prices[i] ?? '0'),
    }));
    return {
      condition_id: m.conditionId,
      question: m.question,
      description: m.description ?? '',
      end_date_iso: m.endDateIso,
      tokens,
      volume: m.volumeClob ?? 0,
      active: m.active,
    };
  });
}

export async function fetchOdds(tokenIds: string[]): Promise<Record<string, number>> {
  log.debug('fetchOdds');
  const client = getClient();
  const results: Record<string, number> = {};
  await Promise.all(
    tokenIds.map(async tokenId => {
      try {
        // @ts-ignore — SDK returns any
        const price = await client.getLastTradePrice(tokenId);
        results[tokenId] = parseFloat(price.price ?? '0');
      } catch (err) {
        log.warn('fetchOdds: price fetch failed', { tokenId, err });
        results[tokenId] = 0;
      }
    })
  );
  return results;
}

export async function fetchOrderbook(tokenId: string) {
  log.debug('fetchOrderbook');
  return getClient().getOrderBook(tokenId);
}

export async function fetchWhalePositions(conditionId: string, minSizeUsdc = 1000): Promise<unknown[]> {
  log.debug('fetchWhalePositions');
  const url = `https://data-api.polymarket.com/positions?condition_id=${encodeURIComponent(conditionId)}&size_min=${minSizeUsdc}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Polymarket data API error: ${res.status} ${res.statusText}`);
  return res.json() as Promise<unknown[]>;
}

export interface PolymarketMover {
  condition_id: string;
  question: string;
  end_date_iso: string;
  volume_24h: number;
  volume_total: number;
  price_change_24h: number | null;
  last_price: number;
}

const MOVERS_FETCH_BATCH = 50; // fetch more than max limit to have candidates for price_movers

export async function fetchMovers(params?: { limit?: number }): Promise<{ volume_movers: PolymarketMover[]; price_movers: PolymarketMover[] }> {
  log.debug('fetchMovers');
  const limit = params?.limit ?? 10;
  const url = `${GAMMA_HOST}/markets?closed=false&active=true&order=volume24hrClob&ascending=false&limit=${MOVERS_FETCH_BATCH}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gamma API error: ${res.status} ${res.statusText}`);
  const data = (await res.json()) as GammaMarket[];

  const all: PolymarketMover[] = data.map(m => ({
    condition_id: m.conditionId,
    question: m.question,
    end_date_iso: m.endDateIso,
    volume_24h: m.volume24hrClob ?? 0,
    volume_total: m.volumeClob ?? 0,
    price_change_24h: m.oneDayPriceChange ?? null,
    last_price: m.lastTradePrice ?? 0,
  }));

  const volume_movers = all.slice(0, limit);
  const price_movers = all
    .filter((m): m is PolymarketMover & { price_change_24h: number } => m.price_change_24h !== null)
    .sort((a, b) => Math.abs(b.price_change_24h) - Math.abs(a.price_change_24h))
    .slice(0, limit);

  return { volume_movers, price_movers };
}

interface GammaMarketFull extends GammaMarket {
  volume1wkClob: number;
  volume1moClob: number;
  category?: string;
  events?: { id: string; title: string; category?: string }[];
}

export interface MarketNearResolution {
  condition_id: string;
  question: string;
  end_date_iso: string;
  hours_remaining: number;
  yes_price: number;
  no_price: number;
  volume: number;
  certainty: number;
}

export async function fetchMarketsNearResolution(hours = 24, minProb = 0.7): Promise<MarketNearResolution[]> {
  log.debug('fetchMarketsNearResolution');
  const now = Date.now();
  const cutoff = now + hours * 3600 * 1000;
  const url = `${GAMMA_HOST}/markets?closed=false&active=true&order=volumeClob&ascending=false&limit=200`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gamma API error: ${res.status}`);
  const data = (await res.json()) as GammaMarket[];

  return data
    .filter(m => {
      const end = new Date(m.endDateIso).getTime();
      return end > now && end <= cutoff;
    })
    .map(m => {
      const tokenIds: string[] = JSON.parse(m.clobTokenIds || '[]');
      const prices: string[] = JSON.parse(m.outcomePrices || '[]');
      const yesPrice = parseFloat(prices[0] ?? '0');
      const noPrice = parseFloat(prices[1] ?? '0');
      const certainty = Math.max(yesPrice, noPrice);
      const end = new Date(m.endDateIso).getTime();
      return { condition_id: m.conditionId, question: m.question, end_date_iso: m.endDateIso, hours_remaining: Math.round((end - now) / 3600000 * 10) / 10, yes_price: yesPrice, no_price: noPrice, volume: m.volumeClob ?? 0, certainty };
    })
    .filter(m => m.certainty >= minProb)
    .sort((a, b) => b.certainty - a.certainty);
}

export interface VolumeSpike {
  condition_id: string;
  question: string;
  end_date_iso: string;
  volume_24h: number;
  volume_7d_avg: number;
  spike_ratio: number;
  yes_price: number;
}

export async function fetchVolumeSpikes(minRatio = 3, limit = 20): Promise<VolumeSpike[]> {
  log.debug('fetchVolumeSpikes');
  const url = `${GAMMA_HOST}/markets?closed=false&active=true&order=volume24hrClob&ascending=false&limit=100`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gamma API error: ${res.status}`);
  const data = (await res.json()) as GammaMarketFull[];

  return data
    .map(m => {
      const vol24h = m.volume24hrClob ?? 0;
      const vol7d = m.volume1wkClob ?? 0;
      const avg7d = vol7d / 7;
      const ratio = avg7d > 0 ? vol24h / avg7d : 0;
      const prices: string[] = JSON.parse(m.outcomePrices || '[]');
      return { condition_id: m.conditionId, question: m.question, end_date_iso: m.endDateIso, volume_24h: vol24h, volume_7d_avg: Math.round(avg7d), spike_ratio: Math.round(ratio * 10) / 10, yes_price: parseFloat(prices[0] ?? '0') };
    })
    .filter(m => m.spike_ratio >= minRatio && m.volume_24h > 1000)
    .sort((a, b) => b.spike_ratio - a.spike_ratio)
    .slice(0, limit);
}

export interface LateGameSport {
  condition_id: string;
  question: string;
  end_date_iso: string;
  hours_remaining: number;
  leading_outcome: string;
  leading_price: number;
  volume: number;
}

export async function fetchLateGameSports(certaintyPct = 85, hoursMax = 6): Promise<LateGameSport[]> {
  log.debug('fetchLateGameSports');
  const now = Date.now();
  const cutoff = now + hoursMax * 3600 * 1000;
  const certainty = certaintyPct / 100;
  // Fetch sports category markets
  const url = `${GAMMA_HOST}/markets?closed=false&active=true&order=volumeClob&ascending=false&limit=200&category=sports`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gamma API error: ${res.status}`);
  const data = (await res.json()) as GammaMarket[];

  return data
    .filter(m => {
      const end = new Date(m.endDateIso).getTime();
      return end > now && end <= cutoff;
    })
    .map(m => {
      const outcomes: string[] = JSON.parse(m.outcomes || '[]');
      const prices: string[] = JSON.parse(m.outcomePrices || '[]');
      const yesPrice = parseFloat(prices[0] ?? '0');
      const noPrice = parseFloat(prices[1] ?? '0');
      const end = new Date(m.endDateIso).getTime();
      const [leadingOutcome, leadingPrice] = yesPrice >= noPrice ? [outcomes[0] ?? 'Yes', yesPrice] : [outcomes[1] ?? 'No', noPrice];
      return { condition_id: m.conditionId, question: m.question, end_date_iso: m.endDateIso, hours_remaining: Math.round((end - now) / 3600000 * 10) / 10, leading_outcome: leadingOutcome, leading_price: leadingPrice, volume: m.volumeClob ?? 0 };
    })
    .filter(m => m.leading_price >= certainty)
    .sort((a, b) => b.leading_price - a.leading_price);
}
