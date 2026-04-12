/**
 * generate-overlay.js — Shotstack-powered video overlay generator
 * POST /api/generate-overlay
 * Uses two HTML asset clips: top banner + bottom bar (confirmed working approach)
 */

const SHOTSTACK_KEY = process.env.SHOTSTACK_API_KEY;
const SHOTSTACK_ENV = process.env.SHOTSTACK_ENV || 'sandbox';
const BASE_URL = SHOTSTACK_ENV === 'production'
  ? 'https://api.shotstack.io/edit/v1'
  : 'https://api.shotstack.io/edit/stage';

const SUPABASE_URL = 'https://oftrlapeiqvokgnsscxa.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET = 'workshop-videos';

const PRESETS = {
  classic: { banner: '#ffffff', address: '#ffffff', city: '#dddddd', price: '#10b981', contact: '#aaaaaa', bannerStyle: 'font-weight:900;letter-spacing:5px;' },
  bold:    { banner: '#ff6b35', address: '#ffffff', city: '#ffddcc', price: '#ff6b35', contact: '#ffaa88', bannerStyle: 'font-weight:900;letter-spacing:4px;' },
  luxury:  { banner: '#d4af37', address: '#f5e6c8', city: '#e8d5a8', price: '#d4af37', contact: '#c8b888', bannerStyle: 'font-weight:700;letter-spacing:6px;font-style:italic;' },
  minimal: { banner: '#eeeeee', address: '#eeeeee', city: '#cccccc', price: '#ffffff', contact: '#999999', bannerStyle: 'font-weight:400;letter-spacing:8px;' },
  aiden:   { banner: '#818cf8', address: '#ffffff', city: '#e8e8ff', price: '#818cf8', contact: '#aaaacc', bannerStyle: 'font-weight:900;letter-spacing:4px;' },
  custom:  { banner: '#ffffff', address: '#ffffff', city: '#dddddd', price: '#10b981', contact: '#aaaaaa', bannerStyle: 'font-weight:900;letter-spacing:5px;' },
};

function escHtml(s) {
  return s ? s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : '';
}

function buildTopHtml(banner, preset) {
  const c = PRESETS[preset] || PRESETS.classic;
  return `<div style="width:720px;height:180px;font-family:Arial,Helvetica,sans-serif;text-align:center;padding-top:24px;"><div style="font-size:58px;${c.bannerStyle}color:${c.banner};text-shadow:3px 3px 10px rgba(0,0,0,0.9);">${escHtml(banner)}</div></div>`;
}

function buildBottomHtml(address, city, price, contact, preset) {
  const c = PRESETS[preset] || PRESETS.classic;
  const lines = [];

  // Build bottom bar from top-down order inside the bar
  if (address) lines.push(`<div style="font-size:38px;font-weight:700;color:${c.address};text-shadow:2px 2px 6px rgba(0,0,0,1);margin-bottom:4px;">${escHtml(address)}</div>`);
  if (city)    lines.push(`<div style="font-size:28px;color:${c.city};text-shadow:1px 1px 4px rgba(0,0,0,1);margin-bottom:4px;">${escHtml(city)}</div>`);
  if (price)   lines.push(`<div style="font-size:34px;font-weight:700;color:${c.price};text-shadow:2px 2px 6px rgba(0,0,0,1);margin-bottom:4px;">${escHtml(price)}</div>`);
  if (contact) lines.push(`<div style="font-size:22px;color:${c.contact};text-shadow:1px 1px 4px rgba(0,0,0,1);">${escHtml(contact)}</div>`);

  const contentHeight = (address ? 46 : 0) + (city ? 36 : 0) + (price ? 42 : 0) + (contact ? 30 : 0) + 60;
  const barHeight = Math.max(contentHeight, 220);

  return `<div style="width:720px;height:${barHeight}px;font-family:Arial,Helvetica,sans-serif;background:linear-gradient(to top,rgba(0,0,0,0.88) 0%,rgba(0,0,0,0.0) 100%);display:flex;flex-direction:column;justify-content:flex-end;padding-bottom:30px;text-align:center;">${lines.join('')}</div>`;
}

async function pollRender(renderId, maxWaitMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    await new Promise(r => setTimeout(r, 4000));
    const res = await fetch(`${BASE_URL}/render/${renderId}`, {
      headers: { 'x-api-key': SHOTSTACK_KEY }
    });
    const data = await res.json();
    const status = data?.response?.status;
    if (status === 'done') return data.response.url;
    if (status === 'failed') throw new Error(`Render failed: ${data?.response?.error || 'unknown'}`);
  }
  throw new Error('Render timed out after 2 minutes');
}

async function uploadToSupabase(videoUrl, fileName) {
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) throw new Error('Failed to fetch rendered video');
  const buf = await videoRes.arrayBuffer();

  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${fileName}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'video/mp4',
      'x-upsert': 'true',
    },
    body: buf,
  });

  if (!res.ok) throw new Error(`Supabase upload failed: ${await res.text()}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${fileName}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { videoUrl, address, city, banner, price, contact, preset = 'classic', fadeIn = true } = req.body;

  if (!videoUrl) return res.status(400).json({ error: 'videoUrl required' });
  if (!address)  return res.status(400).json({ error: 'address required' });

  try {
    const tracks = [];
    const transition = fadeIn ? { in: 'fade' } : undefined;

    // Top banner track
    if (banner) {
      const topHtml = buildTopHtml(banner, preset);
      tracks.push({ clips: [{ asset: { type: 'html', html: topHtml, width: 720, height: 180 }, start: 0.5, length: 59.5, position: 'top', ...(transition ? { transition } : {}) }] });
    }

    // Bottom bar track
    if (address || city || price || contact) {
      const hasContent = [address, city, price, contact].filter(Boolean);
      const barHeight = 140 + hasContent.length * 44;
      const bottomHtml = buildBottomHtml(address, city, price, contact, preset);
      tracks.push({ clips: [{ asset: { type: 'html', html: bottomHtml, width: 720, height: barHeight }, start: fadeIn ? 1 : 0, length: 59, position: 'bottom', ...(transition ? { transition } : {}) }] });
    }

    // Source video — last track = bottom layer
    tracks.push({ clips: [{ asset: { type: 'video', src: videoUrl }, start: 0, length: 60 }] });

    const renderRes = await fetch(`${BASE_URL}/render`, {
      method: 'POST',
      headers: { 'x-api-key': SHOTSTACK_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timeline: { tracks },
        output: { format: 'mp4', resolution: 'hd', aspectRatio: '9:16' }
      }),
    });

    const renderData = await renderRes.json();
    if (!renderRes.ok || !renderData.success) {
      throw new Error(renderData?.response?.message || JSON.stringify(renderData));
    }

    const shotstackUrl = await pollRender(renderData.response.id);

    const ts = Date.now();
    const slug = address.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().substring(0, 30);
    const fileName = `${slug}-${preset}-${ts}.mp4`;
    // Use Shotstack CDN URL directly — skip Supabase re-upload (avoids 413 on large files)
    const outputUrl = shotstackUrl;

    return res.status(200).json({ outputUrl, fileName, renderId: renderData.response.id });

  } catch (err) {
    console.error('generate-overlay error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
