// src/sources/macro-liquidity.ts
//
// Free macro liquidity signals:
//   - ETF flows: scrape farside.co.uk public tables (HTML, no auth)
//   - Stablecoin mint/burn: Etherscan logs on USDT/USDC contracts
//
// All free. Etherscan free tier: 5 req/s without key, 100k/day with key.

import { createLogger } from '../core/logger.js';

const log = createLogger('sources:macro-liquidity');

const FARSIDE_BTC = 'https://farside.co.uk/btc/';
const FARSIDE_ETH = 'https://farside.co.uk/eth/';

// Etherscan v2 (multichain) — v1 was deprecated May 2025. Requires API key.
const ETHERSCAN = 'https://api.etherscan.io/v2/api?chainid=1';
const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY ?? '';

// Mainnet ERC-20 contracts
const USDT_CONTRACT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const USDC_CONTRACT = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

export interface EtfFlowSummary {
  asset: 'BTC' | 'ETH';
  last_day_net_usd_m: number | null;
  last_5d_net_usd_m: number | null;
  cumulative_aum_usd_m: number | null;
  date: string | null;
  source: string;
  warning?: string;
}

export interface StablecoinFlow {
  symbol: 'USDT' | 'USDC';
  net_minted_24h_usd_m: number;
  mint_events_24h: number;
  burn_events_24h: number;
  source: string;
  warning?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Farside ETF flows — parses the daily summary table at the bottom of the page
// ──────────────────────────────────────────────────────────────────────────────

function parseFarsideHtml(html: string): { dates: string[]; totals: number[] } {
  // The Farside page has a multi-row table with daily flows. We extract the
  // "Total" column. This is fragile to HTML changes — operators should keep
  // an eye on this.
  const dates: string[] = [];
  const totals: number[] = [];
  // Look for table rows that contain a date pattern (DD MMM YYYY)
  const rowRe = /<tr>([\s\S]*?)<\/tr>/g;
  for (const m of html.matchAll(rowRe)) {
    const row = m[1];
    // Date column is the first <td>; total column is typically last
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1].replace(/<[^>]+>/g, '').trim());
    if (cells.length < 5) continue;
    const dateCell = cells[0];
    if (!/\d{2}\s+\w+\s+\d{4}/.test(dateCell)) continue;
    const totalCell = cells[cells.length - 1].replace(/,/g, '');
    const total = parseFloat(totalCell);
    if (!Number.isFinite(total)) continue;
    dates.push(dateCell);
    totals.push(total);
  }
  return { dates, totals };
}

export async function fetchEtfFlows(asset: 'BTC' | 'ETH'): Promise<EtfFlowSummary> {
  const url = asset === 'BTC' ? FARSIDE_BTC : FARSIDE_ETH;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; predmcp/1.0; +https://predmcp.com)' },
    });
    if (!res.ok) {
      return { asset, last_day_net_usd_m: null, last_5d_net_usd_m: null, cumulative_aum_usd_m: null, date: null, source: 'farside', warning: 'Farside unreachable' };
    }
    const html = await res.text();
    const { dates, totals } = parseFarsideHtml(html);
    if (!totals.length) {
      return { asset, last_day_net_usd_m: null, last_5d_net_usd_m: null, cumulative_aum_usd_m: null, date: null, source: 'farside', warning: 'Could not parse Farside table — markup may have changed' };
    }
    const last = totals[totals.length - 1];
    const last5 = totals.slice(-5).reduce((s, x) => s + x, 0);
    const cumulative = totals.reduce((s, x) => s + x, 0);
    return {
      asset,
      last_day_net_usd_m: Math.round(last * 10) / 10,
      last_5d_net_usd_m: Math.round(last5 * 10) / 10,
      cumulative_aum_usd_m: Math.round(cumulative * 10) / 10,
      date: dates[dates.length - 1] ?? null,
      source: 'farside',
    };
  } catch (err) {
    log.debug('farside scrape failed');
    return { asset, last_day_net_usd_m: null, last_5d_net_usd_m: null, cumulative_aum_usd_m: null, date: null, source: 'farside', warning: 'Farside scrape failed (network error or HTML changed)' };
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Stablecoin mint/burn — Etherscan logs over the last 24h
// ──────────────────────────────────────────────────────────────────────────────

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

async function etherscanLogs(contract: string, fromBlock: number, toBlock: number): Promise<any[]> {
  const key = ETHERSCAN_KEY ? `&apikey=${ETHERSCAN_KEY}` : '';
  const url = `${ETHERSCAN}&module=logs&action=getLogs&address=${contract}&topic0=${TRANSFER_TOPIC}&fromBlock=${fromBlock}&toBlock=${toBlock}${key}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return [];
  const data = (await res.json()) as { result?: any[] };
  return Array.isArray(data.result) ? data.result : [];
}

async function ethereumLatestBlock(): Promise<number> {
  const key = ETHERSCAN_KEY ? `&apikey=${ETHERSCAN_KEY}` : '';
  const url = `${ETHERSCAN}&module=block&action=getblockcountdown&blockno=99999999999${key}`;
  // The simpler way: use proxy.eth_blockNumber
  const url2 = `${ETHERSCAN}&module=proxy&action=eth_blockNumber${key}`;
  const res = await fetch(url2, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return 0;
  const data = (await res.json()) as { result?: string };
  return data.result ? parseInt(data.result, 16) : 0;
}

export async function fetchStablecoinFlow(symbol: 'USDT' | 'USDC'): Promise<StablecoinFlow> {
  const contract = symbol === 'USDT' ? USDT_CONTRACT : USDC_CONTRACT;
  const decimals = 6; // Both USDT and USDC have 6 decimals
  try {
    const latest = await ethereumLatestBlock();
    if (!latest) return { symbol, net_minted_24h_usd_m: 0, mint_events_24h: 0, burn_events_24h: 0, source: 'etherscan', warning: 'Could not fetch latest block' };
    // Average 12s per Ethereum block → 24h ≈ 7200 blocks
    const fromBlock = latest - 7200;
    const logs = await etherscanLogs(contract, fromBlock, latest);
    let mintCount = 0, burnCount = 0;
    let netUsd = 0;
    for (const lg of logs) {
      // topics[1] = from, topics[2] = to (both padded to 32 bytes)
      const from = lg.topics?.[1];
      const to = lg.topics?.[2];
      if (!from || !to) continue;
      const ZERO = '0x0000000000000000000000000000000000000000000000000000000000000000';
      const value = lg.data ? parseInt(lg.data, 16) / 10 ** decimals : 0;
      if (from === ZERO) { mintCount++; netUsd += value; }       // mint
      else if (to === ZERO) { burnCount++; netUsd -= value; }    // burn
    }
    return {
      symbol,
      net_minted_24h_usd_m: Math.round((netUsd / 1_000_000) * 10) / 10,
      mint_events_24h: mintCount,
      burn_events_24h: burnCount,
      source: 'etherscan' + (ETHERSCAN_KEY ? ':keyed' : ':anonymous'),
    };
  } catch (err) {
    log.debug('etherscan stablecoin fetch failed');
    return { symbol, net_minted_24h_usd_m: 0, mint_events_24h: 0, burn_events_24h: 0, source: 'etherscan', warning: 'Etherscan fetch failed' };
  }
}
