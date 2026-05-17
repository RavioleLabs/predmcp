import { getDb } from '../core/db/index.js';

interface StatsRow {
  total_keys: number;
  free_keys: number;
  pro_keys: number;
  active_today: number;
  calls_today: number;
}

interface KeyRow {
  key: string;
  tier: string;
  email: string | null;
  calls_today: number;
  day_bucket: string;
  created_at: number;
  last_seen_at: number | null;
}

function getStats() {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_keys,
      SUM(tier = 'free') as free_keys,
      SUM(tier = 'pro') as pro_keys,
      SUM(day_bucket = ?) as active_today,
      SUM(CASE WHEN day_bucket = ? THEN calls_today ELSE 0 END) as calls_today
    FROM api_keys
  `).get(today, today) as StatsRow;

  const recent = db.prepare(`
    SELECT * FROM api_keys ORDER BY created_at DESC LIMIT 50
  `).all() as KeyRow[];

  const topUsers = db.prepare(`
    SELECT * FROM api_keys WHERE day_bucket = ? ORDER BY calls_today DESC LIMIT 20
  `).all(today) as KeyRow[];

  return { stats, recent, topUsers, today };
}

function timeAgo(ts: number | null): string {
  if (!ts) return 'never';
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function maskKey(key: string): string {
  return key.slice(0, 8) + '…' + key.slice(-4);
}

/** Minimal HTML entity escape. */
function esc(s: string | null | undefined): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildDashboardHtml(): string {
  const { stats, recent, topUsers, today } = getStats();

  const recentRows = recent.map(k => `
    <tr>
      <td><code>${esc(maskKey(k.key))}</code></td>
      <td><span class="badge ${esc(k.tier)}">${esc(k.tier)}</span></td>
      <td>${k.email ? esc(k.email) : '<span class="muted">anon</span>'}</td>
      <td>${k.calls_today} ${k.day_bucket === today ? '' : '<span class="muted">(old)</span>'}</td>
      <td>${esc(timeAgo(k.last_seen_at))}</td>
      <td class="muted">${esc(new Date(k.created_at).toISOString().slice(0, 10))}</td>
    </tr>
  `).join('');

  const topRows = topUsers.map(k => `
    <tr>
      <td><code>${esc(maskKey(k.key))}</code></td>
      <td>${k.email ? esc(k.email) : '<span class="muted">anon</span>'}</td>
      <td><strong>${k.calls_today}</strong></td>
      <td><span class="badge ${esc(k.tier)}">${esc(k.tier)}</span></td>
    </tr>
  `).join('');

  return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>predmcp — dashboard</title>
<meta http-equiv="refresh" content="30">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #0a0a0f; color: #e2e2f0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    font-size: 0.9rem; padding: 2rem;
  }
  h1 { font-size: 1.2rem; font-weight: 700; color: #fff; margin-bottom: 0.25rem; }
  .ts { color: #6b6b8a; font-size: 0.75rem; margin-bottom: 2rem; }
  .cards { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 2rem; }
  .card {
    background: #111118; border: 1px solid #1e1e2e;
    border-radius: 10px; padding: 1.1rem 1.5rem; min-width: 130px;
  }
  .card-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; color: #6b6b8a; margin-bottom: 0.4rem; }
  .card-value { font-size: 2rem; font-weight: 800; color: #fff; line-height: 1; }
  .card-value.green { color: #00d084; }
  .card-value.purple { color: #7c5cfc; }
  h2 { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.08em; color: #6b6b8a; margin: 1.5rem 0 0.75rem; }
  table { width: 100%; border-collapse: collapse; }
  th {
    text-align: left; font-size: 0.72rem; text-transform: uppercase;
    letter-spacing: 0.08em; color: #6b6b8a; padding: 0.5rem 0.75rem;
    border-bottom: 1px solid #1e1e2e;
  }
  td { padding: 0.55rem 0.75rem; border-bottom: 1px solid #111118; color: #e2e2f0; }
  tr:hover td { background: #111118; }
  code { font-family: monospace; color: #7c5cfc; font-size: 0.82rem; }
  .muted { color: #6b6b8a; }
  .badge { font-size: 0.68rem; padding: 0.15rem 0.5rem; border-radius: 999px; font-weight: 600; }
  .badge.free { background: rgba(107,107,138,0.2); color: #6b6b8a; }
  .badge.pro { background: rgba(0,208,132,0.15); color: #00d084; }
</style>
</head>
<body>
<h1>predmcp — usage dashboard</h1>
<p class="ts">Auto-refresh every 30s · ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC</p>

<div class="cards">
  <div class="card">
    <div class="card-label">Total keys</div>
    <div class="card-value">${stats.total_keys ?? 0}</div>
  </div>
  <div class="card">
    <div class="card-label">Active today</div>
    <div class="card-value green">${stats.active_today ?? 0}</div>
  </div>
  <div class="card">
    <div class="card-label">Calls today</div>
    <div class="card-value purple">${stats.calls_today ?? 0}</div>
  </div>
  <div class="card">
    <div class="card-label">Free</div>
    <div class="card-value">${stats.free_keys ?? 0}</div>
  </div>
  <div class="card">
    <div class="card-label">Pro</div>
    <div class="card-value green">${stats.pro_keys ?? 0}</div>
  </div>
</div>

<h2>Top users today</h2>
<table>
  <tr><th>Key</th><th>Email</th><th>Calls</th><th>Tier</th></tr>
  ${topRows || '<tr><td colspan="4" class="muted" style="padding:1rem">No activity yet today</td></tr>'}
</table>

<h2>All keys (recent first)</h2>
<table>
  <tr><th>Key</th><th>Tier</th><th>Email</th><th>Calls today</th><th>Last seen</th><th>Created</th></tr>
  ${recentRows || '<tr><td colspan="6" class="muted" style="padding:1rem">No keys yet</td></tr>'}
</table>
</body>
</html>`;
}
