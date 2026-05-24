// src/core/oauth/authorize.ts
//
// The user-facing OAuth login page. Renders a self-contained HTML doc that
// progressively reveals the email form, then the OTP form, then redirects
// to the client's redirect_uri with the auth code.
//
// Visual design matches src/server/landing.ts — same palette, fonts, radii.

export function renderAuthorizePage(opts: { state: string; clientName: string | null }): string {
  const clientLabel = opts.clientName ? escapeHtml(opts.clientName) : 'an MCP client';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sign in to PredMCP</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<style>
  :root {
    --bg: #000;
    --bg-elev: #0c0c10;
    --bg-elev-2: #131319;
    --line: #18181b;
    --line-strong: #27272a;
    --ink: #fafafa;
    --ink-dim: #a1a1aa;
    --ink-mute: #71717a;
    --ink-faint: #52525b;
    --accent: #34d399;
    --accent-deep: #059669;
    --accent-glow: color-mix(in srgb, var(--accent) 40%, transparent);
    --red: #f87171;
    --sans: 'Inter', system-ui, -apple-system, sans-serif;
    --mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
    --radius: 12px;
    --radius-sm: 8px;
  }
  *, *::before, *::after { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    background: var(--bg); color: var(--ink);
    font-family: var(--sans);
    font-size: 16px;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
    min-height: 100vh;
  }
  body {
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 2rem 1.5rem;
  }

  /* Brand header */
  .brand {
    display: flex; align-items: center; gap: 0.55rem;
    font-weight: 600; font-size: 0.95rem;
    color: var(--ink);
    margin-bottom: 2rem;
    text-decoration: none;
  }
  .brand .dot {
    width: 9px; height: 9px; border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 14px var(--accent-glow);
  }

  /* Card — matches signup-card on the landing */
  .card {
    width: 100%; max-width: 440px;
    background:
      radial-gradient(ellipse at top right, color-mix(in srgb, var(--accent) 9%, transparent), transparent 65%),
      var(--bg-elev);
    border: 1px solid color-mix(in srgb, var(--accent) 22%, var(--line-strong));
    border-radius: var(--radius);
    padding: 2.4rem 2rem;
  }

  h1 {
    font-size: 1.45rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    margin: 0 0 0.55rem;
  }
  .sub {
    color: var(--ink-dim);
    font-size: 0.94rem;
    margin: 0 0 1.7rem;
  }
  .sub b { color: var(--ink); font-weight: 600; }

  label {
    display: block;
    color: var(--ink-mute);
    font-family: var(--mono);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    margin-bottom: 0.45rem;
  }

  input {
    width: 100%;
    background: var(--bg);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    padding: 0.75rem 1rem;
    color: var(--ink);
    font-size: 1rem;
    font-family: var(--sans);
    transition: border-color .15s ease, box-shadow .15s ease;
  }
  input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent);
  }
  .otp-input {
    text-align: center;
    letter-spacing: 0.32em;
    font-family: var(--mono);
    font-size: 1.15rem;
  }

  button {
    width: 100%;
    margin-top: 1rem;
    background: var(--accent);
    color: #000;
    border: none;
    border-radius: var(--radius-sm);
    padding: 0.78rem 1rem;
    font-size: 0.95rem;
    font-weight: 600;
    font-family: var(--sans);
    cursor: pointer;
    transition: filter .15s ease, opacity .15s ease;
  }
  button:hover:not(:disabled) { filter: brightness(1.08); }
  button:disabled { opacity: 0.55; cursor: not-allowed; }

  .back-link {
    background: transparent;
    color: var(--ink-mute);
    border: none;
    padding: 0;
    margin-top: 0.9rem;
    font-size: 0.83rem;
    font-family: var(--sans);
    text-decoration: underline;
    cursor: pointer;
    width: auto;
    font-weight: 400;
  }
  .back-link:hover { color: var(--accent); }

  .error {
    color: var(--red);
    font-size: 0.85rem;
    margin-top: 0.7rem;
    min-height: 1.2em;
  }
  .hint {
    color: var(--ink-mute);
    font-size: 0.8rem;
    margin-top: 1.1rem;
    line-height: 1.55;
  }

  .step { display: none; }
  .step.active { display: block; }

  .footer {
    margin-top: 1.5rem;
    color: var(--ink-faint);
    font-size: 0.76rem;
    text-align: center;
  }
  .footer a {
    color: var(--ink-mute);
    text-decoration: none;
    border-bottom: 1px solid var(--line-strong);
    padding-bottom: 1px;
  }
  .footer a:hover { color: var(--accent); border-color: var(--accent); }

  @media (max-width: 480px) {
    body { padding: 1.2rem; }
    .card { padding: 1.8rem 1.4rem; }
    h1 { font-size: 1.25rem; }
  }
</style>
</head>
<body>
  <a class="brand" href="/" target="_blank" rel="noopener">
    <span class="dot" aria-hidden="true"></span> PredMCP
  </a>

  <div class="card">
    <div id="step-email" class="step active">
      <h1>Authorize ${clientLabel}</h1>
      <p class="sub"><b>${clientLabel}</b> is requesting access to your PredMCP account. Sign in to continue.</p>
      <form id="email-form" autocomplete="on">
        <label for="email">Email</label>
        <input type="email" id="email" name="email" required autocomplete="email" placeholder="you@example.com" autofocus>
        <button id="email-btn" type="submit">Send code</button>
      </form>
      <p class="error" id="email-error"></p>
      <p class="hint">We'll email you a 6-digit code. New here? An account is created automatically — free tier, 100 calls / day.</p>
    </div>

    <div id="step-otp" class="step">
      <h1>Enter the code</h1>
      <p class="sub">We sent a 6-digit code to <b id="otp-email-display">your email</b>. It expires in 10 minutes.</p>
      <form id="otp-form" autocomplete="off">
        <label for="otp">Code</label>
        <input type="text" id="otp" class="otp-input" inputmode="numeric" pattern="\\d{6}" maxlength="6" required autocomplete="one-time-code" autofocus>
        <button id="otp-btn" type="submit">Sign in &amp; authorize</button>
      </form>
      <p class="error" id="otp-error"></p>
      <button class="back-link" id="back-btn" type="button">← Use a different email</button>
    </div>

    <div id="step-done" class="step">
      <h1>Redirecting…</h1>
      <p class="sub">Sending you back to ${clientLabel}.</p>
    </div>
  </div>

  <p class="footer">Powered by <a href="/" target="_blank" rel="noopener">predmcp.com</a> · One key per IP for free tier</p>

<script>
(function(){
  const STATE = ${JSON.stringify(opts.state)};
  const $ = (id) => document.getElementById(id);
  const show = (stepId) => {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    $(stepId).classList.add('active');
  };
  const showError = (id, msg) => { $(id).textContent = msg ? '⚠ ' + msg : ''; };

  $('email-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('email').value.trim();
    showError('email-error', '');
    const btn = $('email-btn');
    btn.disabled = true; btn.textContent = 'Sending…';
    try {
      const res = await fetch('/oauth/authorize/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: STATE, email })
      });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) {
        showError('email-error', data.error || 'Could not send code.');
        btn.disabled = false; btn.textContent = 'Send code';
        return;
      }
      $('otp-email-display').textContent = email;
      $('otp').dataset.email = email;
      show('step-otp');
      setTimeout(()=>$('otp').focus(), 100);
    } catch (err) {
      showError('email-error', 'Network error. Try again.');
      btn.disabled = false; btn.textContent = 'Send code';
    }
  });

  $('otp-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('otp').dataset.email;
    const code = $('otp').value.trim();
    showError('otp-error', '');
    const btn = $('otp-btn');
    btn.disabled = true; btn.textContent = 'Verifying…';
    try {
      const res = await fetch('/oauth/authorize/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: STATE, email, code })
      });
      const data = await res.json().catch(()=>({}));
      if (!res.ok || !data.redirect_url) {
        showError('otp-error', data.error || 'Invalid code.');
        btn.disabled = false; btn.textContent = 'Sign in & authorize';
        return;
      }
      show('step-done');
      window.location.href = data.redirect_url;
    } catch (err) {
      showError('otp-error', 'Network error. Try again.');
      btn.disabled = false; btn.textContent = 'Sign in & authorize';
    }
  });

  $('back-btn').addEventListener('click', () => {
    $('otp').value = '';
    showError('otp-error', '');
    $('email-btn').disabled = false;
    $('email-btn').textContent = 'Send code';
    show('step-email');
  });
})();
</script>
</body>
</html>`;
}

export function renderAuthorizeError(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>PredMCP — Authorization error</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap">
<style>
  body{background:#000;color:#fafafa;font-family:'Inter',system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:2rem;line-height:1.55}
  .box{background:#0c0c10;border:1px solid color-mix(in srgb, #f87171 30%, #27272a);border-radius:12px;padding:2.2rem 1.8rem;max-width:440px;width:100%}
  h1{font-size:1.25rem;color:#f87171;margin:0 0 0.65rem;font-weight:600}
  p{color:#a1a1aa;font-size:0.92rem;margin:0.4rem 0}
  a{color:#34d399;text-decoration:none;border-bottom:1px solid #27272a;padding-bottom:1px}
  a:hover{border-color:#34d399}
</style>
</head>
<body>
  <div class="box">
    <h1>Authorization error</h1>
    <p>${escapeHtml(message)}</p>
    <p style="margin-top:1.4rem"><a href="/">← Back to predmcp.com</a></p>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
