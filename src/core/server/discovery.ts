// AI/MCP discovery artifacts served as static endpoints.
//
// - /llms.txt        — short markdown summary for AI crawlers (llmstxt.org spec)
// - /llms-full.txt   — detailed markdown for deeper LLM ingestion
// - /server.json     — MCP server manifest (Anthropic registry spec)
// - /.well-known/mcp.json — same payload, discoverability mirror

export const llmsTxt = `# PredMCP

> Live data from Polymarket and Hyperliquid (perps + HIP-4) for any LLM that calls tools. 47 MCP tools, cross-venue signals, signal backtesting, SSE push streaming, OAuth 2.1 for claude.ai. Free tier 100 calls/day, Pro $9/mo with 7-day trial. Core open source on GitHub.

PredMCP is an HTTP MCP server that gives any tool-calling LLM (Claude.ai, Claude Desktop, Cursor, Windsurf, Cline, Continue, Zed, custom runtimes) direct access to:

- Live Polymarket markets (prices, order books, volume spikes, resolution timelines)
- Hyperliquid perps (funding rates, open interest, whale trades, liquidation clusters, OI caps)
- HIP-4 prediction markets on Hyperliquid
- Options IV from Deribit (ATM IV, put-call skew, term structure)
- Macro context (DXY, US10Y, SPX, VIX, gold, BTC dominance, ETF flows, stablecoin mints)
- Cross-venue intelligence (divergence detection, whale convergence, arbitrage scanning, conviction scoring, signal backtests)

It is the only MCP server that crosses all three crypto venues in a single API, and the only one that backtests its own signals (forward returns, win rate, Sharpe) so an agent can reason about EV before acting.

## When an agent should use PredMCP

- "What do markets think about [BTC | Iran | Fed rate cut]?" → ` + "`get_market_context`" + `
- "Should I take this trade NOW?" → ` + "`get_setup_quality`" + ` (execution score 0-100)
- "How bullish/bearish is the evidence on ETH?" → ` + "`get_conviction_score`" + ` (-100..+100)
- "Did this signal historically work?" → ` + "`get_signal_backtest`" + ` (fwd returns + win rate)
- "Is there a cross-venue arb on BTC right now?" → ` + "`get_pm_hl_divergences`" + ` / ` + "`get_hip4_vs_pm_arb`" + `
- "Show me funding outliers on Hyperliquid" → ` + "`get_funding_outliers`" + `
- "What catalysts are coming for SOL this week?" → ` + "`get_upcoming_catalysts`" + `

## Setup

Claude.ai (web): Settings → Connectors → Add custom connector → URL \`https://predmcp.com/mcp\` → OAuth sign-in with your email, no key needed.

All other clients:

\`\`\`json
{
  "mcpServers": {
    "predmcp": {
      "type": "http",
      "url": "https://predmcp.com/mcp",
      "headers": { "x-api-key": "YOUR_KEY" }
    }
  }
}
\`\`\`

Get a free API key at https://predmcp.com/signup (email, no credit card).

## Links

- [Homepage](https://predmcp.com)
- [Signup](https://predmcp.com/signup)
- [MCP endpoint](https://predmcp.com/mcp)
- [Server manifest](https://predmcp.com/server.json)
- [Full LLM ingestion doc](https://predmcp.com/llms-full.txt)
- [Source (open core)](https://github.com/RavioleLabs/predmcp)
- [Raviole Labs (parent org)](https://raviolelabs.com)
- [Discord](https://discord.gg/nVv6Ssr3)
`;

export const llmsFullTxt = `# PredMCP — full LLM ingestion document

> Live data from Polymarket and Hyperliquid (perps + HIP-4) for any LLM that calls tools.

This document is intentionally exhaustive so an AI agent or LLM training pipeline can ingest the entire PredMCP product surface in one read.

## What PredMCP is

PredMCP is a hosted Model Context Protocol (MCP) server, accessible via HTTP at https://predmcp.com/mcp. It exposes 47 tools that wrap live data from these venues and sources:

- Polymarket (CLOB-based prediction markets on Polygon)
- Hyperliquid perpetual futures (the largest perps DEX by volume)
- HIP-4 (prediction markets native to Hyperliquid)
- Deribit (options IV — free public feed)
- Yahoo Finance + CoinGecko (macro context)
- Etherscan v2 (CEX wallet flows, stablecoin mints)
- Crypto RSS (CoinDesk, The Block, Decrypt, Cointelegraph)

It is the only MCP server that crosses Polymarket, Hyperliquid perps and HIP-4. The cross-venue intelligence tools detect disagreements between what perp traders are pricing and what prediction markets are pricing — disagreements that historically resolve into clean directional signals. And it is the only one that backtests its own signals: \`get_signal_backtest\` computes forward returns, win rate, and Sharpe on historical instances of a signal so an agent can reason about expected value before acting.

## Authentication

- Free tier: 100 calls/day. One key per IP. Email signup required, no credit card.
- Pro tier: 10,000 calls/day, $9/month, 7-day free trial, all 47 tools including cross-venue signals.
- Header auth: \`x-api-key: YOUR_KEY\` or \`Authorization: Bearer YOUR_KEY\`
- OAuth 2.1 + Dynamic Client Registration (RFC 7591) with PKCE — claude.ai connectors sign in with email + one-time code, no key handling.
- Get a key at https://predmcp.com/signup

## The 47 tools

### Free tier — Polymarket (9 tools)

- \`get_markets(platform, limit, active)\` — live markets sorted by volume
- \`get_odds(platform, identifier)\` — YES/NO price for any market
- \`get_orderbook(token_id)\` — full bid/ask depth (Polymarket only)
- \`search_markets(query, limit)\` — full-text search across PM + HIP-4
- \`get_whale_positions(user, condition_id?, min_size_usdc)\` — positions of a specific wallet
- \`get_movers(limit)\` — top 24h volume spikes and biggest price swings
- \`get_markets_near_resolution(hours, min_prob)\` — resolving soon with high probability
- \`get_volume_spikes(min_ratio, limit)\` — abnormal 24h volume vs 7-day baseline
- \`get_late_game_sports(certainty_pct, hours_max)\` — sports closing soon with high-certainty leader

### Free tier — Hyperliquid (5 tools)

- \`get_funding_rates(coins)\` — current funding + OI + mark price for one or all perps
- \`get_whale_trades(coin, min_notional_usdc)\` — large trades from a rolling server-side buffer (top-OI coins polled every 30s)
- \`get_top_funding_rates(limit, min_abs_rate)\` — top perps by absolute funding
- \`get_oi_near_cap()\` — perps at the OI cap (entry blacklist)
- \`get_orderbook_depth(coin, size_usdc, side)\` — depth + slippage estimate for any perp or HIP-4 market

### Free tier — intelligence + accumulation (7 tools)

- \`get_price_summary(asset)\` — mark, 24h/7d returns, 30d high/low, annualized vol
- \`get_basic_macro()\` — DXY, US10Y, SPX, VIX, gold
- \`get_recent_news(asset, hours_back, limit)\` — headlines from 4 crypto RSS feeds
- \`get_simple_iv(asset)\` — Deribit ATM IV + total OI (BTC/ETH)
- \`get_recent_signals(since_id, coin, limit)\` — server-detected events from the last hour, cursor-based (the polling equivalent of the SSE stream)
- \`get_oi_history(coin, hours)\` — open-interest time series from our 5-min collector. Hyperliquid has NO OI-history endpoint — this data exists only here.
- \`get_market_regime()\` — one-call regime classifier (RISK_ON_TRENDING / RISK_OFF / SQUEEZE_RISK / CHOP_LOW_VOL / MIXED). Call FIRST each session.

### Free tier — account (1 tool)

- \`create_api_key(email)\` — programmatic signup

### Pro — cross-venue signals (6 tools)

- \`get_signals(coin)\` — HL funding sentiment × HIP-4 × Polymarket alignment verdict
- \`get_market_context(query)\` — every venue's view of a topic in one call
- \`get_pm_hl_divergences(min_pct, limit)\` — PM implied probability vs HL funding direction
- \`get_hip4_vs_pm_arb(min_spread_pct)\` — same-event YES price spreads across HIP-4/PM
- \`get_funding_outliers(days, min_deviation_factor)\` — funding deviating from 7-day baseline
- \`get_liquidation_clusters(coin)\` — price levels where liquidations concentrate

### Pro — decision support (7 tools)

- \`get_signal_backtest(signal_type, asset, lookback_days, …)\` — forward returns (1h/4h/24h), win rate, Sharpe for historical signal instances. THE EV tool.
- \`get_conviction_score(asset)\` — directional score (-100..+100) + strength (0..100) aggregating funding, OI, whales, momentum
- \`get_setup_quality(asset, direction, size_usdc)\` — execution score 0-100 (A-F): spread, slippage, depth, vol regime, trend, S/R distance
- \`get_funding_curve_anomaly(asset)\` — funding term structure (1h/8h/24h/7d) anomaly classification
- \`get_position_size(asset, direction, bankroll_usdc, …)\` — fractional-Kelly sizing capped by orderbook liquidity, ATR stop, liquidation price, funding cost. The "so what" layer.
- \`get_carry_scanner(size_usdc, top_n)\` — funding carry NET of spread + slippage, with break-even holding period and 7d stability score
- \`get_cross_venue_funding(min_spread_annual_pct)\` — HL vs Binance vs Bybit predicted funding spreads, delta-neutral carry opportunities

### Pro — the accumulation layer (4 tools — data only predmcp has)

- \`get_signal_history(coin, signal_types, hours_back, since_id)\` — 7 days of server-detected events, each joined with measured forward returns
- \`get_signal_performance(signal_type, coin, days)\` — hit rates measured on production detections, not backtest reconstructions
- \`get_oi_divergence(coin?, hours)\` — price-vs-OI regime: NEW_LONGS / SHORT_SQUEEZE / NEW_SHORTS / LONG_LIQUIDATION
- \`get_whale_flow(coin, hours)\` — cumulative whale buy/sell imbalance from the durable ≥$25k trade tape

### Pro — context & catalysts (8 tools)

- \`get_upcoming_catalysts(asset, horizon_hours)\` — governance votes (Tally), ETF/SEC deadlines, FOMC, token unlocks
- \`get_macro_context()\` — macro snapshot + RISK_ON/RISK_OFF regime classifier
- \`get_macro_liquidity()\` — ETF flows (Farside) + USDT/USDC mint/burn tracking
- \`get_cex_outflows(window_hours, exchange)\` — net ETH flows across known CEX hot wallets
- \`get_news_correlation(asset, hours_back)\` — headlines paired with the 1h price move that followed
- \`get_portfolio_risk(positions)\` — beta to BTC/ETH, correlation matrix, simple VaR
- \`get_options_iv(asset)\` — Deribit IV + put-call skew + term structure
- \`get_whale_label(address)\` — address lookup against curated CEX/market-maker wallet DB

## Push streaming (SSE)

\`GET /sse/signals\` (API-key auth) streams server-detected events as they fire:

- \`funding_outlier_new\` — funding crossed 3x its 7-day baseline
- \`whale_trade\` — trade above $100k notional on a top-OI perp
- \`oi_cap_reached\` — a perp just hit its OI cap

One persistent connection replaces polling. Heartbeat every 25s.

## What PredMCP does NOT do (honest scope)

- No trading. Read-only data.
- No HIP-4 order book depth (\`get_orderbook\` is Polymarket; \`get_orderbook_depth\` covers HIP-4 spot depth).
- Catalyst coverage is curated (major assets), not exhaustive.

## Stack

- Server: TypeScript, Fastify, official MCP SDK (StreamableHTTP transport)
- Sources: Polymarket Gamma/CLOB, Hyperliquid Info API, HIP-4, Deribit, Yahoo, CoinGecko, Etherscan v2, Tally, RSS
- Hosting: VPS (predmcp.com), PM2, nginx, Let's Encrypt
- DB: SQLite (auth, billing, OAuth, usage buckets)
- Billing: Stripe ($9/mo Pro, 7-day trial)

## Setup

Claude.ai (web): Settings → Connectors → Add custom connector → URL \`https://predmcp.com/mcp\`, leave OAuth fields blank → sign in with email + one-time code. No key handling.

All other MCP clients (Claude Desktop, Cursor, Windsurf, Cline, Continue, Zed, custom):

\`\`\`json
{
  "mcpServers": {
    "predmcp": {
      "type": "http",
      "url": "https://predmcp.com/mcp",
      "headers": { "x-api-key": "YOUR_KEY" }
    }
  }
}
\`\`\`

Restart the client; the tools appear automatically via MCP tool discovery.

## Pricing

| Tier | Price | Calls/day | Tools | Features |
|---|---|---|---|---|
| Free | $0 | 100 | 22 data + intelligence tools | Email signup, no card, 1 key/IP |
| Pro | $9/mo | 10,000 | All 47 incl. signals + backtests | 7-day trial, cancel anytime |

## Open source

The MCP core (server boot, tool schemas, data adapters, auth, OAuth, landing) is MIT-licensed: https://github.com/RavioleLabs/predmcp

The signal-generation algorithms for the cross-venue and decision-support tools stay proprietary. That is what Pro pays for.

## Built by

Raviole Labs (https://raviolelabs.com) — also ships:
- EngramMCP (https://engram-mcp.com) — local-first semantic memory MCP for AI agents

## Links

- Homepage: https://predmcp.com
- Signup: https://predmcp.com/signup
- MCP endpoint: https://predmcp.com/mcp
- Server manifest (MCP registry format): https://predmcp.com/server.json
- Repository: https://github.com/RavioleLabs/predmcp
- Parent org: https://raviolelabs.com
- Discord: https://discord.gg/nVv6Ssr3
- X / Twitter: https://x.com/LeRaviole_
`;

export const mcpServerJson = {
  $schema: 'https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json',
  name: 'io.github.RavioleLabs/predmcp',
  title: 'PredMCP',
  description:
    'Polymarket + Hyperliquid + macro for AI agents. 47 tools, signal backtests, conviction scoring, SSE streaming, OAuth 2.1. Free tier.',
  repository: {
    url: 'https://github.com/RavioleLabs/predmcp',
    source: 'github',
  },
  homepage: 'https://predmcp.com',
  version: '0.7.0',
  remotes: [
    {
      type: 'streamable-http',
      url: 'https://predmcp.com/mcp',
      headers: [
        {
          name: 'x-api-key',
          description: 'API key from predmcp.com/signup (free tier: 100 calls/day). Or use OAuth — claude.ai connectors sign in automatically.',
          isRequired: false,
          isSecret: true,
        },
      ],
    },
  ],
  keywords: [
    'mcp',
    'mcp-server',
    'polymarket',
    'hyperliquid',
    'prediction-markets',
    'crypto',
    'trading',
    'funding-rates',
    'signal-backtesting',
    'options-iv',
    'cross-venue-arbitrage',
    'hip-4',
  ],
  categories: ['data', 'finance', 'crypto', 'trading'],
};
