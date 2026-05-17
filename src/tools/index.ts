// src/tools/index.ts
//
// Public tool registration. Private/premium tools live in ./private/
// (gitignored) and are loaded dynamically if present.
//
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createApiKeySchema, createApiKeyHandler } from './create-api-key.js';
import { getOrderbookDepthSchema, getOrderbookDepthHandler } from './get-orderbook-depth.js';
import { getTopFundingRatesSchema, getTopFundingRatesHandler } from './get-top-funding-rates.js';
import { getOiNearCapSchema, getOiNearCapHandler } from './get-oi-near-cap.js';
import { getMarketsNearResolutionSchema, getMarketsNearResolutionHandler } from './get-markets-near-resolution.js';
import { getVolumeSpikesSchema, getVolumeSpikesHandler } from './get-volume-spikes.js';
import { getLateGameSportsSchema, getLateGameSportsHandler } from './get-late-game-sports.js';
import { getMarketsSchema, getMarketsHandler } from './get-markets.js';
import { getOddsSchema, getOddsHandler } from './get-odds.js';
import { getOrderbookSchema, getOrderbookHandler } from './get-orderbook.js';
import { getWhalePositionsSchema, getWhalePositionsHandler } from './get-whale-positions.js';
import { getFundingRatesSchema, getFundingRatesHandler } from './get-funding-rates.js';
import { getOpenInterestSchema, getOpenInterestHandler } from './get-open-interest.js';
import { getWhaleTradesSchema, getWhaleTradesHandler } from './get-whale-trades.js';
import { searchMarketsSchema, searchMarketsHandler } from './search-markets.js';
import { getMoversSchema, getMoversHandler } from './get-movers.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('tools');

const RO = { readOnlyHint: true, openWorldHint: true } as const;

export async function registerAllTools(server: McpServer): Promise<void> {
  // ── Public: account ─────────────────────────────────────────────────────────
  server.registerTool('create_api_key', {
    title: 'Create API Key',
    description: 'Generate a free PredMCP API key. Requires an email. Returns the key and ready-to-use MCP config. Free tier: 100 calls/day, one key per IP.',
    inputSchema: { email: createApiKeySchema.email },
    annotations: { readOnlyHint: false, openWorldHint: false },
  }, createApiKeyHandler);

  // ── Public: Polymarket ──────────────────────────────────────────────────────
  server.registerTool('get_markets', {
    title: 'Get Markets',
    description: 'Live prediction markets from Polymarket and/or HIP-4, sorted by volume. Returns title, YES/NO prices, 24h volume, and expiry.',
    inputSchema: {
      platform: z.enum(['polymarket', 'hip4', 'all']).optional().default('all').describe('Data source: "polymarket", "hip4", or "all" (default)'),
      limit: z.number().int().min(1).max(100).optional().default(20).describe('Number of markets to return (1–100, default: 20)'),
      active: z.boolean().optional().default(true).describe('Filter to active/open markets only (default: true)'),
    },
    annotations: RO,
  }, getMarketsHandler);

  server.registerTool('get_odds', {
    title: 'Get Odds',
    description: 'Current YES/NO prices and implied probability for any Polymarket or HIP-4 market token.',
    inputSchema: {
      platform: z.enum(['polymarket', 'hip4']).describe('Platform the market is on: "polymarket" or "hip4"'),
      identifier: z.string().describe('For Polymarket: the token_id of the YES or NO outcome. For HIP-4: the base asset ticker (e.g. "BTC")'),
    },
    annotations: RO,
  }, getOddsHandler);

  server.registerTool('get_orderbook', {
    title: 'Get Orderbook',
    description: 'Full orderbook depth (bids + asks) for any Polymarket market token. Shows liquidity at each price level.',
    inputSchema: {
      token_id: z.string().describe('Polymarket token ID for the YES or NO side of a market'),
    },
    annotations: RO,
  }, getOrderbookHandler);

  server.registerTool('search_markets', {
    title: 'Search Markets',
    description: 'Full-text search across all Polymarket and HIP-4 prediction markets. Returns ranked results with current odds.',
    inputSchema: {
      query: z.string().describe('Keywords to search in market names and descriptions, e.g. "bitcoin ETF", "US election", "Fed pivot"'),
      limit: z.number().int().min(1).max(50).optional().default(10).describe('Maximum number of results to return (1–50, default: 10)'),
    },
    annotations: RO,
  }, searchMarketsHandler);

  server.registerTool('get_whale_positions', {
    title: 'Get Whale Positions',
    description: 'Largest current position holders in a Polymarket prediction market. Shows wallet address, position size in USDC, and side (YES/NO).',
    inputSchema: {
      condition_id: z.string().describe('Polymarket condition ID for the market to inspect'),
      min_size_usdc: z.number().optional().default(1000).describe('Minimum position size in USDC to include in results (default: 1,000)'),
    },
    annotations: RO,
  }, getWhalePositionsHandler);

  server.registerTool('get_movers', {
    title: 'Get Movers',
    description: 'Top prediction markets ranked by 24h volume spike or biggest YES/NO price swing. Surfaces breaking news bets and momentum plays across Polymarket and HIP-4.',
    inputSchema: {
      limit: z.number().int().min(1).max(20).optional().default(10).describe('Number of top movers to return (1–20, default: 10)'),
    },
    annotations: RO,
  }, getMoversHandler);

  server.registerTool('get_markets_near_resolution', {
    title: 'Get Markets Near Resolution',
    description: 'Polymarket markets resolving within the next N hours with a leading probability above threshold. Useful for resolution arbitrage and last-minute positioning.',
    inputSchema: {
      hours: getMarketsNearResolutionSchema.hours,
      min_prob: getMarketsNearResolutionSchema.min_prob,
    },
    annotations: RO,
  }, getMarketsNearResolutionHandler);

  server.registerTool('get_volume_spikes', {
    title: 'Get Volume Spikes',
    description: 'Polymarket markets with abnormal 24h volume vs their 7-day daily average. Volume spikes typically precede news events or informed positioning.',
    inputSchema: {
      min_ratio: getVolumeSpikesSchema.min_ratio,
      limit: getVolumeSpikesSchema.limit,
    },
    annotations: RO,
  }, getVolumeSpikesHandler);

  server.registerTool('get_late_game_sports', {
    title: 'Get Late Game Sports',
    description: 'Sports prediction markets on Polymarket closing within a few hours with a high-certainty leading outcome. Targets near-certain resolution for late-game positioning.',
    inputSchema: {
      certainty_pct: getLateGameSportsSchema.certainty_pct,
      hours_max: getLateGameSportsSchema.hours_max,
    },
    annotations: RO,
  }, getLateGameSportsHandler);

  // ── Public: Hyperliquid ─────────────────────────────────────────────────────
  server.registerTool('get_funding_rates', {
    title: 'Get Funding Rates',
    description: 'Current funding rates for Hyperliquid perpetuals. Positive rate = longs pay shorts (bearish bias); negative = shorts pay longs (bullish bias).',
    inputSchema: {
      coins: z.array(z.string()).optional().describe('List of asset tickers to fetch, e.g. ["BTC", "ETH"]. Omit to fetch all available assets.'),
    },
    annotations: RO,
  }, getFundingRatesHandler);

  server.registerTool('get_open_interest', {
    title: 'Get Open Interest',
    description: 'Total open interest in USD and contracts for Hyperliquid perpetuals. Rising OI + rising price = strong trend; rising OI + falling price = short build-up.',
    inputSchema: {
      coins: z.array(z.string()).optional().describe('List of asset tickers to fetch, e.g. ["BTC", "SOL"]. Omit to fetch all available assets.'),
    },
    annotations: RO,
  }, getOpenInterestHandler);

  server.registerTool('get_whale_trades', {
    title: 'Get Whale Trades',
    description: 'Recent large trades on Hyperliquid perps above a notional threshold. Includes side (long/short), size, price, and timestamp.',
    inputSchema: {
      coin: z.string().describe('Asset ticker to fetch whale trades for, e.g. "BTC", "ETH"'),
      min_notional_usdc: z.number().optional().default(50000).describe('Minimum trade size in USDC to qualify as a whale trade (default: 50,000)'),
    },
    annotations: RO,
  }, getWhaleTradesHandler);

  server.registerTool('get_top_funding_rates', {
    title: 'Get Top Funding Rates',
    description: 'Top Hyperliquid perps ranked by absolute funding rate, with OI and annualized yield. Useful for finding the most overcrowded longs/shorts and carry opportunities.',
    inputSchema: {
      limit: getTopFundingRatesSchema.limit,
      min_abs_rate: getTopFundingRatesSchema.min_abs_rate,
    },
    annotations: RO,
  }, getTopFundingRatesHandler);

  server.registerTool('get_oi_near_cap', {
    title: 'Get OI Near Cap',
    description: 'Lists Hyperliquid perps that are currently at the open interest cap — new long positions cannot be opened. Use as a blacklist to avoid getting rejected on entry.',
    inputSchema: getOiNearCapSchema,
    annotations: RO,
  }, getOiNearCapHandler);

  server.registerTool('get_orderbook_depth', {
    title: 'Get Orderbook Depth',
    description: 'Full orderbook depth + slippage estimate for any Hyperliquid perp or HIP-4 market. Returns top of book, spread, cumulative depth at $100/$500/$1k/$5k tiers, and estimated slippage for a given order size. Critical for HIP-4 farming and low-liquidity assets where market orders get destroyed by slippage.',
    inputSchema: getOrderbookDepthSchema,
    annotations: RO,
  }, getOrderbookDepthHandler);

  // ── Private/premium tools (loaded if ./private/index.ts exists, gitignored) ──
  try {
    const priv = await import('./private/index.js');
    if (typeof priv.registerPrivateTools === 'function') {
      await priv.registerPrivateTools(server);
      log.info('Private tools loaded');
    }
  } catch (err) {
    log.debug('No private tools (OK for OSS builds)', { err: err instanceof Error ? err.message : String(err) });
  }
}
