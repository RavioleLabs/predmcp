// src/server/index.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAllTools } from '../tools/index.js';

export async function buildServer(): Promise<McpServer> {
  const server = new McpServer({
    name: 'PredMCP',
    version: '0.1.0',
    description: 'Real-time prediction market + Hyperliquid perps intelligence for Claude. 23 tools covering cross-platform signals, funding outliers, OI caps, liquidation clusters, orderbook depth + slippage estimates, volume spikes, whale activity, and HIP-4 vs Polymarket arb. Get a free API key (100 calls/day) at https://predmcp.com/signup',
    websiteUrl: 'https://predmcp.com',
  });
  await registerAllTools(server);
  return server;
}
