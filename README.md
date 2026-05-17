# PredMCP

**Real-time prediction-market + Hyperliquid perps intelligence, plugged directly into Claude.**

PredMCP is an [MCP](https://modelcontextprotocol.io) server that gives Claude live data from Polymarket and Hyperliquid (perpetuals + HIP-4 on-chain markets). Use it to ask one question and pull cross-venue context in a single answer — funding rates, orderbook depth, volume spikes, whale positions, prediction-market odds.

- **Hosted:** `https://predmcp.com/mcp` — free tier, 100 calls/day, one key per IP.
- **Self-host:** clone, `npm install`, set a few env vars, run.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Free tier](https://img.shields.io/badge/free_tier-100_calls%2Fday-7c5cfc)](https://predmcp.com/signup)

---

## Quick start (hosted)

1. Get a free key at [predmcp.com](https://predmcp.com) (email + click "Get key").
2. Add it to `claude_desktop_config.json`:

   ```json
   {
     "mcpServers": {
       "predmcp": {
         "type": "http",
         "url": "https://predmcp.com/mcp",
         "headers": { "x-api-key": "your-key" }
       }
     }
   }
   ```

3. Restart Claude Desktop. Ask things like:
   - *"What's BTC funding on Hyperliquid right now and how does it compare to the HIP-4 binary?"*
   - *"Find Polymarket volume spikes today."*
   - *"Show me the orderbook depth on HYPE before I size in."*

---

## Tools shipped in this repo (open source)

These are the data-layer tools — direct, thin wrappers over Polymarket and Hyperliquid APIs, plus single-venue aggregations. The code is the spec.

**Polymarket**
- `get_markets` — live markets, sorted by volume
- `get_odds` — YES/NO price for any token
- `get_orderbook` — full bid/ask depth for a market
- `search_markets` — full-text search across PM + HIP-4
- `get_whale_positions` — largest position holders in a market
- `get_movers` — top 24h volume spikes and biggest price swings
- `get_markets_near_resolution` — resolving soon with high probability
- `get_volume_spikes` — abnormal 24h volume vs 7-day baseline
- `get_late_game_sports` — sports markets closing soon with high-certainty leader

**Hyperliquid (perps + HIP-4)**
- `get_funding_rates` — current funding for one or all perps
- `get_open_interest` — OI in USD and contracts
- `get_whale_trades` — recent large trades above a notional threshold
- `get_top_funding_rates` — top perps by absolute funding rate
- `get_funding_outliers` — perps whose funding spikes vs 7-day average
- `get_oi_near_cap` — perps at the OI cap (entry blacklist)
- `get_liquidation_clusters` — estimated mass-liquidation price levels
- `get_orderbook_depth` — bid/ask depth + slippage estimate for any perp or HIP-4 market

**Account**
- `create_api_key` — programmatic signup (one email, one IP, 100 calls/day)

---

## What's in this repo vs. what's not

This repo contains the **open-source half**: the MCP framework, the basic Polymarket and Hyperliquid fetchers, the auth/stats layer, the landing page. It's fully functional on its own — you can run a complete PredMCP instance from this code.

A second set of tools — six cross-venue signals (divergence detection, whale convergence, HIP-4 ↔ Polymarket arb, etc.) — lives in a private folder (`src/tools/private/`) that is gitignored. The hosted server at predmcp.com loads them on startup; clones of this repo simply don't see them (the loader catches the import error silently). You'll see 18 tools in `tools/list`. The hosted server has 24.

The closed tools are kept closed because that's where the meaningful logic sits, and that's what funds the project. The open half is real, complete, and auditable — not a stub. If a closed tool is critical to your use case, run against the hosted endpoint; if you only need data tools, run your own.

---

## Data collection (auditable)

This section describes **exactly** what the hosted predmcp.com server records. The code that does the recording is in this repo; you can read it in 30 seconds.

### Per API key (table `api_keys`, see [src/core/auth/keys.ts](src/core/auth/keys.ts))

| Column | What it is | Why |
|---|---|---|
| `key` | the 32-byte random key | identifier |
| `tier` | `free` or `pro` | plan |
| `email` | the email you provided at signup | recovery / billing |
| `calls_today` | counter of API calls in the current UTC day | rate limit |
| `day_bucket` | the YYYY-MM-DD that counter belongs to | reset logic |
| `created_at` | ms timestamp of issuance | analytics |
| `last_seen_at` | ms timestamp of the most recent call | "active users" metric |
| `creator_ip` | HMAC-SHA-256(IP, server pepper) | one-key-per-IP enforcement |

The raw IP is **never** persisted. We hash it with a server-side secret (HMAC pepper) at request time and compare hashes for the uniqueness check. Plain `SHA-256(IPv4)` would be reversible via rainbow tables; the HMAC pepper makes that infeasible.

### What we do not log or store

- Prompt content
- Tool-call arguments (the values you pass to `coin`, `query`, `token_id`, `condition_id`, etc.)
- Tool responses
- Wallet addresses
- Position data
- Query strings beyond what's needed to authenticate
- Your raw IP (only the HMAC hash)

The default log level is `info`. Tool-call arguments are logged at `debug` only, and the `log.debug` calls in `src/sources/*` have been written to drop arguments entirely (see commits). Operators who set `LOG_LEVEL=debug` for local development get function names only, no payloads.

### What this means in practice

If you sign up on predmcp.com today, the only personally-identifying thing we hold tomorrow is:
- your email
- a counter of how many calls your key has made
- the day buckets it was active in
- an HMAC hash of the IP that signed up

Pro tier (when launched via [Polar.sh](https://polar.sh)): the daily counter still increments for billing. Nothing else changes.

### Audit log

The schema has a tamper-evident `audit_log` table (chained SHA-256 hashes). It is **not currently written to** in the OSS code — it exists for future compliance use. You can grep for `audit(` to confirm it has no live callers.

---

## Self-hosting

```bash
git clone https://github.com/RavioleLabs/predmcp.git
cd predmcp
npm install
npm run build

# Required env vars
export ADMIN_SECRET="$(openssl rand -hex 32)"
export IP_HASH_PEPPER="$(openssl rand -hex 32)"
export TRUST_PROXY="loopback"   # if running behind nginx on the same host

node dist/index.js
```

The server listens on port 3000 by default. SQLite database lives at `~/.predmcp/predmcp.db`. The first signup creates the schema.

Available env vars:
- `ADMIN_SECRET` (required, ≥ 32 chars) — used for `Authorization: Bearer …` on `/admin/*`
- `IP_HASH_PEPPER` (required, ≥ 32 chars) — used as the HMAC key for IP hashing
- `TRUST_PROXY` — `true`, `loopback`, or a comma-separated CIDR list (default: don't trust any proxy)
- `LOG_LEVEL` — `debug` / `info` / `warn` / `error` (default `info`)

---

## Privacy summary

- One key per IP at the hosted instance, enforced by HMAC hash.
- Email is required for free tier; used for recovery only.
- Raw IP never persisted.
- Tool-call arguments and responses are never logged.
- Pre-launch only stats: signup counts, daily call counters, active-user counts.

If anything in this repo contradicts the above, that is a bug. Open an issue or a PR.

---

## License

MIT, see [LICENSE](LICENSE). Pull requests welcome on the open parts.

---

## Links

- Website: [predmcp.com](https://predmcp.com)
- MCP Registry: `io.github.RavioleLabs/predmcp`
- Smithery: [smithery.ai/server/leraviole/predmcp](https://smithery.ai/server/leraviole/predmcp)
- Issues: [github.com/RavioleLabs/predmcp/issues](https://github.com/RavioleLabs/predmcp/issues)
