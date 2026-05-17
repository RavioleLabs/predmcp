import { z } from 'zod';
import { TTLCache } from '../core/cache/index.js';
import { fetchLateGameSports } from '../sources/polymarket.js';

const cache = new TTLCache<unknown>(60_000);

export const getLateGameSportsSchema = {
  certainty_pct: z.number().min(50).max(99).optional().default(85).describe('Minimum leading outcome probability as percentage, e.g. 85 = 85% (default: 85)'),
  hours_max: z.number().min(0.5).max(24).optional().default(6).describe('Maximum hours until market closes (default: 6h)'),
};

export async function getLateGameSportsHandler(input: { certainty_pct: number; hours_max: number }) {
  const { certainty_pct, hours_max } = input;
  const markets = await cache.getOrFetch(`late_sports:${certainty_pct}:${hours_max}`, () => fetchLateGameSports(certainty_pct, hours_max)) as Awaited<ReturnType<typeof fetchLateGameSports>>;
  return { content: [{ type: 'text' as const, text: JSON.stringify({ count: markets.length, markets }) }] };
}
