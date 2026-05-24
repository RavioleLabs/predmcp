// src/sources/catalysts.ts
//
// Free data sources for upcoming market catalysts:
//   - Governance: Tally public GraphQL (no key) for active proposals
//   - ETF deadlines: hardcoded SEC decision dates (public knowledge, kept updated)
//   - Token unlocks: best-effort via known schedules embedded below; for a
//     comprehensive feed, pair with TokenUnlocks scrape (separate module).
//
// All endpoints are free. No external keys required.

import { createLogger } from '../core/logger.js';

const log = createLogger('sources:catalysts');

const TALLY_GQL = 'https://api.tally.xyz/query';

export interface CatalystEvent {
  asset: string;
  kind: 'token_unlock' | 'governance_vote' | 'etf_decision' | 'exchange_listing' | 'cex_warning' | 'protocol_upgrade';
  title: string;
  scheduled_at: string; // ISO
  hours_until: number;
  source: string;
  url?: string;
  meta?: Record<string, unknown>;
}

// ──────────────────────────────────────────────────────────────────────────────
// Tally — governance proposals (free, no key needed for public queries)
// ──────────────────────────────────────────────────────────────────────────────

interface TallyOrg {
  id: string;
  slug: string;
  metadata?: { symbol?: string };
}

const TALLY_ORG_MAP: Record<string, string> = {
  // asset ticker → Tally slug
  AAVE: 'aave',
  UNI: 'uniswap',
  COMP: 'compound',
  MKR: 'maker',
  ENS: 'ens',
  ARB: 'arbitrum',
  OP: 'optimism',
  GTC: 'gitcoin',
  PEOPLE: 'constitutiondao',
  SAFE: 'safe',
};

export async function fetchGovernanceVotes(asset: string, horizonHours: number): Promise<CatalystEvent[]> {
  log.debug('fetchGovernanceVotes');
  const slug = TALLY_ORG_MAP[asset.toUpperCase()];
  if (!slug) return [];

  const query = `
    query Proposals($input: ProposalsInput!) {
      proposals(input: $input) {
        nodes {
          ... on Proposal {
            id
            metadata { title description }
            voteStats { type votesCount votersCount percent }
            start { ... on Block { timestamp } }
            end { ... on Block { timestamp } }
            status
          }
        }
      }
    }
  `;

  try {
    const res = await fetch(TALLY_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { input: { filters: { organizationSlug: slug } } },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: { proposals?: { nodes?: any[] } } };
    const nodes = data.data?.proposals?.nodes ?? [];
    const now = Date.now();
    const horizonMs = horizonHours * 3_600_000;
    const events: CatalystEvent[] = [];
    for (const p of nodes) {
      // We care about proposals whose voting period ends within the horizon
      const endTs = p.end?.timestamp ? new Date(p.end.timestamp).getTime() : null;
      if (!endTs || endTs - now > horizonMs || endTs < now) continue;
      events.push({
        asset,
        kind: 'governance_vote',
        title: p.metadata?.title ?? 'Untitled proposal',
        scheduled_at: new Date(endTs).toISOString(),
        hours_until: Math.round(((endTs - now) / 3_600_000) * 10) / 10,
        source: 'tally',
        url: `https://www.tally.xyz/gov/${slug}/proposal/${p.id}`,
        meta: { status: p.status },
      });
    }
    return events;
  } catch (err) {
    log.debug('tally fetch failed');
    return [];
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Hardcoded ETF / SEC deadlines and known macro events
// Keep this list curated; rotate quarterly.
// ──────────────────────────────────────────────────────────────────────────────

interface HardcodedEvent {
  asset: string;
  kind: CatalystEvent['kind'];
  title: string;
  scheduled_at: string; // ISO
  url?: string;
}

// IMPORTANT: keep dates ahead of "now" — rotate quarterly.
// These are illustrative — operators should refresh from SEC/Fed calendars.
const HARDCODED_EVENTS: HardcodedEvent[] = [
  // ETF / SEC decisions
  { asset: 'SOL', kind: 'etf_decision', title: 'SEC final decision deadline — VanEck Solana spot ETF', scheduled_at: '2026-10-23T00:00:00Z' },
  { asset: 'SOL', kind: 'etf_decision', title: 'SEC final decision deadline — Bitwise Solana spot ETF', scheduled_at: '2026-10-30T00:00:00Z' },
  { asset: 'XRP', kind: 'etf_decision', title: 'SEC final decision deadline — Bitwise XRP spot ETF', scheduled_at: '2026-10-20T00:00:00Z' },
  { asset: 'XRP', kind: 'etf_decision', title: 'SEC review window opens — 21Shares XRP spot ETF', scheduled_at: '2026-07-14T00:00:00Z' },
  { asset: 'LTC', kind: 'etf_decision', title: 'SEC final decision deadline — Canary Litecoin ETF', scheduled_at: '2026-09-29T00:00:00Z' },
  { asset: 'DOGE', kind: 'etf_decision', title: 'SEC review window — Bitwise Dogecoin ETF', scheduled_at: '2026-08-12T00:00:00Z' },
  // FOMC / macro — 2026 schedule
  { asset: 'BTC', kind: 'protocol_upgrade', title: 'FOMC decision (Fed funds rate)', scheduled_at: '2026-06-17T18:00:00Z' },
  { asset: 'BTC', kind: 'protocol_upgrade', title: 'FOMC decision (Fed funds rate)', scheduled_at: '2026-07-29T18:00:00Z' },
  { asset: 'BTC', kind: 'protocol_upgrade', title: 'FOMC decision (Fed funds rate)', scheduled_at: '2026-09-16T18:00:00Z' },
  { asset: 'BTC', kind: 'protocol_upgrade', title: 'FOMC decision (Fed funds rate)', scheduled_at: '2026-10-28T18:00:00Z' },
  { asset: 'BTC', kind: 'protocol_upgrade', title: 'FOMC decision (Fed funds rate)', scheduled_at: '2026-12-09T18:00:00Z' },
  // Reflect FOMC matters for ETH too (general crypto-wide macro)
  { asset: 'ETH', kind: 'protocol_upgrade', title: 'FOMC decision (Fed funds rate)', scheduled_at: '2026-06-17T18:00:00Z' },
  { asset: 'ETH', kind: 'protocol_upgrade', title: 'FOMC decision (Fed funds rate)', scheduled_at: '2026-07-29T18:00:00Z' },
  { asset: 'ETH', kind: 'protocol_upgrade', title: 'FOMC decision (Fed funds rate)', scheduled_at: '2026-09-16T18:00:00Z' },
];

export function getHardcodedEvents(asset: string, horizonHours: number): CatalystEvent[] {
  const now = Date.now();
  const horizonMs = horizonHours * 3_600_000;
  return HARDCODED_EVENTS
    .filter((e) => e.asset === asset.toUpperCase())
    .map((e) => {
      const ts = new Date(e.scheduled_at).getTime();
      return {
        asset: e.asset,
        kind: e.kind,
        title: e.title,
        scheduled_at: e.scheduled_at,
        hours_until: Math.round(((ts - now) / 3_600_000) * 10) / 10,
        source: 'hardcoded',
        url: e.url,
      };
    })
    .filter((e) => e.hours_until > 0 && e.hours_until <= horizonHours / 1);
}

// ──────────────────────────────────────────────────────────────────────────────
// Token unlocks — best-effort via well-known vesting contracts on Etherscan.
// Free Etherscan tier: 5 req/s without API key, 100k/day with free key.
// We support a handful of high-profile assets with known schedules.
// ──────────────────────────────────────────────────────────────────────────────

const ETHERSCAN = 'https://api.etherscan.io/api';
const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY ?? '';

// Known TGE + cliff + linear schedules (high-profile alts where unlocks move price).
// Each entry: nextUnlockISO + percentSupply approx.
const KNOWN_UNLOCKS: Record<string, { date: string; pct_supply: number; tranche: string }[]> = {
  // Add or update quarterly. These are *examples* — operators should refresh
  // from token-foundation announcements or TokenUnlocks.
  ARB: [{ date: '2026-09-16T12:00:00Z', pct_supply: 1.94, tranche: 'monthly linear (team + investors)' }],
  AVAX: [{ date: '2026-07-12T00:00:00Z', pct_supply: 0.62, tranche: 'monthly (team)' }],
  APT: [{ date: '2026-08-12T00:00:00Z', pct_supply: 1.83, tranche: 'monthly cliff (foundation)' }],
  SUI: [{ date: '2026-09-01T00:00:00Z', pct_supply: 0.74, tranche: 'monthly (early backers)' }],
  IMX: [{ date: '2026-08-05T00:00:00Z', pct_supply: 1.32, tranche: 'monthly' }],
};

export function getKnownUnlocks(asset: string, horizonHours: number): CatalystEvent[] {
  const list = KNOWN_UNLOCKS[asset.toUpperCase()] ?? [];
  const now = Date.now();
  const horizonMs = horizonHours * 3_600_000;
  return list
    .map((u) => {
      const ts = new Date(u.date).getTime();
      return {
        asset: asset.toUpperCase(),
        kind: 'token_unlock' as const,
        title: `~${u.pct_supply}% supply unlock — ${u.tranche}`,
        scheduled_at: u.date,
        hours_until: Math.round(((ts - now) / 3_600_000) * 10) / 10,
        source: 'curated',
        meta: { pct_supply: u.pct_supply },
      };
    })
    .filter((e) => e.hours_until > 0 && e.hours_until <= horizonHours);
}
