# PredMCP

**Safe, read-only market data for AI trading agents.**

44 MCP tools that cross **Polymarket** prediction markets, **Hyperliquid perps**, and **HIP-4** native predictions. Plug your agent into live trading data — without ever giving it the ability to execute orders.

Live, hosted, free during early access: [predmcp.com](https://predmcp.com)

## Why read-only matters

The #1 worry when wiring an LLM to a trading venue is the same in every conversation: *"and it can't actually trade, right?"* PredMCP is built so that question has a single answer.

- **No execution endpoint.** Zero order-placement code exists in this codebase. Not gated, not commented out — not implemented. There is nothing to enable.
- **No private keys touched.** We use the public Hyperliquid Info API and Polymarket Gamma API. Your wallet, your seed phrase, your accounts — never seen, never asked for.
- **44 tools, all queries.** Markets, orderbooks, funding rates, whale activity, signals. Every tool is a read. Your agent reasons about markets; you stay the only one who can act on them.

## What's in the box

### Public data (any free key)
| Family | Tools |
|--------|-------|
| Polymarket | `get_markets` · `get_odds` · `get_orderbook` · `get_whale_positions` · `search_markets` · `get_movers` · `get_markets_near_resolution` · `get_volume_spikes` · `get_late_game_sports` |
| Hyperliquid perps | `get_funding_rates` · `get_open_interest` · `get_whale_trades` · `get_orderbook_depth` · `get_top_funding_rates` · `get_oi_near_cap` · `get_funding_momentum` |
| Macro & price | `get_price_summary` · `get_basic_macro` · `get_recent_news` · `get_simple_iv` |

### Intelligence (early access — free during the open phase)
| Family | Tools |
|--------|-------|
| Cross-venue signals | `get_signals` · `get_market_context` · `get_pm_hl_divergences` · `get_hl_funding_pm_correlation` · `get_hip4_vs_pm_arb` · `get_whale_convergence` |
| Signal intelligence | `get_signal_backtest` · `get_conviction_score` · `get_funding_curve_anomaly` · `get_setup_quality` · `explain_signal` |
| Macro & flow | `get_macro_context` · `get_macro_liquidity` · `get_cex_outflows` · `get_upcoming_catalysts` · `get_news_correlation` |
| Agent-native UX | `get_portfolio_risk` · `get_options_iv` · `get_social_velocity` · `get_whale_label` |

Each tool is one verb your agent can call. Self-documenting via MCP.

## Examples

**Iran — what prediction markets say right now:**
```
"US x Iran peace deal by May 15"    → YES 20%  ($9M volume)
"US x Iran peace deal by May 31"    → YES 34%  ($16M volume, +4% today)
"Iranian regime falls before 2027"  → YES 15%  ($17M volume)
"US invades Iran before 2027"       → YES 21%  ($26M volume)
```
One `get_market_context` call.

**BTC cross-platform signal:**
```
HL perps:  $79,740  |  funding: neutral  |  OI: 31,100 BTC
HIP-4:     BTC > $81,041 by 6am tomorrow  →  YES 12%  (market says no)
Signal:    ✓ ALIGNED — perps neutral, prediction bearish
```
When these diverge, it's a signal. `get_signals` computes it.

**24h movers:**
```
"Will Bitcoin hit $150k by June 30?"   $5.8M traded in 24h
"US x Iran permanent peace deal"       $3.2M in 24h  (+4% move)
Athletics vs Phillies                  +55% price move
```

## Use the hosted server (recommended)

Get a free API key (email, no credit card, 100 calls/day) at [predmcp.com/signup](https://predmcp.com/signup), then drop into your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "predmcp": {
      "type": "http",
      "url": "https://predmcp.com/mcp",
      "headers": { "x-api-key": "YOUR_KEY" }
    }
  }
}
```

Also works with Cursor, Windsurf, Claude.ai (OAuth), and any MCP client that supports HTTP transport.

Ask your agent:
- *"What are prediction markets saying about Iran right now?"*
- *"Is there a divergence between BTC perp traders and prediction markets?"*
- *"What markets moved the most in the last 24 hours?"*
- *"Are any whales active on both Hyperliquid and Polymarket for BTC right now?"*

## Early access

We're in an open early-access phase: all 44 tools, no gating, no credit card. The first 50 signups stay grandfathered for 90 days when paid plans launch.

## Self-host

The public OSS core covers the read-only data layer (Polymarket + Hyperliquid wrappers, MCP server, signup/auth). The intelligence/private tools (signals, conviction scores, macro flow) live in a private side module — the hosted version exposes them, the OSS one doesn't.

```bash
git clone https://github.com/RavioleLabs/predmcp
cd predmcp
npm install
npm run build
IP_HASH_PEPPER="$(openssl rand -hex 32)" npm start
```

Server runs on `http://localhost:3000/mcp`. Public data sources require no upstream API keys.

## Stack

TypeScript · Fastify · MCP SDK · SQLite (better-sqlite3) · Polymarket Gamma API · Hyperliquid Info API

## License

MIT — Raviole Labs.
