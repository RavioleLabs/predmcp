export const landingHtml = /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PredMCP — Safe, read-only market data for AI trading agents</title>
<meta name="description" content="47 MCP tools for Polymarket + Hyperliquid. Give your AI agent live market data, orderbooks, funding rates, whale activity — read-only by design. No execution endpoints. No keys at risk.">
<meta name="keywords" content="MCP server, Model Context Protocol, read-only trading data, safe AI trading, Polymarket API, Hyperliquid API, prediction markets API, crypto market data, AI agents, Claude tools, Cursor MCP, funding rates API, HIP-4, on-chain data">
<meta name="author" content="Raviole Labs">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
<link rel="canonical" href="https://predmcp.com/">

<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:url" content="https://predmcp.com/">
<meta property="og:title" content="PredMCP — Safe, read-only market data for AI agents">
<meta property="og:description" content="47 MCP tools spanning Polymarket and Hyperliquid (perps + HIP-4). Plug your agent into live trading data — without ever giving it the ability to execute orders. Free during early access.">
<meta property="og:image" content="https://predmcp.com/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:site_name" content="PredMCP">
<meta property="og:locale" content="en_US">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@leraviole_">
<meta name="twitter:title" content="PredMCP — Safe, read-only market data for AI agents">
<meta name="twitter:description" content="47 MCP tools for Polymarket + Hyperliquid. Read-only by design — your agent gets the data, never the keys. Free during early access.">
<meta name="twitter:image" content="https://predmcp.com/og-image.png">

<!-- Icons -->
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="alternate icon" href="/favicon.ico">
<link rel="apple-touch-icon" href="/favicon.svg">

<!-- Theme -->
<meta name="theme-color" content="#000000">
<meta name="color-scheme" content="dark">

<!-- Fonts -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap">

<!-- Structured data: SoftwareApplication + Organization -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "PredMCP",
      "applicationCategory": "DeveloperApplication",
      "operatingSystem": "Cross-platform",
      "url": "https://predmcp.com/",
      "description": "MCP server giving AI agents safe, read-only access to Polymarket and Hyperliquid market data. 47 tools including cross-venue signals, orderbook depth, funding rates, whale activity. No execution endpoints — your agent reads markets, never trades them.",
      "offers": [
        { "@type": "Offer", "name": "Early access", "price": "0", "priceCurrency": "USD", "description": "All 47 tools, no credit card. First 50 signups grandfathered when paid plans launch." }
      ],
      "publisher": { "@id": "https://raviolelabs.com/#org" }
    },
    {
      "@type": "Organization",
      "@id": "https://raviolelabs.com/#org",
      "name": "Raviole Labs",
      "url": "https://raviolelabs.com/",
      "sameAs": [
        "https://github.com/RavioleLabs",
        "https://twitter.com/leraviole_",
        "https://discord.gg/nVv6Ssr3"
      ]
    },
    {
      "@type": "WebSite",
      "url": "https://predmcp.com/",
      "name": "PredMCP",
      "publisher": { "@id": "https://raviolelabs.com/#org" }
    }
  ]
}
</script>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    /* Surfaces */
    --bg: #000;
    --bg-elev: #0c0c10;
    --bg-elev-2: #131319;
    --line: #18181b;
    --line-strong: #27272a;

    /* Ink */
    --ink: #fafafa;
    --ink-dim: #a1a1aa;
    --ink-mute: #71717a;
    --ink-faint: #52525b;

    /* Accent — emerald for PredMCP */
    --accent: #34d399;
    --accent-deep: #059669;
    --accent-glow: color-mix(in srgb, var(--accent) 40%, transparent);

    /* Semantic */
    --green: #4ade80;
    --amber: #f59e0b;
    --red: #f87171;
    --blue: #60a5fa;
    --cyan: #22d3ee;

    /* Type */
    --sans: 'Inter', system-ui, -apple-system, sans-serif;
    --mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;

    /* Layout */
    --max: 1100px;
    --max-narrow: 760px;
    --radius: 12px;
    --radius-sm: 8px;
    --radius-pill: 999px;

    /* Legacy aliases (used by parts of JS-injected content) */
    --bg2: var(--bg-elev);
    --border: var(--line);
    --text: var(--ink);
    --muted: var(--ink-dim);
  }

  body {
    background: var(--bg);
    color: var(--ink);
    font-family: var(--sans);
    font-size: 16px;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  ::selection { background: var(--accent); color: #000; }

  a { color: var(--accent); text-decoration: none; transition: color 0.15s ease; }
  a:hover { color: var(--ink); }

  h1, h2, h3, h4 {
    font-family: var(--sans);
    font-weight: 600;
    letter-spacing: -0.02em;
    line-height: 1.15;
    color: var(--ink);
  }
  h1 { font-size: clamp(2.4rem, 6vw, 4rem); letter-spacing: -0.035em; font-weight: 700; }
  h2 { font-size: clamp(1.5rem, 2.8vw, 2rem); }
  h3 { font-size: 1.05rem; font-weight: 600; }

  code, .mono { font-family: var(--mono); }

  /* ── Layout ────────────────────────────────────────────────────────── */
  .container { max-width: var(--max); margin: 0 auto; padding: 0 1.5rem; }
  .narrow { max-width: var(--max-narrow); margin: 0 auto; padding: 0 1.5rem; }

  /* ── Header ────────────────────────────────────────────────────────── */
  .site-header {
    border-bottom: 1px solid var(--line);
    background: rgba(0, 0, 0, 0.55);
    -webkit-backdrop-filter: blur(14px) saturate(160%);
            backdrop-filter: blur(14px) saturate(160%);
    position: sticky;
    top: 0;
    z-index: 50;
  }
  .header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    height: 64px;
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 0.55em;
    font-weight: 600;
    color: var(--ink);
    font-size: 0.95rem;
    letter-spacing: -0.015em;
  }
  .brand .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent);
  }
  .brand-name { color: var(--ink); }
  .brand-name em { font-style: normal; color: var(--accent); }
  .header-links { display: flex; align-items: center; gap: 0.75rem; }
  .header-link {
    display: inline-flex; align-items: center; gap: 0.4rem;
    font-size: 0.82rem; color: var(--ink-dim);
    border: 1px solid var(--line-strong); padding: 0.35rem 0.75rem;
    border-radius: var(--radius-sm); font-family: var(--sans);
  }
  .header-link:hover { color: var(--ink); border-color: var(--accent); }
  .chip {
    font-family: var(--mono);
    font-size: 0.7rem;
    font-weight: 500;
    padding: 0.3em 0.7em;
    border-radius: var(--radius-pill);
    border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--line-strong));
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 8%, var(--bg-elev));
    letter-spacing: 0.12em;
  }

  /* ── Hero ──────────────────────────────────────────────────────────── */
  .hero {
    position: relative;
    padding: 5rem 0 4.5rem;
    overflow: hidden;
  }
  .hero-bg {
    position: absolute; inset: 0; pointer-events: none;
    background:
      radial-gradient(ellipse 60% 60% at 15% 15%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 60%),
      radial-gradient(ellipse 50% 50% at 85% 80%, color-mix(in srgb, var(--accent) 10%, transparent), transparent 60%);
  }
  .hero .container { position: relative; }
  .hero h1 {
    max-width: 22ch;
    margin: 0 0 1.3rem;
  }
  .hero h1 em { font-style: normal; color: var(--ink-mute); }
  .subtitle {
    color: var(--ink-dim);
    max-width: 60ch;
    font-size: 1.1rem;
    line-height: 1.6;
    margin: 0;
  }

  /* ── Live signal block ─────────────────────────────────────────────── */
  .signal-block {
    margin-top: 2rem;
    background: var(--bg-elev);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 1.25rem 1.4rem;
    font-family: var(--mono);
    font-size: 0.85rem;
    line-height: 1.85;
    max-width: 640px;
  }
  .signal-block .label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--ink-mute);
    margin-bottom: 0.6rem;
  }
  .signal-block .white { color: var(--ink); }
  .signal-block .green { color: var(--green); font-weight: 600; }
  .signal-block .red { color: var(--red); font-weight: 600; }
  .signal-block .blue { color: var(--blue); font-weight: 600; }
  .signal-block .muted { color: var(--ink-mute); }

  /* ── Data-from strip ───────────────────────────────────────────────── */
  .trust-strip {
    display: flex; align-items: center; justify-content: center;
    gap: 2.5rem;
    padding: 1.25rem 2rem;
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
    flex-wrap: wrap;
  }
  .trust-strip .label {
    font-family: var(--mono);
    font-size: 0.72rem;
    color: var(--ink-mute);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  /* ── Section base ──────────────────────────────────────────────────── */
  .section { padding: 5rem 0; border-top: 1px solid var(--line); }
  .section:first-of-type { border-top: 0; }
  .kicker {
    display: inline-flex;
    align-items: center;
    gap: 0.5em;
    font-family: var(--mono);
    font-size: 0.72rem;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent);
    margin: 0 0 1rem;
  }
  .kicker::before {
    content: '';
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 8px var(--accent-glow);
  }
  .section h2 { margin: 0 0 0.8rem; max-width: 26ch; }
  .section-sub { color: var(--ink-dim); max-width: 60ch; font-size: 1.02rem; margin: 0 0 2.5rem; line-height: 1.6; }

  /* ── Tools grid ────────────────────────────────────────────────────── */
  .tool-section { margin-bottom: 2.5rem; }
  .tool-section:last-child { margin-bottom: 0; }
  .tool-label {
    color: var(--ink-mute);
    font-family: var(--mono);
    font-size: 0.72rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin: 0 0 1rem;
  }
  .tool-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.7rem;
  }
  @media (max-width: 900px) { .tool-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 600px) { .tool-grid { grid-template-columns: 1fr; } }
  .tool {
    background: var(--bg-elev);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    padding: 0.9rem 1rem;
    transition: border-color 0.15s ease, background 0.15s ease;
  }
  .tool:hover {
    border-color: color-mix(in srgb, var(--accent) 35%, var(--line-strong));
    background: var(--bg-elev-2);
  }
  .tool-name { color: var(--accent); font-family: var(--mono); font-size: 0.82rem; font-weight: 500; }
  .tool-desc { color: var(--ink-dim); font-size: 0.84rem; margin-top: 0.35rem; line-height: 1.45; }

  /* ── Connect block ─────────────────────────────────────────────────── */
  .connect {
    background: var(--bg-elev);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 1.6rem 1.75rem;
  }
  .connect-field { margin-bottom: 1rem; }
  .connect-field:last-of-type { margin-bottom: 0; }
  .connect-label {
    font-family: var(--mono);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--ink-mute);
    margin-bottom: 0.4rem;
  }
  .connect-value {
    font-family: var(--mono);
    font-size: 0.85rem;
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    padding: 0.6rem 0.9rem;
    color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  .connect-copy {
    background: transparent;
    border: 1px solid var(--line-strong);
    color: var(--ink-dim);
    padding: 0.25rem 0.65rem;
    font-size: 0.72rem;
    border-radius: 4px;
    cursor: pointer;
    white-space: nowrap;
    font-family: var(--mono);
  }
  .connect-copy:hover { color: var(--accent); border-color: var(--accent); }
  .connect-config {
    margin-top: 1.25rem;
    font-family: var(--mono);
    font-size: 0.78rem;
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    padding: 0.95rem 1.1rem;
    color: var(--ink);
    white-space: pre;
    overflow-x: auto;
  }

  /* ── Client tutorial cards ─────────────────────────────────────────── */
  .clients-grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    margin-top: 1.5rem;
  }
  .client-card {
    background: var(--bg-elev);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 1.4rem 1.5rem;
    display: flex;
    flex-direction: column;
  }
  .client-card h3 {
    margin: 0 0 0.5rem;
    font-size: 1.05rem;
    color: var(--ink);
  }
  .client-card .client-sub {
    color: var(--ink-mute);
    font-size: 0.8rem;
    margin: 0 0 1rem;
    font-family: var(--mono);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .client-card p { color: var(--ink-dim); font-size: 0.88rem; line-height: 1.55; margin: 0 0 0.9rem; }
  .client-card ol { margin: 0 0 1rem 1.1rem; padding: 0; color: var(--ink-dim); font-size: 0.88rem; line-height: 1.6; }
  .client-card ol li { margin-bottom: 0.35rem; }
  .client-card code, .client-card .inline-mono {
    font-family: var(--mono);
    font-size: 0.82rem;
    color: var(--accent);
    background: var(--bg);
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
    word-break: break-all;
  }
  .client-card .client-code {
    margin-top: auto;
    font-family: var(--mono);
    font-size: 0.74rem;
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    padding: 0.8rem 0.95rem;
    color: var(--ink);
    white-space: pre-wrap;
    word-break: break-all;
    overflow-x: auto;
  }
  .client-card .client-note {
    font-size: 0.78rem;
    color: var(--ink-mute);
    margin-top: 0.6rem;
    line-height: 1.5;
  }

  /* ── Signup ────────────────────────────────────────────────────────── */
  .signup-card {
    background:
      radial-gradient(ellipse at top right, color-mix(in srgb, var(--accent) 14%, transparent), transparent 60%),
      var(--bg-elev);
    border: 1px solid color-mix(in srgb, var(--accent) 25%, var(--line-strong));
    border-radius: var(--radius);
    padding: 2.5rem 2.2rem;
  }
  .signup-card h2 { margin: 0 0 0.6rem; font-size: 1.6rem; }
  .signup-card p { color: var(--ink-dim); margin: 0 0 1.5rem; font-size: 0.95rem; }
  .form-row { display: flex; gap: 0.6rem; }
  .form-row input {
    flex: 1;
    background: var(--bg);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    padding: 0.75rem 1rem;
    color: var(--ink);
    font-size: 1rem;
    font-family: var(--sans);
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .form-row input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent);
  }
  button {
    background: var(--accent);
    color: #000;
    border: 0;
    padding: 0.75rem 1.3rem;
    border-radius: var(--radius-sm);
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    font-family: var(--sans);
    transition: filter 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
  }
  button:hover:not(:disabled) {
    filter: brightness(1.1);
    transform: translateY(-1px);
    box-shadow: 0 0 24px var(--accent-glow);
  }
  button:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
  .hint { color: var(--ink-mute); font-size: 0.82rem; margin-top: 0.6rem; }
  .error-msg { color: var(--red); font-size: 0.85rem; margin-top: 0.6rem; min-height: 1.2em; }
  .success-msg { color: var(--accent); font-size: 0.95rem; font-weight: 600; }

  /* ── Result ────────────────────────────────────────────────────────── */
  #result { display: none; margin-top: 1.5rem; }
  .result-box {
    background: var(--bg);
    border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--line-strong));
    border-radius: var(--radius);
    padding: 1.6rem 1.6rem;
  }
  .result-label {
    font-family: var(--mono);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--ink-mute);
    margin-bottom: 0.5rem;
  }
  .key-display {
    font-family: var(--mono);
    background: var(--bg-elev);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    padding: 0.9rem 1rem;
    color: var(--accent);
    font-size: 0.95rem;
    cursor: pointer;
    word-break: break-all;
    transition: border-color 0.15s ease;
  }
  .key-display:hover { border-color: var(--accent); }
  .copy-hint { font-size: 0.78rem; color: var(--ink-mute); margin-top: 0.4rem; }
  .config-block {
    font-family: var(--mono);
    font-size: 0.78rem;
    background: var(--bg-elev);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    padding: 0.95rem 1.1rem;
    color: var(--ink);
    white-space: pre;
    overflow-x: auto;
  }

  /* ── Pricing ───────────────────────────────────────────────────────── */
  .price-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.2rem;
  }
  @media (max-width: 760px) { .price-grid { grid-template-columns: 1fr; } }
  .price-card {
    background: var(--bg-elev);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 2rem 1.8rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .price-card--accent {
    background:
      radial-gradient(ellipse at top right, color-mix(in srgb, var(--accent) 18%, transparent), transparent 60%),
      var(--bg-elev);
    border-color: color-mix(in srgb, var(--accent) 35%, var(--line-strong));
  }
  .price-tier {
    font-family: var(--mono);
    font-size: 0.72rem;
    color: var(--ink-mute);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    margin-bottom: 0.6rem;
  }
  .price-card--accent .price-tier { color: var(--accent); }
  .price-amount {
    font-family: var(--mono);
    font-size: 2.4rem;
    font-weight: 600;
    color: var(--ink);
    letter-spacing: -0.03em;
    line-height: 1;
  }
  .per { font-size: 0.85rem; color: var(--ink-mute); font-weight: 400; margin-left: 0.3em; }
  .price-features {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    color: var(--ink-dim);
    font-size: 0.93rem;
  }
  .price-features li {
    padding-left: 1.4rem;
    position: relative;
  }
  .price-features li::before {
    content: '✓';
    position: absolute;
    left: 0;
    color: var(--accent);
    font-family: var(--mono);
  }
  .price-tag {
    font-family: var(--mono);
    font-size: 0.65rem;
    background: color-mix(in srgb, var(--accent) 18%, var(--bg-elev));
    color: var(--accent);
    border: 1px solid color-mix(in srgb, var(--accent) 40%, var(--line));
    padding: 0.15rem 0.55rem;
    border-radius: var(--radius-pill);
    font-weight: 600;
    letter-spacing: 0.08em;
  }
  .button-full { width: 100%; justify-content: center; }
  .button-ghost {
    background: transparent;
    color: var(--ink);
    border: 1px solid var(--line-strong);
  }
  .button-ghost:hover {
    background: var(--bg-elev);
    color: var(--accent);
    border-color: var(--accent);
    filter: none;
    box-shadow: none;
  }
  .button-outline {
    background: transparent;
    color: var(--accent);
    border: 1px solid var(--accent);
  }
  .button-outline:hover {
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    color: var(--accent);
    filter: none;
    box-shadow: none;
  }

  /* ── Footer ────────────────────────────────────────────────────────── */
  .site-footer {
    border-top: 1px solid var(--line);
    margin-top: 4rem;
    padding: 2.5rem 1.5rem 3rem;
    text-align: center;
    color: var(--ink-mute);
    font-size: 0.85rem;
  }
  .site-footer a { color: var(--ink-dim); }
  .site-footer a:hover { color: var(--accent); }

  @media (max-width: 700px) {
    body { font-size: 15px; }
    .hero { padding: 3.5rem 0 3rem; }
    .section { padding: 3.5rem 0; }
    .signup-card { padding: 1.8rem 1.5rem; }
  }
</style>
</head>
<body>

<header class="site-header">
  <div class="container header-row">
    <a href="/" class="brand">
      <span class="dot" aria-hidden="true"></span>
      <span class="brand-name">pred<em>mcp</em></span>
    </a>
    <div class="header-links">
      <a href="https://github.com/RavioleLabs/predmcp" target="_blank" rel="noopener" class="header-link">
        <svg height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
        </svg>
        Open source
      </a>
      <span class="chip">READ-ONLY · EARLY ACCESS</span>
    </div>
  </div>
</header>

<!-- ── Hero ────────────────────────────────────────────────────────── -->
<section class="hero">
  <div class="hero-bg" aria-hidden="true"></div>
  <div class="container">
    <h1>Market data for AI agents.<br><em>Read-only by design.</em></h1>
    <p class="subtitle">
      47 MCP tools that cross Polymarket prediction markets, Hyperliquid perps,
      and HIP-4 native predictions &mdash; with cross-venue divergence signals,
      funding outliers, and whale flow built in. Your agent reads every market;
      it never gets the keys to trade.
    </p>

    <div class="signal-block" id="signal-block">
      <div class="label">Live BTC signal <span id="signal-ts" style="font-family:var(--mono);font-size:0.7rem;color:var(--ink-faint);text-transform:none;letter-spacing:0"></span></div>
      <span class="muted">HL perps: </span><span class="white" id="s-px">—</span><span class="muted"> | funding: </span><span class="white" id="s-funding">—</span><span class="muted"> | OI: </span><span class="white" id="s-oi">—</span><span class="muted"> BTC</span><br>
      <span class="muted">HIP-4:   </span><span class="white" id="s-hip4desc">—</span><span class="muted"> → YES </span><span id="s-hip4yes" class="white">—</span><br>
      <span class="muted">Signal:  </span><span id="s-signal" class="green">loading…</span>
    </div>
  </div>
</section>

<!-- ── Data from strip ───────────────────────────────────────────────── -->
<div class="container">
  <div class="trust-strip">
    <span class="label">Data from</span>
    <img src="https://polymarket.com/images/brand/logo-black.png" alt="Polymarket" height="22" style="filter:invert(1) brightness(0.8);opacity:0.75">
    <div style="display:flex;align-items:center;gap:0.5rem;opacity:0.8">
      <img src="https://app.hyperliquid.xyz/favicon-32x32.png" alt="Hyperliquid" height="22" style="border-radius:4px">
      <span style="font-size:0.9rem;font-weight:600;color:var(--ink)">Hyperliquid</span>
    </div>
    <span class="chip" style="opacity:0.85">HIP-4</span>
  </div>
</div>

<!-- ── Safety section ─────────────────────────────────────────────────── -->
<section class="section" style="padding-top:3rem;padding-bottom:3rem;border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:var(--bg-elev)">
  <div class="container">
    <p class="kicker" style="color:var(--accent)">Safety by design</p>
    <h2>Your agent gets the data. It never gets the keys.</h2>
    <p class="section-sub">
      The #1 worry when wiring an LLM to a trading venue is the same in every
      conversation: <em>"and it can't actually trade, right?"</em> PredMCP is
      built so that question has a single answer.
    </p>
    <div class="tool-grid" style="margin-top:1.5rem">
      <div class="tool">
        <span class="tool-name">No execution endpoint</span>
        <p class="tool-desc">Zero order-placement code exists in this codebase. Not gated, not commented out &mdash; not implemented. There is nothing to enable.</p>
      </div>
      <div class="tool">
        <span class="tool-name">No private keys touched</span>
        <p class="tool-desc">We use the public Hyperliquid Info API and Polymarket Gamma API. Your wallet, your seed phrase, your accounts &mdash; never seen, never asked for.</p>
      </div>
      <div class="tool">
        <span class="tool-name">47 tools, all queries</span>
        <p class="tool-desc">Markets, orderbooks, funding rates, whale activity, signals. Every tool is a read. Your agent reasons about markets; you stay the only one who can act on them.</p>
      </div>
    </div>
  </div>
</section>

<!-- ── Tools grid ─────────────────────────────────────────────────────── -->
<section class="section">
  <div class="container">
    <p class="kicker">47 MCP tools</p>
    <h2>A vocabulary for prediction markets.</h2>
    <p class="section-sub">
      Each tool is one verb your agent can call. Self-documenting via MCP.
      All 47 tools open during early access &mdash; no gating, no paid section.
    </p>

    <div class="tool-section">
      <p class="tool-label">The accumulation layer · 6 tools · data only predmcp has</p>
      <div class="tool-grid">
        <div class="tool"><span class="tool-name">get_recent_signals</span><p class="tool-desc">Server-detected events from the last hour, cursor-based. The polling equivalent of the SSE stream — for agents that can't hold a connection.</p></div>
        <div class="tool"><span class="tool-name">get_signal_history</span><p class="tool-desc">7 days of detected events, each joined with its measured 1h/4h/24h forward return. "What happened last time — and did it matter?"</p></div>
        <div class="tool"><span class="tool-name">get_signal_performance</span><p class="tool-desc">Hit rates measured on OUR production detections, not backtest reconstructions. The live track record.</p></div>
        <div class="tool"><span class="tool-name">get_oi_history</span><p class="tool-desc">Open-interest time series from our continuous 5-min collector. Hyperliquid has no OI-history endpoint — this exists only here.</p></div>
        <div class="tool"><span class="tool-name">get_oi_divergence</span><p class="tool-desc">Price-vs-OI regime per coin: NEW_LONGS / SHORT_SQUEEZE / NEW_SHORTS / LONG_LIQUIDATION.</p></div>
        <div class="tool"><span class="tool-name">get_whale_flow</span><p class="tool-desc">Cumulative whale buy/sell imbalance over hours-to-days from the durable ≥$25k trade tape.</p></div>
      </div>
    </div>

    <div class="tool-section">
      <p class="tool-label">Decision support · 7 tools</p>
      <div class="tool-grid">
        <div class="tool"><span class="tool-name">get_position_size</span><p class="tool-desc">Signal + bankroll → a number. Fractional-Kelly capped by orderbook depth, ATR stop, liquidation price, funding cost. Warns when liq sits inside your stop.</p></div>
        <div class="tool"><span class="tool-name">get_signal_backtest</span><p class="tool-desc">Forward returns (1h / 4h / 24h) for historical instances of any signal. Median, win rate, Sharpe. Reason about EV before trading.</p></div>
        <div class="tool"><span class="tool-name">get_conviction_score</span><p class="tool-desc">Aggregates funding, whale flow, OI, momentum into one directional score (-100..+100) + strength (0..100). Replaces 6 calls.</p></div>
        <div class="tool"><span class="tool-name">get_setup_quality</span><p class="tool-desc">Execution score (0-100, A-F): spread, slippage, depth, vol regime, trend alignment, S&R distance. How good is entering RIGHT NOW.</p></div>
        <div class="tool"><span class="tool-name">get_carry_scanner</span><p class="tool-desc">Funding carry NET of spread + slippage at your size, with break-even holding period and 7d stability score.</p></div>
        <div class="tool"><span class="tool-name">get_cross_venue_funding</span><p class="tool-desc">HL vs Binance vs Bybit predicted funding spreads. Delta-neutral carry: long the cheap venue, short the rich one.</p></div>
        <div class="tool"><span class="tool-name">get_funding_curve_anomaly</span><p class="tool-desc">Term structure: 1h vs 8h vs 24h vs 7d. Spikes, regime shifts, sign contradictions. Funding finer than the raw rate.</p></div>
      </div>
    </div>

    <div class="tool-section">
      <p class="tool-label">Cross-venue signals · 4 tools</p>
      <div class="tool-grid">
        <div class="tool"><span class="tool-name">get_signals</span><p class="tool-desc">Divergence between HL perp funding sentiment and HIP-4 prediction odds.</p></div>
        <div class="tool"><span class="tool-name">get_market_context</span><p class="tool-desc">All Polymarket + HIP-4 markets for any topic plus live HL perp data in one call.</p></div>
        <div class="tool"><span class="tool-name">get_pm_hl_divergences</span><p class="tool-desc">Markets where PM implied probability diverges from HL funding direction.</p></div>
        <div class="tool"><span class="tool-name">get_hip4_vs_pm_arb</span><p class="tool-desc">Same market on HIP-4 and Polymarket with exploitable spread between venues.</p></div>
      </div>
    </div>

    <div class="tool-section">
      <p class="tool-label">Macro &amp; catalysts · 6 tools</p>
      <div class="tool-grid">
        <div class="tool"><span class="tool-name">get_market_regime</span><p class="tool-desc">One-call regime classifier: RISK_ON_TRENDING / RISK_OFF / SQUEEZE_RISK / CHOP. Call first, every session.</p></div>
        <div class="tool"><span class="tool-name">get_macro_context</span><p class="tool-desc">DXY, US10Y, S&P, gold, VIX, BTC dominance, ETH/BTC. RISK_ON / RISK_OFF regime.</p></div>
        <div class="tool"><span class="tool-name">get_macro_liquidity</span><p class="tool-desc">BTC + ETH spot ETF flows (Farside) + USDT/USDC mint/burn (Etherscan). Fresh fiat-to-crypto flow.</p></div>
        <div class="tool"><span class="tool-name">get_cex_outflows</span><p class="tool-desc">Net ETH outflows from CEX hot wallets (Binance, Coinbase, OKX, Kraken). Outflow = bullish.</p></div>
        <div class="tool"><span class="tool-name">get_upcoming_catalysts</span><p class="tool-desc">Token unlocks, governance votes (Tally), SEC/ETF deadlines, FOMC dates. Avoid blind event trades.</p></div>
        <div class="tool"><span class="tool-name">get_news_correlation</span><p class="tool-desc">Recent crypto news headlines (4 outlets) + the 1h price move that followed.</p></div>
      </div>
    </div>

    <div class="tool-section">
      <p class="tool-label">Risk &amp; options · 3 tools</p>
      <div class="tool-grid">
        <div class="tool"><span class="tool-name">get_portfolio_risk</span><p class="tool-desc">Beta to BTC/ETH, correlation matrix, ann vol, 1d VaR for a list of positions.</p></div>
        <div class="tool"><span class="tool-name">get_options_iv</span><p class="tool-desc">BTC/ETH ATM IV, put-call skew, term structure via Deribit free feed.</p></div>
        <div class="tool"><span class="tool-name">get_whale_label</span><p class="tool-desc">Look up an Ethereum address in our curated label DB (CEX, market makers, funds).</p></div>
      </div>
    </div>

    <div class="tool-section">
      <p class="tool-label">Streaming · push, not polling</p>
      <div class="tool-grid">
        <div class="tool"><span class="tool-name">GET /sse/signals</span><p class="tool-desc">Server-Sent Events stream of <code>funding_outlier_new</code>, <code>whale_trade</code>, <code>oi_cap_reached</code> events as they fire. One persistent connection replaces 1h polling.</p></div>
      </div>
    </div>

    <div class="tool-section">
      <p class="tool-label">Hyperliquid · 6 tools</p>
      <div class="tool-grid">
        <div class="tool"><span class="tool-name">get_funding_rates</span><p class="tool-desc">Funding + OI + mark price for one or all perps in a single call.</p></div>
        <div class="tool"><span class="tool-name">get_top_funding_rates</span><p class="tool-desc">Top perps by absolute funding rate with OI and annualized yield.</p></div>
        <div class="tool"><span class="tool-name">get_funding_outliers</span><p class="tool-desc">Perps whose funding deviates from their 7-day average. Stronger signal than raw rate.</p></div>
        <div class="tool"><span class="tool-name">get_oi_near_cap</span><p class="tool-desc">Perps at the OI cap. New longs blocked. Use as blacklist for entry.</p></div>
        <div class="tool"><span class="tool-name">get_liquidation_clusters</span><p class="tool-desc">Price levels where mass liquidations concentrate by leverage multiple.</p></div>
        <div class="tool"><span class="tool-name">get_whale_trades</span><p class="tool-desc">Recent large trades above notional threshold, from the live 30s tape.</p></div>
      </div>
    </div>

    <div class="tool-section">
      <p class="tool-label">Polymarket &amp; basics · 14 tools</p>
      <div class="tool-grid">
        <div class="tool"><span class="tool-name">get_markets_near_resolution</span><p class="tool-desc">Markets resolving in the next N hours with probability above threshold.</p></div>
        <div class="tool"><span class="tool-name">get_volume_spikes</span><p class="tool-desc">Markets with abnormal 24h volume vs 7-day average. Often precedes news.</p></div>
        <div class="tool"><span class="tool-name">get_late_game_sports</span><p class="tool-desc">Sports markets closing soon with high-certainty leading outcome.</p></div>
        <div class="tool"><span class="tool-name">get_movers</span><p class="tool-desc">Top 24h volume spikes and biggest price moves.</p></div>
        <div class="tool"><span class="tool-name">get_markets</span><p class="tool-desc">Live markets sorted by volume.</p></div>
        <div class="tool"><span class="tool-name">get_odds</span><p class="tool-desc">Current YES/NO price for any token.</p></div>
        <div class="tool"><span class="tool-name">get_orderbook</span><p class="tool-desc">Full orderbook depth for any Polymarket token.</p></div>
        <div class="tool"><span class="tool-name">get_orderbook_depth</span><p class="tool-desc">Depth + slippage estimate for any HL perp or HIP-4 market.</p></div>
        <div class="tool"><span class="tool-name">search_markets</span><p class="tool-desc">Full-text search across Polymarket and HIP-4.</p></div>
        <div class="tool"><span class="tool-name">get_whale_positions</span><p class="tool-desc">Positions of any Polymarket wallet, optionally filtered by market.</p></div>
        <div class="tool"><span class="tool-name">get_price_summary</span><p class="tool-desc">Mark price, 24h/7d returns, 30d high/low, annualized vol in one call.</p></div>
        <div class="tool"><span class="tool-name">get_basic_macro</span><p class="tool-desc">DXY, US10Y, S&P 500, gold, VIX from free Yahoo feed.</p></div>
        <div class="tool"><span class="tool-name">get_recent_news</span><p class="tool-desc">Headlines for an asset from 4 crypto RSS feeds.</p></div>
        <div class="tool"><span class="tool-name">get_simple_iv</span><p class="tool-desc">BTC/ETH ATM implied volatility + OI via Deribit.</p></div>
      </div>
    </div>
  </div>
</section>

<!-- ── Connect ────────────────────────────────────────────────────────── -->
<section class="section">
  <div class="container">
    <p class="kicker">Connect</p>
    <h2>Add predmcp to any MCP-compatible client.</h2>
    <p class="section-sub">
      Claude Desktop, Cursor, Windsurf, Cline, Continue, Clawbot, custom
      runtimes. Drop the endpoint into your config, restart, and the
      forty-seven tools show up.
    </p>

    <div class="connect">
      <div class="connect-field">
        <div class="connect-label">MCP server URL</div>
        <div class="connect-value">
          <span>https://predmcp.com/mcp</span>
          <button onclick="copyText('https://predmcp.com/mcp', this)" class="connect-copy">Copy</button>
        </div>
      </div>
      <div class="connect-field">
        <div class="connect-label">Transport</div>
        <div class="connect-value" style="color:var(--ink)">
          <span>streamable-http &nbsp;<span style="color:var(--ink-mute)">·</span>&nbsp; header: <span style="color:var(--accent)">x-api-key</span></span>
        </div>
      </div>
      <div class="connect-field">
        <div class="connect-label">Get API key</div>
        <div class="connect-value" style="color:var(--blue)">
          <span>https://predmcp.com/signup</span>
          <button onclick="copyText('https://predmcp.com/signup', this)" class="connect-copy">Copy</button>
        </div>
      </div>
      <div class="connect-config">{
  "mcpServers": {
    "predmcp": {
      "type": "http",
      "url": "https://predmcp.com/mcp",
      "headers": { "x-api-key": "your-key" }
    }
  }
}</div>
    </div>

    <h3 style="margin-top:3rem;margin-bottom:0.4rem;font-size:1.15rem;color:var(--ink)">Pick your client</h3>
    <p style="color:var(--ink-dim);font-size:0.92rem;margin:0">Three setup paths. Claude.ai signs you in directly via OAuth — no key handling. Everything else uses an API key (replace <span class="inline-mono" style="font-family:var(--mono);color:var(--accent)">YOUR_KEY</span>).</p>

    <div class="clients-grid">

      <!-- Claude Desktop -->
      <div class="client-card">
        <h3>Claude Desktop</h3>
        <p class="client-sub">macOS · Windows · Linux</p>
        <ol>
          <li>Open <code>~/Library/Application Support/Claude/claude_desktop_config.json</code> (macOS) or <code>%APPDATA%\Claude\claude_desktop_config.json</code> (Windows). Create it if missing.</li>
          <li>Paste the block below, replacing <code>YOUR_KEY</code>.</li>
          <li>Restart Claude Desktop. The 24 predmcp tools appear in the tool list.</li>
        </ol>
        <div class="client-code">{
  "mcpServers": {
    "predmcp": {
      "type": "http",
      "url": "https://predmcp.com/mcp",
      "headers": { "x-api-key": "YOUR_KEY" }
    }
  }
}</div>
      </div>

      <!-- Claude.ai web -->
      <div class="client-card">
        <h3>Claude.ai (web)</h3>
        <p class="client-sub">Custom connector · No key needed</p>
        <ol>
          <li>Go to <a href="https://claude.ai/settings/connectors" target="_blank" rel="noopener" style="color:var(--accent)">claude.ai → Settings → Connectors</a>.</li>
          <li>Click <em>Add custom connector</em>. Name: <code>PredMCP</code>.</li>
          <li>URL: paste <code>https://predmcp.com/mcp</code>. Leave <em>OAuth Client ID</em> and <em>OAuth Client Secret</em> blank.</li>
          <li>Click <em>Add</em>. A predmcp.com page opens — enter your email, paste the 6-digit code we send you, done.</li>
          <li>The 47 tools appear in the connector panel.</li>
        </ol>
        <div class="client-code">https://predmcp.com/mcp</div>
        <p class="client-note">Uses OAuth 2.1 + Dynamic Client Registration (RFC 7591). Claude.ai auto-discovers our endpoints and runs the flow — no key to copy, no JSON to paste. New users get a free account in the same step.</p>
      </div>

      <!-- HTTP / SDK -->
      <div class="client-card">
        <h3>Cursor / Windsurf / HTTP</h3>
        <p class="client-sub">Any MCP-compatible client</p>
        <ol>
          <li>Open the MCP config (Cursor: <code>~/.cursor/mcp.json</code> · Windsurf: settings UI).</li>
          <li>Same JSON shape as Claude Desktop — copy from the first card.</li>
          <li>If your client only accepts headers, use either <code>x-api-key: YOUR_KEY</code> or <code>Authorization: Bearer YOUR_KEY</code>.</li>
        </ol>
        <div class="client-code">curl https://predmcp.com/mcp \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'</div>
      </div>

    </div>
  </div>
</section>

<!-- ── Signup ─────────────────────────────────────────────────────────── -->
<section class="section" id="signup">
  <div class="narrow">
    <p class="kicker">Sign up</p>
    <div class="signup-card">
      <h2>Get your free API key</h2>
      <p>100 calls per day free. No credit card. Works with Claude Desktop, Cursor, Windsurf, or any MCP client in 30 seconds.</p>

      <div class="form-row">
        <input type="email" id="email" placeholder="you@example.com" autocomplete="email" required>
        <button id="btn" onclick="signup()">Get key</button>
      </div>
      <p class="hint">Email required. One key per IP. Need help? Join the <a href="https://discord.gg/nVv6Ssr3" target="_blank" rel="noopener">Raviole Labs Discord</a>.</p>
      <p style="font-size:0.82rem;margin-top:0.4rem"><a href="#" onclick="recoverKey();return false;">Already have a key? Recover with email →</a></p>
      <p class="error-msg" id="error"></p>

      <!-- OTP (used by both Pro recovery and upgrade verification) -->
      <div id="otp-section" style="display:none;margin-top:1.25rem;text-align:left">
        <input type="hidden" id="otp-email">
        <input type="hidden" id="otp-mode" value="recovery">
        <p id="otp-prompt" style="font-size:0.85rem;color:var(--ink-dim);margin-bottom:0.6rem">We just emailed you a 6-digit code. Enter it below to retrieve your key.</p>
        <div class="form-row">
          <input type="text" id="otp-code" placeholder="123456" inputmode="numeric" maxlength="6" pattern="\\d{6}" autocomplete="one-time-code"
                 style="text-align:center;letter-spacing:0.3em;font-family:var(--mono)">
          <button id="otp-btn" onclick="verifyOtp()">Verify</button>
        </div>
        <p class="error-msg" id="otp-error"></p>
      </div>

      <!-- Free user lost-key recovery → manual support during early access -->
      <div id="free-recovery" style="display:none;margin-top:1.25rem;text-align:left;background:var(--bg);border:1px solid var(--line-strong);border-radius:var(--radius-sm);padding:1.25rem">
        <input type="hidden" id="free-recovery-email">
        <p style="font-size:0.92rem;color:var(--ink);margin-bottom:0.5rem;font-weight:600">Looks like you already have a key</p>
        <p style="font-size:0.85rem;color:var(--ink-dim);margin-bottom:0">Use a different email to generate a new key, or ping us on <a href="https://discord.gg/nVv6Ssr3" target="_blank" rel="noopener">Discord</a> to recover the existing one.</p>
      </div>

      <div id="result">
        <div class="result-box">
          <p class="success-msg">Your API key is ready.</p>
          <div class="result-label" style="margin-top:0.8rem">API Key — click to copy</div>
          <div class="key-display" id="keyDisplay" onclick="copyKey()"></div>
          <p class="copy-hint" id="copyHint">Click to copy</p>
          <div class="result-label" style="margin-top:1.2rem">Add to Claude Desktop config</div>
          <div class="config-block" id="configBlock"></div>
          <div style="margin-top:1.4rem;padding-top:1.2rem;border-top:1px solid var(--line)">
            <p class="hint" style="text-align:center;font-size:0.78rem;color:var(--ink-mute)">
              You signed up during early access &mdash; you're in. Need a higher rate limit? Ping us on
              <a href="https://discord.gg/nVv6Ssr3" target="_blank" rel="noopener">Discord</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ── Pricing ────────────────────────────────────────────────────────── -->
<section class="section">
  <div class="container">
    <p class="kicker">Pricing</p>
    <h2>Free during early access.</h2>
    <p class="section-sub">
      All 47 tools open. No credit card. Paid plans land once we see real usage
      &mdash; the first 50 signups stay grandfathered for 90 days when they do.
    </p>

    <div class="price-grid" style="grid-template-columns:1fr;max-width:520px;margin:0 auto">
      <article class="price-card price-card--accent">
        <header>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:0.6rem;margin-bottom:0.6rem">
            <p class="price-tier" style="margin:0">EARLY ACCESS</p>
            <span class="price-tag">FIRST 50 GRANDFATHERED</span>
          </div>
          <div class="price-amount">$0<span class="per">/right now</span></div>
        </header>
        <ul class="price-features">
          <li>All 47 tools, no gating</li>
          <li>100 calls per day per key</li>
          <li>Email signup, no credit card</li>
          <li>One key per IP</li>
          <li>First 50 signups: 90-day grandfathered access when paid plans launch</li>
          <li>Community Discord support</li>
        </ul>
        <a href="#signup" class="button-full" style="text-align:center;display:block">Get a free key</a>
      </article>
    </div>
  </div>
</section>

<footer class="site-footer">
  Built by <a href="https://raviolelabs.com" target="_blank" rel="noopener">Raviole Labs</a> &nbsp;·&nbsp;
  <a href="https://github.com/RavioleLabs/predmcp" target="_blank" rel="noopener">open source core</a> &nbsp;·&nbsp;
  Polymarket · Hyperliquid (perps + HIP-4)
</footer>

<script>
function showKey(key) {
  document.getElementById('keyDisplay').textContent = key;
  document.getElementById('configBlock').textContent = JSON.stringify({
    mcpServers: {
      predmcp: { type: 'http', url: 'https://predmcp.com/mcp', headers: { 'x-api-key': key } }
    }
  }, null, 2);
  const result = document.getElementById('result');
  result.style.display = 'block';
  setTimeout(() => result.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
}

function resetSignupUI() {
  document.getElementById('otp-section').style.display = 'none';
  document.getElementById('free-recovery').style.display = 'none';
}

async function sendRecoveryOtp(email, btn) {
  const err = document.getElementById('error');
  try {
    const otpRes = await fetch('/auth/request-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const otpData = await otpRes.json();
    if (!otpRes.ok) {
      err.textContent = '⚠ ' + (otpData.error || 'Could not send code.');
      if (btn) { btn.disabled = false; btn.textContent = 'Get key'; }
      return;
    }
    if (otpData.tier === 'free' || otpData.tier === 'pro') {
      document.getElementById('otp-email').value = email;
      document.getElementById('otp-mode').value = 'recovery';
      document.getElementById('otp-prompt').textContent =
        'We sent a 6-digit code to ' + email + '. Enter it to retrieve your key.';
      document.getElementById('otp-code').value = '';
      const otpBtn = document.getElementById('otp-btn');
      otpBtn.textContent = 'Verify';
      otpBtn.disabled = false;
      document.getElementById('otp-section').style.display = 'block';
      document.getElementById('free-recovery').style.display = 'none';
      document.getElementById('otp-error').textContent = '';
      _verifying = false;
      err.textContent = '';
      if (btn) {
        btn.textContent = 'Code sent — check your inbox';
        btn.disabled = true;
      }
      document.getElementById('otp-section').scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => document.getElementById('otp-code').focus(), 400);
      return;
    }
    err.textContent = 'No account found for this email.';
    if (btn) { btn.disabled = false; btn.textContent = 'Get key'; }
  } catch {
    err.textContent = 'Network error.';
    if (btn) { btn.disabled = false; btn.textContent = 'Get key'; }
  }
}

async function recoverKey() {
  const email = document.getElementById('email').value.trim();
  const err = document.getElementById('error');
  err.textContent = '';
  resetSignupUI();
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
    err.textContent = 'Enter your email above first, then click Recover.';
    return;
  }
  await sendRecoveryOtp(email, null);
}

async function signup() {
  const btn = document.getElementById('btn');
  const email = document.getElementById('email').value.trim();
  const err = document.getElementById('error');
  err.innerHTML = '';
  resetSignupUI();
  if (!email || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
    err.textContent = 'Please enter a valid email address.';
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Working…';

  try {
    const res = await fetch('/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok && data.key) {
      showKey(data.key);
      btn.textContent = 'Done';
      return;
    }

    btn.disabled = false;
    btn.textContent = 'Get key';

    if (data.code === 'ip_collision') {
      err.innerHTML = '⚠ Your network already has a key registered. Use the <strong>original email</strong> you signed up with — or try from a different network.';
      return;
    }

    if (data.code === 'email_collision') {
      err.innerHTML = '✓ Email already registered — sending you a recovery code.';
      // Auto-trigger recovery: user gave us their email, the obvious next step
      // is to get them their existing key, not make them click another link.
      await sendRecoveryOtp(email, null);
      return;
    }

    err.textContent = '⚠ ' + (data.error || 'Could not create account. Try again.');
  } catch (e) {
    console.error('[signup]', e);
    err.textContent = '⚠ Network error — please retry in a moment.';
    btn.disabled = false;
    btn.textContent = 'Get key';
  }
}

async function startTrialFromRecovery() {
  const email = document.getElementById('free-recovery-email').value;
  await startUpgradeWithOtp(email, null, '');
}

async function startUpgradeWithOtp(email, btn, restoreLabel) {
  try {
    const res = await fetch('/api/upgrade-start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok || !data.otp_required) {
      const msg = data.error || 'Could not start upgrade.';
      if (btn) {
        btn.textContent = msg;
        setTimeout(() => { btn.disabled = false; btn.textContent = restoreLabel; }, 3000);
      } else {
        alert(msg);
      }
      return;
    }
    document.getElementById('otp-email').value = email;
    document.getElementById('otp-section').style.display = 'block';
    document.getElementById('free-recovery').style.display = 'none';
    document.getElementById('otp-mode').value = 'upgrade';
    document.getElementById('otp-prompt').textContent =
      'We sent a 6-digit code to ' + email + '. Enter it to continue to checkout.';
    document.getElementById('otp-code').value = '';
    const otpBtn = document.getElementById('otp-btn');
    otpBtn.textContent = 'Verify & continue to checkout';
    otpBtn.disabled = false;
    document.getElementById('otp-error').textContent = '';
    _verifying = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = restoreLabel;
    }
    const otpInput = document.getElementById('otp-code');
    document.getElementById('otp-section').scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => otpInput.focus(), 400);
  } catch {
    if (btn) {
      btn.disabled = false;
      btn.textContent = restoreLabel;
    } else {
      alert('Network error.');
    }
  }
}

let _verifying = false;
async function verifyOtp() {
  if (_verifying) { console.log('[verifyOtp] already in flight, ignoring duplicate'); return; }
  _verifying = true;
  const email = document.getElementById('otp-email').value;
  const code = document.getElementById('otp-code').value.trim();
  const mode = document.getElementById('otp-mode').value;
  const err = document.getElementById('otp-error');
  console.log('[verifyOtp]', { email, code, mode });
  err.textContent = '';
  if (!/^\\d{6}$/.test(code)) {
    err.textContent = 'Enter the 6-digit code.';
    _verifying = false;
    return;
  }
  const btn = document.getElementById('otp-btn');
  btn.disabled = true;
  btn.textContent = 'Verifying…';
  const endpoint = mode === 'upgrade' ? '/api/upgrade-verify' : '/auth/verify-otp';
  const body = mode === 'upgrade' ? { email, otp: code } : { email, code };
  console.log('[verifyOtp] calling', endpoint, body);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    console.log('[verifyOtp] response', res.status, data);
    if (!res.ok) {
      err.textContent = data.error || 'Verification failed.';
      btn.disabled = false;
      btn.textContent = mode === 'upgrade' ? 'Verify & continue to checkout' : 'Verify';
      return;
    }
    if (mode === 'upgrade' && data.checkout_url) {
      window.location.href = data.checkout_url;
      return;
    }
    document.getElementById('otp-section').style.display = 'none';
    console.log('[verifyOtp] calling showKey with', data.key);
    showKey(data.key);
    btn.disabled = false;
    btn.textContent = 'Verify';
  } catch (e) {
    console.error('[verifyOtp] error', e);
    err.textContent = 'Network error.';
    btn.disabled = false;
    btn.textContent = mode === 'upgrade' ? 'Verify & continue to checkout' : 'Verify';
  } finally {
    _verifying = false;
  }
}

function copyKey() {
  const key = document.getElementById('keyDisplay').textContent;
  navigator.clipboard.writeText(key).then(() => {
    document.getElementById('copyHint').textContent = 'Copied!';
    setTimeout(() => document.getElementById('copyHint').textContent = 'Click to copy', 2000);
  });
}

async function upgrade() {
  const apiKey = document.getElementById('keyDisplay').textContent.trim();
  const btn = document.getElementById('upgradeBtn');
  if (!apiKey) {
    alert('Generate a free API key first, then click Upgrade.');
    return;
  }
  const email = document.getElementById('email').value.trim();
  if (!email) { alert('Missing email.'); return; }
  btn.disabled = true;
  btn.textContent = 'Sending verification code…';
  await startUpgradeWithOtp(email, btn, 'Need more than 100 calls/day? Upgrade to Pro');
}

function startTrial() {
  const existingKey = document.getElementById('keyDisplay').textContent.trim();
  if (existingKey) {
    goToCheckout(existingKey, null, '');
    return;
  }
  const emailInput = document.getElementById('email');
  emailInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => emailInput.focus(), 300);
  emailInput.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--accent) 40%, transparent)';
  setTimeout(() => { emailInput.style.boxShadow = ''; }, 1500);
}

async function goToCheckout(apiKey, btn, restoreLabel) {
  try {
    const res = await fetch('/api/upgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey }),
    });
    const data = await res.json();
    if (!res.ok || !data.checkout_url) {
      if (btn) {
        btn.textContent = data.error || 'Upgrade unavailable';
        setTimeout(() => { btn.disabled = false; btn.textContent = restoreLabel; }, 3000);
      } else {
        document.getElementById('trial-error').textContent = data.error || 'Could not start checkout.';
      }
      return;
    }
    window.location.href = data.checkout_url;
  } catch {
    if (btn) {
      btn.disabled = false;
      btn.textContent = restoreLabel;
    } else {
      document.getElementById('trial-error').textContent = 'Network error.';
    }
  }
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
