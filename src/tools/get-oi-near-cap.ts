import { z } from 'zod';
import { TTLCache } from '../core/cache/index.js';
import { fetchPerpsAtOiCap } from '../sources/hyperliquid.js';

const cache = new TTLCache<unknown>(60_000);

export const getOiNearCapSchema = {};

export async function getOiNearCapHandler(_input: Record<string, never>) {
  const perps = await cache.getOrFetch('oi_near_cap', () => fetchPerpsAtOiCap()) as Awaited<ReturnType<typeof fetchPerpsAtOiCap>>;
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        count: perps.length,
        warning: 'These perps are at the Hyperliquid OI cap. New positions cannot be opened long. Consider as blacklist for long entries.',
        perps,
      }),
    }],
  };
}
