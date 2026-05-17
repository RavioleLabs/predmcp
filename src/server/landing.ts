export const landingHtml = /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PredMCP — Prediction markets for AI agents</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0a0a0f;
    --bg2: #111118;
    --border: #1e1e2e;
    --text: #e2e2f0;
    --muted: #6b6b8a;
    --green: #00d084;
    --red: #ff4f6d;
    --blue: #5b8dee;
    --accent: #7c5cfc;
  }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    line-height: 1.6;
    min-height: 100vh;
  }
  a { color: var(--blue); text-decoration: none; }
  a:hover { text-decoration: underline; }

  /* Nav */
  nav {
    padding: 1.25rem 2rem;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .logo { font-weight: 700; font-size: 1.1rem; letter-spacing: -0.02em; color: #fff; }
  .logo span { color: var(--accent); }
  .badge {
    font-size: 0.7rem;
    background: rgba(124,92,252,0.15);
    color: var(--accent);
    border: 1px solid rgba(124,92,252,0.3);
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
    font-weight: 600;
    letter-spacing: 0.05em;
  }

  /* Hero */
  .hero {
    max-width: 760px;
    margin: 5rem auto 3rem;
    padding: 0 2rem;
    text-align: center;
  }
  h1 {
    font-size: clamp(2rem, 5vw, 3rem);
    font-weight: 800;
    line-height: 1.15;
    letter-spacing: -0.03em;
    color: #fff;
    margin-bottom: 1rem;
  }
  h1 em { color: var(--accent); font-style: normal; }
  .subtitle {
    font-size: 1.1rem;
    color: var(--muted);
    max-width: 520px;
    margin: 0 auto 2.5rem;
  }

  /* Signal block */
  .signal-block {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1.25rem 1.5rem;
    text-align: left;
    font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
    font-size: 0.82rem;
    line-height: 1.8;
    max-width: 600px;
    margin: 0 auto 3.5rem;
  }
  .signal-block .label { color: var(--muted); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.5rem; }
  .green { color: var(--green); }
  .red { color: var(--red); }
  .blue { color: var(--blue); }
  .white { color: #fff; }
  .muted { color: var(--muted); }

  /* Features */
  .tools-section {
    max-width: 860px;
    margin: 0 auto 4rem;
    padding: 0 2rem;
  }
  .tools-label {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--muted);
    font-weight: 600;
    margin-bottom: 0.75rem;
  }
  .features {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    gap: 0.75rem;
    text-align: left;
  }
  .feature {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1.1rem 1.25rem;
  }
  .feature-icon { font-size: 1.3rem; margin-bottom: 0.5rem; }
  .feature h3 { font-size: 0.9rem; font-weight: 600; color: #fff; margin-bottom: 0.25rem; }
  .feature p { font-size: 0.82rem; color: var(--muted); }

  /* Signup */
  .signup-section {
    max-width: 480px;
    margin: 0 auto 6rem;
    padding: 0 2rem;
    text-align: center;
  }
  .signup-section h2 { font-size: 1.4rem; font-weight: 700; color: #fff; margin-bottom: 0.5rem; }
  .signup-section p { color: var(--muted); font-size: 0.9rem; margin-bottom: 1.5rem; }
  .form-row { display: flex; gap: 0.5rem; }
  input[type="email"] {
    flex: 1;
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.75rem 1rem;
    color: var(--text);
    font-size: 0.95rem;
    outline: none;
    transition: border-color 0.15s;
  }
  input[type="email"]:focus { border-color: var(--accent); }
  input[type="email"]::placeholder { color: var(--muted); }
  button {
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 0.75rem 1.25rem;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: opacity 0.15s;
  }
  button:hover { opacity: 0.85; }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  .hint { font-size: 0.78rem; color: var(--muted); margin-top: 0.75rem; }

  /* Result */
  #result { display: none; margin-top: 1.5rem; text-align: left; }
  .result-box {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1.25rem;
  }
  .result-label { font-size: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.5rem; }
  .key-display {
    font-family: monospace;
    font-size: 0.85rem;
    color: var(--green);
    background: rgba(0,208,132,0.08);
    border: 1px solid rgba(0,208,132,0.2);
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    word-break: break-all;
    cursor: pointer;
    transition: background 0.15s;
    position: relative;
  }
  .key-display:hover { background: rgba(0,208,132,0.14); }
  .copy-hint { font-size: 0.72rem; color: var(--muted); margin-top: 0.35rem; }
  .config-block {
    margin-top: 1rem;
    font-family: monospace;
    font-size: 0.78rem;
    background: #0d0d16;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.75rem 1rem;
    color: var(--text);
    white-space: pre;
    overflow-x: auto;
  }
  .success-msg { color: var(--green); font-size: 0.9rem; font-weight: 600; margin-bottom: 1rem; }
  .error-msg { color: var(--red); font-size: 0.85rem; margin-top: 0.5rem; }

  /* Footer */
  footer {
    border-top: 1px solid var(--border);
    padding: 1.5rem 2rem;
    text-align: center;
    color: var(--muted);
    font-size: 0.82rem;
  }
</style>
</head>
<body>

<nav>
  <div class="logo">pred<span>mcp</span></div>
  <span class="badge">FREE TIER AVAILABLE</span>
</nav>

<div class="hero">
  <h1>Prediction markets + Hyperliquid perps,<br><em>for any LLM that calls tools</em></h1>
  <p class="subtitle">
    24 tools. Live data from Polymarket and Hyperliquid (perps + HIP-4) — cross-venue signals, funding outliers, arb opportunities, whale activity.
  </p>

  <div class="signal-block" id="signal-block">
    <div class="label">Live BTC signal <span id="signal-ts" style="font-size:0.7rem;opacity:0.5"></span></div>
    <span class="muted">HL perps: </span><span class="white" id="s-px">—</span><span class="muted"> | funding: </span><span class="white" id="s-funding">—</span><span class="muted"> | OI: </span><span class="white" id="s-oi">—</span><span class="muted"> BTC</span><br>
    <span class="muted">HIP-4:   </span><span class="white" id="s-hip4desc">—</span><span class="muted"> → YES </span><span id="s-hip4yes" class="white">—</span><br>
    <span class="muted">Signal:  </span><span id="s-signal" class="green">loading…</span>
  </div>
</div>

<div style="display:flex;align-items:center;justify-content:center;gap:2.5rem;padding:1.25rem 2rem;border-top:1px solid var(--border);border-bottom:1px solid var(--border);margin-bottom:0">
  <span style="font-size:0.72rem;color:var(--muted);letter-spacing:0.08em;text-transform:uppercase">Data from</span>
  <img src="https://polymarket.com/images/brand/logo-black.png" alt="Polymarket" height="22" style="filter:invert(1) brightness(0.8);opacity:0.75">
  <div style="display:flex;align-items:center;gap:0.5rem;opacity:0.75">
    <img src="https://app.hyperliquid.xyz/favicon-32x32.png" alt="Hyperliquid" height="22" style="border-radius:4px">
    <span style="font-size:0.9rem;font-weight:600;color:var(--text)">Hyperliquid</span>
  </div>
  <span style="font-size:0.8rem;font-weight:600;color:var(--muted);border:1px solid var(--border);padding:0.2rem 0.6rem;border-radius:4px;opacity:0.75">HIP-4</span>
</div>

<div class="tools-section">
  <div class="tools-label">Cross-platform signals</div>
  <div class="features">
    <div class="feature">
      <div class="feature-icon">⚡</div>
      <h3>get_signals</h3>
      <p>Divergence between HL perp funding sentiment and HIP-4 prediction odds.</p>
    </div>
    <div class="feature">
      <div class="feature-icon">🗺️</div>
      <h3>get_market_context</h3>
      <p>All Polymarket + HIP-4 markets for any topic + live HL perp data in one call.</p>
    </div>
    <div class="feature">
      <div class="feature-icon">🔀</div>
      <h3>get_pm_hl_divergences</h3>
      <p>Markets where PM implied probability diverges from HL funding direction. Hard to compute manually.</p>
    </div>
    <div class="feature">
      <div class="feature-icon">📐</div>
      <h3>get_hl_funding_pm_correlation</h3>
      <p>Pairs each HL asset with related PM markets — aligned or divergent signal.</p>
    </div>
    <div class="feature">
      <div class="feature-icon">🏹</div>
      <h3>get_hip4_vs_pm_arb</h3>
      <p>Same market on HIP-4 and Polymarket with exploitable spread between venues.</p>
    </div>
    <div class="feature">
      <div class="feature-icon">🐋</div>
      <h3>get_whale_convergence</h3>
      <p>Simultaneous whale activity on HL perps + Polymarket — leading indicator.</p>
    </div>
  </div>

  <div class="tools-label" style="margin-top:1.5rem">Hyperliquid</div>
  <div class="features">
    <div class="feature">
      <div class="feature-icon">🔝</div>
      <h3>get_top_funding_rates</h3>
      <p>Top perps by absolute funding rate with OI and annualized yield.</p>
    </div>
    <div class="feature">
      <div class="feature-icon">📡</div>
      <h3>get_funding_outliers</h3>
      <p>Perps whose funding deviates from their 7-day average — stronger signal than raw rate.</p>
    </div>
    <div class="feature">
      <div class="feature-icon">🚫</div>
      <h3>get_oi_near_cap</h3>
      <p>Perps at the OI cap — new longs blocked. Use as blacklist for entry.</p>
    </div>
    <div class="feature">
      <div class="feature-icon">💥</div>
      <h3>get_liquidation_clusters</h3>
      <p>Price levels where mass liquidations concentrate by leverage multiple.</p>
    </div>
    <div class="feature">
      <div class="feature-icon">💸</div>
      <h3>get_funding_rates</h3>
      <p>Raw funding rates for any asset.</p>
    </div>
    <div class="feature">
      <div class="feature-icon">📉</div>
      <h3>get_open_interest</h3>
      <p>Open interest in USD and contracts across all perps.</p>
    </div>
    <div class="feature">
      <div class="feature-icon">🐬</div>
      <h3>get_whale_trades</h3>
      <p>Recent large trades above notional threshold.</p>
    </div>
  </div>

  <div class="tools-label" style="margin-top:1.5rem">Polymarket</div>
  <div class="features">
    <div class="feature">
      <div class="feature-icon">⏱️</div>
      <h3>get_markets_near_resolution</h3>
      <p>Markets resolving in the next N hours with probability above threshold.</p>
    </div>
    <div class="feature">
      <div class="feature-icon">🔊</div>
      <h3>get_volume_spikes</h3>
      <p>Markets with abnormal 24h volume vs 7-day average — precedes news.</p>
    </div>
    <div class="feature">
      <div class="feature-icon">🏆</div>
      <h3>get_late_game_sports</h3>
      <p>Sports markets closing soon with high-certainty leading outcome.</p>
    </div>
    <div class="feature">
      <div class="feature-icon">📈</div>
      <h3>get_movers</h3>
      <p>Top 24h volume spikes and biggest price moves.</p>
    </div>
    <div class="feature">
      <div class="feature-icon">📊</div>
      <h3>get_markets</h3>
      <p>Live markets sorted by volume.</p>
    </div>
    <div class="feature">
      <div class="feature-icon">🎯</div>
      <h3>get_odds</h3>
      <p>Current YES/NO price for any token.</p>
    </div>
    <div class="feature">
      <div class="feature-icon">📖</div>
      <h3>get_orderbook</h3>
      <p>Full orderbook depth for any market.</p>
    </div>
    <div class="feature">
      <div class="feature-icon">🔍</div>
      <h3>search_markets</h3>
      <p>Full-text search across Polymarket and HIP-4.</p>
    </div>
    <div class="feature">
      <div class="feature-icon">🏦</div>
      <h3>get_whale_positions</h3>
      <p>Largest position holders in any market.</p>
    </div>
  </div>
</div>

<div class="tools-section" style="margin-bottom:2rem">
  <div class="tools-label">Connect</div>
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:1.5rem 1.75rem;text-align:left;">
    <p style="color:var(--muted);font-size:0.88rem;margin-bottom:1.25rem">Add predmcp to any MCP-compatible client (Claude Desktop, Cursor, Windsurf…)</p>
    <div style="display:flex;flex-direction:column;gap:0.75rem">
      <div>
        <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--muted);margin-bottom:0.35rem">MCP Server URL</div>
        <div style="font-family:monospace;font-size:0.85rem;background:#0d0d16;border:1px solid var(--border);border-radius:6px;padding:0.55rem 0.9rem;color:var(--green);display:flex;justify-content:space-between;align-items:center;gap:1rem">
          <span>https://predmcp.com/mcp</span>
          <button onclick="copyText('https://predmcp.com/mcp', this)" style="background:transparent;border:1px solid var(--border);color:var(--muted);padding:0.2rem 0.6rem;font-size:0.72rem;border-radius:4px;cursor:pointer;white-space:nowrap">Copy</button>
        </div>
      </div>
      <div>
        <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--muted);margin-bottom:0.35rem">Transport</div>
        <div style="font-family:monospace;font-size:0.85rem;background:#0d0d16;border:1px solid var(--border);border-radius:6px;padding:0.55rem 0.9rem;color:var(--text)">streamable-http &nbsp;<span style="color:var(--muted)">·</span>&nbsp; header: <span style="color:var(--accent)">x-api-key</span></div>
      </div>
      <div>
        <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--muted);margin-bottom:0.35rem">Get API Key</div>
        <div style="font-family:monospace;font-size:0.85rem;background:#0d0d16;border:1px solid var(--border);border-radius:6px;padding:0.55rem 0.9rem;color:var(--blue);display:flex;justify-content:space-between;align-items:center;gap:1rem">
          <span>https://predmcp.com/signup</span>
          <button onclick="copyText('https://predmcp.com/signup', this)" style="background:transparent;border:1px solid var(--border);color:var(--muted);padding:0.2rem 0.6rem;font-size:0.72rem;border-radius:4px;cursor:pointer;white-space:nowrap">Copy</button>
        </div>
      </div>
    </div>
    <div style="margin-top:1.25rem;font-family:monospace;font-size:0.78rem;background:#0d0d16;border:1px solid var(--border);border-radius:6px;padding:0.85rem 1rem;color:var(--text);white-space:pre;overflow-x:auto">{
  "mcpServers": {
    "predmcp": {
      "type": "http",
      "url": "https://predmcp.com/mcp",
      "headers": { "x-api-key": "your-key" }
    }
  }
}</div>
  </div>
</div>

<div class="signup-section">
  <h2>Get your free API key</h2>
  <p>100 calls/day free. No credit card. Works with Claude Desktop, Cursor, Windsurf, or any MCP client in 30 seconds.</p>
  <div class="form-row">
    <input type="email" id="email" placeholder="you@example.com" autocomplete="email" required>
    <button id="btn" onclick="signup()">Get key</button>
  </div>
  <p class="hint">Email required. One key per IP. We do not store your raw IP — see the README for what we track.</p>
  <p class="error-msg" id="error"></p>

  <div id="result">
    <div class="result-box">
      <p class="success-msg">Your API key is ready.</p>
      <div class="result-label">API Key — click to copy</div>
      <div class="key-display" id="keyDisplay" onclick="copyKey()"></div>
      <p class="copy-hint" id="copyHint">Click to copy</p>
      <div class="result-label" style="margin-top:1rem">Add to Claude Desktop config</div>
      <div class="config-block" id="configBlock"></div>
    </div>
  </div>
</div>

<footer>
  predmcp.com &nbsp;·&nbsp; Polymarket · Hyperliquid (perps + HIP-4) &nbsp;·&nbsp; <a href="https://github.com/RavioleLabs/predmcp">open source</a>
</footer>

<script>
async function signup() {
  const btn = document.getElementById('btn');
  const email = document.getElementById('email').value.trim();
  const err = document.getElementById('error');
  err.textContent = '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    err.textContent = 'Please enter a valid email address.';
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Generating…';

  try {
    const res = await fetch('/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();

    document.getElementById('keyDisplay').textContent = data.key;
    document.getElementById('configBlock').textContent = JSON.stringify({
      mcpServers: {
        predmcp: {
          type: 'http',
          url: 'https://predmcp.com/mcp',
          headers: { 'x-api-key': data.key }
        }
      }
    }, null, 2);

    document.getElementById('result').style.display = 'block';
    btn.textContent = 'Done';
  } catch (e) {
    err.textContent = 'Something went wrong. Try again.';
    btn.disabled = false;
    btn.textContent = 'Get key';
  }
}

function copyKey() {
  const key = document.getElementById('keyDisplay').textContent;
  navigator.clipboard.writeText(key).then(() => {
    document.getElementById('copyHint').textContent = 'Copied!';
    setTimeout(() => document.getElementById('copyHint').textContent = 'Click to copy', 2000);
  });
}

function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = orig, 2000);
  });
}

document.getElementById('email').addEventListener('keydown', e => {
  if (e.key === 'Enter') signup();
});

(async function loadLiveSignal() {
  try {
    const d = await fetch('/api/live-signal').then(r => r.json());
    if (d.error) return;
    document.getElementById('s-px').textContent = '$' + d.markPx.toLocaleString();
    const f = d.funding;
    const fStr = (f >= 0 ? '+' : '') + f.toFixed(7);
    const fEl = document.getElementById('s-funding');
    fEl.textContent = fStr;
    fEl.className = f > 0 ? 'red' : f < 0 ? 'green' : 'white';
    document.getElementById('s-oi').textContent = d.oi.toLocaleString();
    if (d.hip4Desc) document.getElementById('s-hip4desc').textContent = d.hip4Desc;
    if (d.hip4Yes !== null) {
      const yesEl = document.getElementById('s-hip4yes');
      yesEl.textContent = Math.round(d.hip4Yes * 100) + '%';
      yesEl.className = d.hip4Yes > 0.5 ? 'green' : 'red';
    }
    const sigEl = document.getElementById('s-signal');
    sigEl.textContent = d.signal;
    sigEl.className = d.signal === 'DIVERGENCE' ? 'green' : d.signal === 'ALIGNED' ? 'blue' : 'white';
    document.getElementById('signal-ts').textContent = '· updated ' + new Date(d.ts).toLocaleTimeString();
  } catch {}
})();
</script>
</body>
</html>`;
