// src/sources/social.ts
//
// Free-tier social signals. Twitter API costs $200/mo for the most basic tier,
// so we rely on Nitter (a privacy-friendly Twitter front-end) and Coingecko
// social stats (free, low fidelity) as a fallback signal.
//
// Nitter pros: free, no auth. Cons: instances rate-limit and go down often;
// we round-robin through a small pool. The signal is best-effort.

import { createLogger } from '../core/logger.js';

const log = createLogger('sources:social');

// Public Nitter instances (rotate; some go down). Update quarterly.
const NITTER_INSTANCES = [
  'https://nitter.privacydev.net',
  'https://nitter.poast.org',
  'https://nitter.net',
];

const POSITIVE_WORDS = new Set([
  'bull', 'bullish', 'moon', 'pump', 'long', 'buy', 'breakout', 'rally', 'gem',
  'ath', 'send', 'fire', 'soaring', 'rip', 'green', 'rocket', '🚀', '🔥', '💎',
]);
const NEGATIVE_WORDS = new Set([
  'bear', 'bearish', 'dump', 'short', 'sell', 'rug', 'rekt', 'cratering', 'tank',
  'crash', 'red', 'liquidated', 'dumping', 'avoid', 'scam', '💀', '📉',
]);

export interface SocialSnapshot {
  asset: string;
  window_hours: number;
  mentions_count: number;
  unique_authors: number;
  sentiment_score: number; // -1..+1
  positive_count: number;
  negative_count: number;
  neutral_count: number;
  velocity_per_hour: number;
  source: string;
  warning?: string;
}

function scoreText(text: string): 1 | -1 | 0 {
  const t = text.toLowerCase();
  let pos = 0, neg = 0;
  for (const w of POSITIVE_WORDS) if (t.includes(w)) pos++;
  for (const w of NEGATIVE_WORDS) if (t.includes(w)) neg++;
  if (pos > neg) return 1;
  if (neg > pos) return -1;
  return 0;
}

async function fetchNitterSearch(asset: string): Promise<{ tweets: { text: string; author: string }[]; instance: string } | null> {
  // Round-robin
  for (const base of NITTER_INSTANCES) {
    try {
      const url = `${base}/search?f=tweets&q=${encodeURIComponent('$' + asset)}&since=`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; predmcp/1.0)' },
      });
      if (!res.ok) continue;
      const html = await res.text();
      // Very lightweight extraction of tweet bodies + usernames.
      const tweets: { text: string; author: string }[] = [];
      const tweetRe = /<div class="tweet-content[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
      const userRe = /<a class="username"[^>]*>([^<]+)<\/a>/g;
      const texts = [...html.matchAll(tweetRe)].map((m) => m[1].replace(/<[^>]+>/g, '').trim());
      const users = [...html.matchAll(userRe)].map((m) => m[1].replace(/^@/, '').trim());
      const n = Math.min(texts.length, users.length);
      for (let i = 0; i < n; i++) tweets.push({ text: texts[i], author: users[i] });
      if (tweets.length) return { tweets, instance: base };
    } catch (err) {
      log.debug('nitter instance failed');
    }
  }
  return null;
}

export async function fetchSocialSnapshot(asset: string, windowHours: number): Promise<SocialSnapshot> {
  const result = await fetchNitterSearch(asset);
  if (!result || !result.tweets.length) {
    return {
      asset,
      window_hours: windowHours,
      mentions_count: 0,
      unique_authors: 0,
      sentiment_score: 0,
      positive_count: 0,
      negative_count: 0,
      neutral_count: 0,
      velocity_per_hour: 0,
      source: 'nitter:all_down',
      warning: 'All Nitter instances unreachable. Social signal unavailable. Free social data is fragile — use Tier 2 paid (Apify Twitter $50/mo) for production.',
    };
  }

  // The free Nitter search returns roughly the last 20-25 results sorted by time;
  // we treat that whole bucket as the "window" since we cannot reliably parse
  // tweet timestamps from minified HTML. This is rough — acceptable for v1.
  const tweets = result.tweets;
  let pos = 0, neg = 0, neu = 0;
  for (const t of tweets) {
    const s = scoreText(t.text);
    if (s > 0) pos++;
    else if (s < 0) neg++;
    else neu++;
  }
  const total = tweets.length;
  const sentiment = total ? (pos - neg) / total : 0;
  const uniqueAuthors = new Set(tweets.map((t) => t.author.toLowerCase())).size;

  return {
    asset,
    window_hours: windowHours,
    mentions_count: total,
    unique_authors: uniqueAuthors,
    sentiment_score: Math.round(sentiment * 100) / 100,
    positive_count: pos,
    negative_count: neg,
    neutral_count: neu,
    velocity_per_hour: Math.round((total / windowHours) * 10) / 10,
    source: `nitter:${result.instance.replace('https://', '')}`,
    warning: 'Sample bounded by Nitter page size (~25 tweets). Best for relative comparison across assets/time, not absolute volume.',
  };
}
