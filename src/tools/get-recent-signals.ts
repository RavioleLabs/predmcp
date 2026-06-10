// src/tools/get-recent-signals.ts
//
// The polling-agent equivalent of the SSE stream. The server detects funding
// outliers, whale trades, and OI caps 24/7 — this tool lets a request/response
// client (which cannot hold an SSE connection between tool calls) ask "what
// happened since my last check?" via a cursor.
//
// Free tier: last 1 hour, max 20 events. Pro: 7 days + type/coin filters
// served by get_signal_history.

import { z } from 'zod';
import { querySignalEvents } from '../core/server/market-store.js';

export const getRecentSignalsSchema = {
  since_id: z.number().int().optional().describe('Cursor from a previous call — returns only events with id > since_id. Omit on first call.'),
  coin: z.string().optional().describe('Filter to one coin, e.g. "BTC"'),
  limit: z.number().int().min(1).max(20).optional().default(20).describe('Max events (free tier cap: 20)'),
};

export async function getRecentSignalsHandler(input: { since_id?: number; coin?: string; limit: number }) {
  const oneHourAgo = Date.now() - 3_600_000;
  const rows = querySignalEvents({
    sinceId: input.since_id,
    sinceMs: oneHourAgo, // free tier: 1h lookback
    coin: input.coin,
    limit: input.limit,
  });
  const events = rows.map((r) => ({
    id: r.id,
    type: r.type,
    coin: r.coin,
    detected_at: new Date(r.detected_at).toISOString(),
    mark_px_at_detection: r.mark_px,
    ...JSON.parse(r.payload),
  }));
  const cursor = rows.length ? Math.max(...rows.map((r) => r.id)) : input.since_id ?? 0;
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        events,
        count: events.length,
        next_cursor: cursor,
        lookback: '1h (free tier — Pro get_signal_history covers 7d with outcome stats)',
        hint: events.length === 0 ? 'No signals detected in the last hour. Pass next_cursor on your next call to catch new ones.' : 'Pass next_cursor as since_id on your next call to receive only new events.',
      }),
    }],
  };
}
