// AI/MCP discovery artifacts served as static endpoints.
//
// - /llms.txt        — short markdown summary for AI crawlers (llmstxt.org spec)
// - /llms-full.txt   — detailed markdown for deeper LLM ingestion
// - /server.json     — MCP server manifest (Anthropic registry spec)
// - /.well-known/mcp.json — same payload, discoverability mirror

export const llmsTxt = `# PredMCP

> Live data from Polymarket and Hyperliquid (perps + HIP-4) for any LLM that calls tools. 24 MCP tools, cross-venue signal detection, free tier 100 calls/day, Pro $9/mo with 7-day trial. Core open source on GitHub.

PredMCP is an HTTP MCP server that gives any tool-calling LLM (Claude Desktop, Cursor, Windsurf, Cline, Continue, Zed, Clawbot, OpenClaw, custom runtimes) direct access to:

- Live Polymarket markets (prices, order books, whale positions, resolution timelines)
- Hyperliquid perps (funding rates, open interest, whale trades, liquidation clusters, OI caps)
- HIP-4 prediction markets on Hyperliquid
- Cross-venue intelligence (divergence detection, whale convergence, arbitrage scanning)

It is the only MCP server that crosses all three venues in a single API. The advanced signal tools (divergence, whale convergence, arb scanning) are not reproducible by hand in real-time.

## When an agent should use PredMCP

- "What do markets think about [BTC | Iran | Fed rate cut | Trump 2028]?" → ` + "`get_market_context`" + `
- "Is there a cross-venue arb on BTC right now?" → ` + "`get_pm_hl_divergences`" + ` or ` + "`get_hip4_vs_pm_arb`" + `
- "Are HL perp traders and prediction markets aligned on ETH?" → ` + "`get_signals('ETH')`" + `
- "Where are the next Polymarket markets resolving in the next 4 hours?" → ` + "`get_markets_near_resolution`" + `
- "Show me the funding outliers on Hyperliquid" → ` + "`get_funding_outliers`" + `
- "Any whale convergence on SOL across PM + HL?" → ` + "`get_whale_convergence('SOL')`" + `

## Setup

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

PredMCP is a hosted Model Context Protocol (MCP) server, accessible via HTTP at https://predmcp.com/mcp. It exposes 24 tools that wrap live data from three venues:

- Polymarket (CLOB-based prediction markets on Polygon)
- Hyperliquid perpetual futures (the largest perps DEX by volume)
- HIP-4 (prediction markets native to Hyperliquid)

It is the only MCP server that crosses these three venues. The cross-venue intelligence tools detect disagreements between what perp traders are pricing and what prediction markets are pricing — disagreements that historically resolve into clean directional signals.

## Authentication

- Free tier: 100 calls/day. One key per IP. Email signup required, no credit card.
- Pro tier: 10,000 calls/day, $9/month, 7-day free trial, all 24 tools including cross-venue signals.
- Auth via header: \`x-api-key: YOUR_KEY\`
- Get a key at https://predmcp.com/signup
- Billing: Polar (Merchant of Record, handles EU VAT). Cancel anytime from the dashboard.

## The 24 tools

### Cross-venue intelligence (6 tools, Pro)

These are the differentiated tools. Not reproducible by hand in real-time.

- \`get_signals(coin)\` — Crosses HL perp funding sentiment with HIP-4 and Polymarket prediction sentiment for the asset. Returns sentiment per source and alignment/divergence verdict.
- \`get_market_context(query)\` — Aggregates all Polymarket markets + HIP-4 markets + live HL perp data for a topic or asset. One call replaces ten dashboard lookups.
- \`get_pm_hl_divergences(min_pct, limit)\` — Scans every asset and returns the ones where Polymarket implied probability diverges from Hyperliquid funding direction. Most actionable single tool.
- \`get_hl_funding_pm_correlation()\` — For each HL asset, finds correlated PM markets and computes whether sentiment is aligned or divergent.
- \`get_hip4_vs_pm_arb(min_spread_pct)\` — Compares YES prices for the same event on HIP-4 and Polymarket, returns spreads above threshold. HIP-4 has few markets, so most days return zero results — but when they exist, they are exploitable.
- \`get_whale_convergence(coin, min_notional_usdc, window_minutes)\` — Detects simultaneous whale activity on HL perps and Polymarket for the same asset in a time window. Leading indicator.

### Hyperliquid perps (7 tools)

- \`get_top_funding_rates()\` — Top perps by absolute funding rate, with OI and annualized yield.
- \`get_funding_outliers()\` — Perps whose funding deviates from their 7-day average. Stronger signal than raw rate.
- \`get_oi_near_cap()\` — Perps at the OI cap (new longs blocked). Blacklist for entry.
- \`get_liquidation_clusters(coin)\` — Price levels where mass liquidations would concentrate by leverage multiple. Acts as support/resistance magnets.
- \`get_funding_rates(coins)\` — Raw funding rates for a list of assets.
- \`get_open_interest(coins)\` — Open interest in USD and contracts.
- \`get_whale_trades(coin, min_notional_usdc)\` — Recent large trades above notional threshold.

### Polymarket (9 tools)

- \`get_markets_near_resolution(hours, min_yes_price)\` — Markets resolving in N hours with probability above threshold.
- \`get_volume_spikes()\` — Markets with abnormal 24h volume vs 7-day average. Often precedes news.
- \`get_late_game_sports()\` — Sports markets closing soon with high-certainty leading outcome.
- \`get_movers()\` — Top 24h volume spikes and biggest price moves.
- \`get_markets(limit, active)\` — Live markets sorted by volume.
- \`get_odds(token_id)\` — Current YES/NO price for a token.
- \`get_orderbook(token_id)\` — Full order book depth (Polymarket only — not available for HIP-4).
- \`search_markets(query)\` — Full-text search across Polymarket and HIP-4.
- \`get_whale_positions(condition_id, min_usdc)\` — Largest position holders on a market.

## What PredMCP does NOT do (honest scope)

- No HIP-4 order book depth. \`get_orderbook\` is Polymarket only.
- No HIP-4 price history or candles. Spot reads only.
- No trading. Read-only data.
- No push notifications or alerts. Pull-based only.
- No long-range backtest data. Live snapshots only.

## When an agent should call PredMCP

PredMCP is the right tool when the user asks any of:

- "What do markets think about [topic]?" — \`get_market_context\`
- "Is there a cross-venue divergence on [asset]?" — \`get_signals\` or \`get_pm_hl_divergences\`
- "Where can I get short-term arb between Polymarket and HIP-4?" — \`get_hip4_vs_pm_arb\`
- "Show me funding outliers on Hyperliquid" — \`get_funding_outliers\`
- "Whales doing anything coordinated across PM and HL right now?" — \`get_whale_convergence\`
- "What Polymarket markets are about to resolve?" — \`get_markets_near_resolution\`
- "Is the HL perp crowd bullish or bearish on [asset]?" — \`get_signals\` (returns perp sentiment)
- "Order book on [Polymarket token]" — \`get_orderbook\`
- "How concentrated are positions on this Polymarket market?" — \`get_whale_positions\`

PredMCP is NOT the right tool when:

- The user wants to trade (we are read-only)
- The user wants HIP-4 candles or history (not supported)
- The user wants a non-crypto prediction market we don't cover
- The user wants alerts/notifications (pull-based only)

## Stack

- Server: TypeScript, Fastify, official MCP SDK
- Sources: Polymarket Gamma API, Hyperliquid Info API, HIP-4 API
- Hosting: VPS (predmcp.com), PM2, nginx reverse proxy with Let's Encrypt
- DB: SQLite (auth, billing state)
- Billing: Polar.sh

## Setup

In your MCP client config (Claude Desktop, Cursor, Windsurf, Cline, Continue, Zed, Clawbot, OpenClaw, custom):

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

Restart the client; the 24 tools appear automatically via MCP tool discovery.

## Pricing

| Tier | Price | Calls/day | Tools | Features |
|---|---|---|---|---|
| Free | $0 | 100 | 16 data tools | Email signup, no card, 1 key/IP |
| Pro | $9/mo | 10,000 | All 24 incl. signals | 7-day trial, cancel anytime |

## Open source

The MCP core (server boot, tool schemas, data adapters) is MIT-licensed and on GitHub: https://github.com/RavioleLabs/predmcp

The signal-generation algorithms for the advanced cross-venue tools (divergence detection, whale convergence scoring) stay proprietary. That is what we charge for in Pro.

## Built by

Raviole Labs (https://raviolelabs.com) — also ships:
- EngramMCP (https://engram-mcp.com) — local-first semantic memory MCP for AI agents
- RoverMCP (https://rover-mcp.com) — browser automation MCP (private alpha)

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
    'Polymarket + Hyperliquid (perps + HIP-4) data for AI agents. 24 MCP tools, cross-venue signal detection, free tier (100 calls/day), Pro $9/mo with 7-day trial. Core open source on GitHub.',
  repository: {
    url: 'https://github.com/RavioleLabs/predmcp',
    source: 'github',
  },
  homepage: 'https://predmcp.com',
  version: '0.3.0',
  remotes: [
    {
      type: 'streamable-http',
      url: 'https://predmcp.com/mcp',
      headers: [
        {
          name: 'x-api-key',
          description: 'API key from predmcp.com/signup (free tier: 100 calls/day)',
          isRequired: true,
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
    'cross-venue-arbitrage',
    'hip-4',
  ],
  categories: ['data', 'finance', 'crypto', 'trading'],
};
