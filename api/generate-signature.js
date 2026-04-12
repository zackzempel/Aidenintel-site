/**
 * generate-signature.js — Generates the 5-phase Signature cinematic video
 * POST /api/generate-signature
 * This is Aiden's flagship format — not available in the standard workshop presets
 */

const SHOTSTACK_KEY = process.env.SHOTSTACK_API_KEY;
const SHOTSTACK_ENV = process.env.SHOTSTACK_ENV || 'sandbox';
const BASE_URL = SHOTSTACK_ENV === 'production'
  ? 'https://api.shotstack.io/edit/v1'
  : 'https://api.shotstack.io/edit/stage';

const SUPABASE_URL = 'https://oftrlapeiqvokgnsscxa.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET = 'workshop-videos';

function esc(s) {
  return s ? s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : '';
}

function topBanner(text, color, size, style='') {
  return `<div style="width:720px;height:200px;font-family:'Arial Black',Arial,sans-serif;text-align:center;padding-top:20px;"><div style="font-size:${size}px;font-weight:900;color:${color};text-shadow:0 0 30px ${color},3px 3px 12px rgba(0,0,0,0.9);letter-spacing:6px;${style}">${esc(text)}</div></div>`;
}

function bottomBar(lines, bg='linear-gradient(to top,rgba(0,0,0,0.92) 0%,rgba(0,0,0,0.0) 100%)') {
  const content = lines.map(([text, color, size, bold]) =>
    `<div style="font-size:${size}px;font-weight:${bold?'700':'400'};color:${color};text-shadow:2px 2px 8px rgba(0,0,0,1);margin-bottom:5px;">${esc(text)}</div>`
  ).join('');
  return `<div style="width:720px;height:300px;font-family:Arial,sans-serif;background:${bg};display:flex;flex-direction:column;justify-content:flex-end;padding-bottom:32px;text-align:center;">${content}</div>`;
}

function outroCard(address, contact) {
  const namePart = contact ? contact.split('|')[0].trim() : 'Jon Severson';
  const phonePart = contact ? (contact.split('|')[1] || '763-639-3763').trim() : '763-639-3763';
  return `<div style="width:720px;height:1280px;background:linear-gradient(160deg,#080810 0%,#0d0d1a 50%,#080810 100%);font-family:Arial,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:0;">
    <div style="font-size:18px;color:#818cf8;letter-spacing:12px;margin-bottom:24px;">SEVERSON REAL ESTATE</div>
    <div style="width:80px;height:1px;background:linear-gradient(90deg,transparent,#d4af37,transparent);margin-bottom:32px;"></div>
    <div style="font-size:64px;font-weight:900;color:#ffffff;margin-bottom:4px;">${esc(namePart.split(' ')[0])}</div>
    <div style="font-size:64px;font-weight:900;color:#d4af37;margin-bottom:24px;">${esc(namePart.split(' ').slice(1).join(' ') || 'Severson')}</div>
    <div style="font-size:20px;color:#666680;letter-spacing:4px;margin-bottom:48px;">REAL BROKER LLC</div>
    <div style="width:80px;height:1px;background:linear-gradient(90deg,transparent,#d4af37,transparent);margin-bottom:40px;"></div>
    <div style="font-size:42px;font-weight:700;color:#10b981;margin-bottom:8px;">${esc(phonePart)}</div>
    <div style="font-size:20px;color:#555570;margin-bottom:48px;">jon@seversonre.com</div>
    <div style="border:1px solid #d4af37;padding:16px 44px;font-size:18px;color:#d4af37;letter-spacing:5px;">SCHEDULE A SHOWING</div>
  </div>`;
}

function buildSignatureTimeline({ videoUrl, address, city, price, contact }) {
  const tracks = [];
  const videoLength = 44;

  // Phase 1 (0-3s): EXCLUSIVE opener
  tracks.push({ clips: [{ asset: { type: 'html', html: topBanner('✦ EXCLUSIVE ✦', '#d4af37', 48, 'text-shadow:0 0 40px #d4af37,0 0 80px #d4af37,3px 3px 12px rgba(0,0,0,0.9);'), width: 720, height: 200 }, start: 0.5, length: 3, position: 'top', transition: { in: 'slideDown', out: 'slideUp' } }] });

  // Phase 2 (3-12s): JUST LISTED + full address
  tracks.push({ clips: [{ asset: { type: 'html', html: topBanner('JUST LISTED', '#ffffff', 54), width: 720, height: 200 }, start: 3, length: 9, position: 'top', transition: { in: 'fade', out: 'fade' } }] });
  tracks.push({ clips: [{ asset: { type: 'html', html: bottomBar([[address, '#ffffff', 36, true],[city || 'Minnesota', '#dddddd', 26, false],[contact || 'Jon Severson | 763-639-3763', '#aaaaaa', 20, false]]), width: 720, height: 300 }, start: 3, length: 9, position: 'bottom', transition: { in: 'fade', out: 'fade' } }] });

  // Phase 3 (12-20s): Feature callout
  tracks.push({ clips: [{ asset: { type: 'html', html: topBanner('✦ NEW CONSTRUCTION ✦', '#d4af37', 40, 'letter-spacing:5px;font-style:italic;'), width: 720, height: 200 }, start: 12, length: 8, position: 'top', transition: { in: 'slideDown', out: 'fade' } }] });
  tracks.push({ clips: [{ asset: { type: 'html', html: bottomBar([['Premium Finishes · Open Concept','#f5e6c8',28,true],['Anoka County · Twin Cities Metro','#c8b888',24,false]]), width: 720, height: 300 }, start: 12, length: 8, position: 'bottom', transition: { in: 'fade', out: 'fade' } }] });

  // Phase 4 (20-30s): Price reveal (if provided)
  if (price) {
    tracks.push({ clips: [{ asset: { type: 'html', html: topBanner('ASKING PRICE', '#ffffff', 44, 'letter-spacing:8px;font-weight:400;'), width: 720, height: 200 }, start: 20, length: 10, position: 'top', transition: { in: 'fade', out: 'fade' } }] });
    tracks.push({ clips: [{ asset: { type: 'html', html: bottomBar([[address,'#ffffff',32,true],[price,'#d4af37',46,true],['Schedule your private showing today','#aaaaaa',20,false]]), width: 720, height: 300 }, start: 20, length: 10, position: 'bottom', transition: { in: 'fade', out: 'fade' } }] });
  }

  // Phase 5 (30-38s): CTA
  const ctaStart = price ? 30 : 20;
  tracks.push({ clips: [{ asset: { type: 'html', html: topBanner('YOUR STORY', '#ffffff', 52, 'letter-spacing:10px;'), width: 720, height: 200 }, start: ctaStart, length: 4, position: 'top', transition: { in: 'fade', out: 'fade' } }] });
  tracks.push({ clips: [{ asset: { type: 'html', html: topBanner('STARTS HERE', '#d4af37', 52, 'letter-spacing:10px;'), width: 720, height: 200 }, start: ctaStart + 4, length: 4, position: 'top', transition: { in: 'fade', out: 'fade' } }] });
  tracks.push({ clips: [{ asset: { type: 'html', html: bottomBar([[(contact?.split('|')[1] || '763-639-3763').trim(),'#ffffff',42,true],['Call or text Jon today','#dddddd',24,false]]), width: 720, height: 300 }, start: ctaStart, length: 8, position: 'bottom', transition: { in: 'fade', out: 'fade' } }] });

  // Outro (38-44s)
  const outroStart = ctaStart + 8;
  tracks.push({ clips: [{ asset: { type: 'html', html: outroCard(address, contact), width: 720, height: 1280 }, start: outroStart, length: videoLength - outroStart, position: 'top', transition: { in: 'fade' }, opacity: 0.97 }] });

  // Source video — bottom layer
  tracks.push({ clips: [{ asset: { type: 'video', src: videoUrl }, start: 0, length: videoLength }] });

  return tracks;
}

async function pollRender(renderId) {
  const start = Date.now();
  while (Date.now() - start < 120000) {
    await new Promise(r => setTimeout(r, 4000));
    const res = await fetch(`${BASE_URL}/render/${renderId}`, { headers: { 'x-api-key': SHOTSTACK_KEY } });
    const data = await res.json();
    const status = data?.response?.status;
    if (status === 'done') return data.response.url;
    if (status === 'failed') throw new Error('Render failed');
  }
  throw new Error('Render timed out');
}

async function uploadToSupabase(videoUrl, fileName) {
  const videoRes = await fetch(videoUrl);
  const buf = await videoRes.arrayBuffer();
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${fileName}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'video/mp4', 'x-upsert': 'true' },
    body: buf,
  });
  if (!res.ok) throw new Error(`Supabase upload failed: ${await res.text()}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${fileName}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { videoUrl, address, city, price, contact } = req.body;
  if (!videoUrl || !address) return res.status(400).json({ error: 'videoUrl and address required' });

  try {
    const tracks = buildSignatureTimeline({ videoUrl, address, city, price, contact });

    const renderRes = await fetch(`${BASE_URL}/render`, {
      method: 'POST',
      headers: { 'x-api-key': SHOTSTACK_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeline: { tracks }, output: { format: 'mp4', resolution: 'hd', aspectRatio: '9:16' } }),
    });

    const renderData = await renderRes.json();
    if (!renderRes.ok || !renderData.success) throw new Error(renderData?.response?.message || 'Render queue failed');

    const shotstackUrl = await pollRender(renderData.response.id);
    const ts = Date.now();
    const slug = address.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().substring(0, 30);
    const fileName = `${slug}-signature-${ts}.mp4`;
    // Use Shotstack CDN URL directly — skip Supabase re-upload (avoids 413 on large files)
    const outputUrl = shotstackUrl;

    return res.status(200).json({ outputUrl, fileName, renderId: renderData.response.id });
  } catch (err) {
    console.error('generate-signature error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
