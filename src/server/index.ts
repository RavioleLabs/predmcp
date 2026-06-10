// src/server/index.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAllTools } from '../tools/index.js';

export async function buildServer(): Promise<McpServer> {
  const server = new McpServer({
    name: 'PredMCP',
    version: '0.7.0',
    description: 'Real-time prediction market + Hyperliquid perps intelligence for AI agents (Claude, Cursor, Windsurf, or any MCP-compatible client). 47 tools covering cross-platform signals, signal backtests, conviction scoring, funding outliers, OI caps, liquidation clusters, orderbook depth + slippage estimates, options IV, macro context, whale activity, and HIP-4 vs Polymarket arb. Get a free API key (100 calls/day) at https://predmcp.com/signup',
    websiteUrl: 'https://predmcp.com',
  });
  await registerAllTools(server);
  return server;
}
