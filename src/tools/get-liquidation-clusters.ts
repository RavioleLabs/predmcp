import { z } from 'zod';
import { TTLCache } from '../core/cache/index.js';
import { fetchLiquidationClusters } from '../sources/hyperliquid.js';

const cache = new TTLCache<unknown>(30_000);

export const getLiquidationClustersSchema = {
  coin: z.string().describe('Asset ticker to analyze, e.g. "BTC", "ETH", "SOL"'),
};

export async function getLiquidationClustersHandler(input: { coin: string }) {
  const { coin } = input;
  const data = await cache.getOrFetch(`liq_clusters:${coin}`, () => fetchLiquidationClusters(coin)) as Awaited<ReturnType<typeof fetchLiquidationClusters>>;
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        ...data,
        note: 'Liquidation levels estimated from mark price and standard leverage multiples. Clusters with high nearby_liquidity_sz indicate orderbook support near that level.',
      }),
    }],
  };
}
