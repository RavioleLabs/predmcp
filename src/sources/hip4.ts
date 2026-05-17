import * as hl from '@nktkas/hyperliquid';
import { createLogger } from '../core/logger.js';

const log = createLogger('sources:hip4');

let _client: hl.InfoClient | null = null;

function getClient(): hl.InfoClient {
  if (!_client) {
    const transport = new hl.HttpTransport({ apiUrl: 'https://api.hyperliquid.xyz' });
    _client = new hl.InfoClient({ transport });
  }
  return _client;
}

export interface Hip4Market {
  base: string;
  outcome_id: number;
  description: string;
  yes_coin: string;
  no_coin: string;
  yes_price: number;
  no_price: number;
}

export interface Hip4Odds {
  base: string;
  yes: number;
  no: number;
}

/**
 * HIP-4 prediction markets on Hyperliquid use the #N0/#N1 naming convention in allMids.
 * For outcome N, #N0 is the YES side and #N1 is the NO side.
 * Both sides always sum to 1.0.
 * Metadata comes from outcomeMeta() which describes each outcome's underlying question.
 */
export async function fetchHip4Markets(): Promise<Hip4Market[]> {
  log.debug('fetchHip4Markets', undefined);
  const client = getClient();

  const [mids, outcomeMeta] = await Promise.all([
    client.allMids(),
    client.outcomeMeta(),
  ]);

  const markets: Hip4Market[] = [];

  for (const outcome of outcomeMeta.outcomes) {
    const outcomeId = outcome.outcome;
    const yesCoin = `#${outcomeId}0`;
    const noCoin = `#${outcomeId}1`;

    const yesMid = mids[yesCoin];
    const noMid = mids[noCoin];

    // Only include outcomes that have live prices
    if (yesMid === undefined || noMid === undefined) continue;

    // Parse a human-readable base name from description
    // e.g. "class:priceBinary|underlying:BTC|expiry:20260508-0600|targetPrice:81041|period:1d"
    let base = `Outcome${outcomeId}`;
    let description = outcome.description ?? outcome.name ?? '';
    const underlyingMatch = description.match(/underlying:([^|]+)/);
    const targetPriceMatch = description.match(/targetPrice:([^|]+)/);
    const expiryMatch = description.match(/expiry:([^|]+)/);
    if (underlyingMatch) {
      base = underlyingMatch[1];
      if (targetPriceMatch) base += `>${targetPriceMatch[1]}`;
      if (expiryMatch) base += `@${expiryMatch[1]}`;
    } else {
      // Use outcome name as base (e.g. "Recurring Fallback")
      base = outcome.name ?? base;
    }

    markets.push({
      base,
      outcome_id: outcomeId,
      description,
      yes_coin: yesCoin,
      no_coin: noCoin,
      yes_price: parseFloat(yesMid),
      no_price: parseFloat(noMid),
    });
  }

  return markets;
}

export async function fetchHip4Odds(base: string): Promise<Hip4Odds> {
  log.debug('fetchHip4Odds');
  const markets = await fetchHip4Markets();
  const market = markets.find(m => m.base === base);
  if (!market) throw new Error(`HIP-4 market not found for base: ${base}`);
  return { base, yes: market.yes_price, no: market.no_price };
}
