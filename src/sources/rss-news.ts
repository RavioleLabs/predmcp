// src/sources/rss-news.ts
//
// Free RSS feeds from major crypto news outlets. No auth, no key.
// Parsed with a minimal regex parser (no xml2js dependency).

import { createLogger } from '../core/logger.js';

const log = createLogger('sources:rss-news');

const FEEDS = [
  { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
  { name: 'The Block', url: 'https://www.theblock.co/rss.xml' },
  { name: 'Decrypt', url: 'https://decrypt.co/feed' },
  { name: 'Cointelegraph', url: 'https://cointelegraph.com/rss' },
];

export interface NewsItem {
  title: string;
  link: string;
  pub_date: string;
  source: string;
  hours_old: number;
}

function parseRss(xml: string, source: string): NewsItem[] {
  const items: NewsItem[] = [];
  const now = Date.now();
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  for (const m of xml.matchAll(itemRe)) {
    const block = m[1];
    const title = (block.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
    const link = (block.match(/<link[^>]*>([\s\S]*?)<\/link>/)?.[1] ?? '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
    const pub = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
    if (!title) continue;
    const pubMs = pub ? Date.parse(pub) : NaN;
    items.push({
      title,
      link,
      pub_date: pub,
      source,
      hours_old: Number.isFinite(pubMs) ? Math.round(((now - pubMs) / 3_600_000) * 10) / 10 : -1,
    });
  }
  return items;
}

export async function fetchNewsForAsset(asset: string, hoursBack: number): Promise<NewsItem[]> {
  const tickerUpper = asset.toUpperCase();
  const tickerLower = asset.toLowerCase();
  const tickerRe = new RegExp(`(^|[^A-Z0-9])${tickerUpper}([^A-Z0-9]|$)|\\$${tickerLower}\\b`, 'i');

  const all: NewsItem[] = [];
  for (const f of FEEDS) {
    try {
      const res = await fetch(f.url, {
        signal: AbortSignal.timeout(7000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; predmcp/1.0; +https://predmcp.com)' },
      });
      if (!res.ok) continue;
      const xml = await res.text();
      const items = parseRss(xml, f.name);
      for (const it of items) {
        if (it.hours_old < 0 || it.hours_old > hoursBack) continue;
        // Match ticker in headline
        if (tickerRe.test(it.title)) all.push(it);
      }
    } catch (err) {
      log.debug('feed fetch failed');
    }
  }
  // Dedupe by link
  const seen = new Set<string>();
  const deduped = all.filter((i) => { if (seen.has(i.link)) return false; seen.add(i.link); return true; });
  deduped.sort((a, b) => a.hours_old - b.hours_old);
  return deduped;
}
