const SUPABASE_URL = 'https://oftrlapeiqvokgnsscxa.supabase.co';
const SUPABASE_KEY = 'sb_publishable_5Yb-xvGR2Wbng3dK5gSODg_Dl5v_mtB';

export default async function handler(req, res) {
  const slug = req.query.slug;
  if (!slug) return res.status(400).send('Missing slug');

  // Fetch the intake request by slug (stored in audio_url)
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/client_requests?audio_url=eq.${encodeURIComponent(slug)}&client_id=eq.intake&select=*&limit=1`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  );
  const records = await r.json();
  const record = records[0];

  if (!record) {
    return res.status(404).send(renderPage({
      name: 'there',
      request: null,
      status: 'not_found',
      response: null
    }));
  }

  const name = record.client_name && record.client_name !== 'Anonymous Prospect'
    ? record.client_name
    : 'there';

  // Parse message — split on ---RESPONSE--- separator
  const parts = record.message.split('---RESPONSE---');
  const originalRequest = parts[0].trim();
  const responseText = parts.length > 1 ? parts[1].trim() : null;

  return res.status(200).setHeader('Content-Type', 'text/html').send(renderPage({
    name,
    request: originalRequest,
    status: record.status,
    responseText: record.status === 'done' ? responseText : null,
    createdAt: record.created_at
  }));
}

function renderPage({ name, request, status, responseText, createdAt }) {
  const isResponded = status === 'done';
  const isNotFound = status === 'not_found';
  const displayName = name.charAt(0).toUpperCase() + name.slice(1);

  const statusBadge = isNotFound
    ? `<div class="status-badge pending">❓ Request not found</div>`
    : isResponded
    ? `<div class="status-badge done">✅ Response Ready</div>`
    : `<div class="status-badge pending"><span class="dot"></span> Aiden is reviewing your request...</div>`;

  const responseSection = isResponded && responseText ? `
    <div class="response-card">
      <div class="response-label">💬 Aiden's Response</div>
      <div class="response-body">${responseText.replace(/\n/g, '<br>')}</div>
      <div class="response-cta">
        <a href="https://aidenintel.com" class="btn-primary">Learn more about Aiden Intel →</a>
      </div>
    </div>` : isResponded ? `
    <div class="response-card">
      <div class="response-label">💬 Aiden's Response</div>
      <div class="response-body">Your response is ready — Zack will be in touch shortly with next steps.</div>
    </div>` : `
    <div class="waiting-card">
      <div class="waiting-icon">⏱️</div>
      <div class="waiting-text">Check back in a few minutes — Aiden reviews every request personally.</div>
      <button onclick="window.location.reload()" class="btn-reload">Refresh →</button>
    </div>`;

  const requestSection = request && !isNotFound ? `
    <div class="request-card">
      <div class="request-label">📋 Your Request</div>
      <div class="request-body">${request.replace(/\[response\].*/si, '').replace(/\n/g, '<br>').trim()}</div>
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Your Aiden Intel Request</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #05070f;
  --surface: #0a0d1a;
  --surface2: #0f1222;
  --border: #1a2035;
  --accent: #6366f1;
  --accent2: #818cf8;
  --green: #10b981;
  --yellow: #f59e0b;
  --text: #f1f5f9;
  --text2: #94a3b8;
  --text3: #475569;
}
body {
  background: var(--bg);
  color: var(--text);
  font-family: 'Inter', sans-serif;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  -webkit-font-smoothing: antialiased;
}
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image:
    linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px);
  background-size: 60px 60px;
  pointer-events: none;
  z-index: 0;
}
.container {
  max-width: 580px;
  width: 100%;
  position: relative;
  z-index: 1;
}
.logo {
  font-size: 1rem;
  font-weight: 800;
  color: var(--text);
  text-decoration: none;
  display: block;
  margin-bottom: 32px;
  text-align: center;
}
.logo em { color: var(--accent); font-style: normal; }
.greeting {
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.5px;
  margin-bottom: 8px;
  text-align: center;
}
.subtext {
  font-size: 0.9rem;
  color: var(--text2);
  text-align: center;
  margin-bottom: 28px;
  line-height: 1.6;
}
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 999px;
  font-size: 0.825rem;
  font-weight: 700;
  margin: 0 auto 28px;
  display: flex;
  justify-content: center;
  width: fit-content;
}
.status-badge.pending {
  background: rgba(245,158,11,0.1);
  border: 1px solid rgba(245,158,11,0.25);
  color: var(--yellow);
}
.status-badge.done {
  background: rgba(16,185,129,0.1);
  border: 1px solid rgba(16,185,129,0.25);
  color: var(--green);
}
.dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--yellow);
  animation: pulse 1.5s infinite;
  flex-shrink: 0;
}
@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(1.3)} }
.request-card, .response-card, .waiting-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 24px 28px;
  margin-bottom: 16px;
}
.request-label, .response-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text3);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 12px;
}
.request-body, .response-body {
  font-size: 0.9rem;
  color: var(--text2);
  line-height: 1.7;
}
.response-card { border-color: rgba(16,185,129,0.2); }
.response-body { color: var(--text); }
.response-cta { margin-top: 20px; }
.btn-primary {
  display: inline-flex;
  align-items: center;
  background: var(--accent);
  color: white;
  text-decoration: none;
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 700;
  font-family: 'Inter', sans-serif;
  transition: background 0.2s;
}
.btn-primary:hover { background: #4f46e5; }
.waiting-card {
  text-align: center;
  border-color: rgba(99,102,241,0.2);
}
.waiting-icon { font-size: 2rem; margin-bottom: 12px; }
.waiting-text { font-size: 0.875rem; color: var(--text2); line-height: 1.6; margin-bottom: 20px; }
.btn-reload {
  background: rgba(99,102,241,0.1);
  border: 1px solid rgba(99,102,241,0.25);
  color: var(--accent2);
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 0.825rem;
  font-weight: 700;
  cursor: pointer;
  font-family: 'Inter', sans-serif;
  transition: all 0.15s;
}
.btn-reload:hover { background: rgba(99,102,241,0.2); }
.footer-note {
  text-align: center;
  font-size: 0.75rem;
  color: var(--text3);
  margin-top: 28px;
}
.footer-note a { color: var(--accent2); text-decoration: none; }
</style>
</head>
<body>
<div class="container">
  <a href="https://aidenintel.com" class="logo">Aiden<em>Intel</em></a>
  <h1 class="greeting">Hey ${displayName}! 👋</h1>
  <p class="subtext">${isNotFound ? "We couldn't find that request. The link may be incorrect." : "Your request is in good hands. Here's where things stand:"}</p>
  ${statusBadge}
  ${requestSection}
  ${responseSection}
  <div class="footer-note">
    Powered by <a href="https://aidenintel.com">Aiden Intel</a> · Intelligent Agentic Solutions
  </div>
</div>
${!isResponded && !isNotFound ? `<script>
  // Auto-refresh every 60 seconds while waiting
  setTimeout(() => window.location.reload(), 60000);
</script>` : ''}
</body>
</html>`;
}
