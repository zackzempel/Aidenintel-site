/**
 * generate-overlay.js — Shotstack-powered video overlay generator
 * POST /api/generate-overlay
 * Uses HTML asset for pixel-perfect overlay positioning
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
  classic: { banner: '#ffffff', address: '#ffffff', city: '#dddddd', price: '#10b981', contact: '#aaaaaa' },
  bold:    { banner: '#ff6b35', address: '#ffffff', city: '#ffddcc', price: '#ff6b35', contact: '#ffaa88' },
  luxury:  { banner: '#d4af37', address: '#f5e6c8', city: '#e8d5a8', price: '#d4af37', contact: '#c8b888' },
  minimal: { banner: '#eeeeee', address: '#eeeeee', city: '#cccccc', price: '#ffffff', contact: '#999999' },
  aiden:   { banner: '#818cf8', address: '#ffffff', city: '#e8e8ff', price: '#818cf8', contact: '#aaaacc' },
  custom:  { banner: '#ffffff', address: '#ffffff', city: '#dddddd', price: '#10b981', contact: '#aaaaaa' },
};

function buildHtmlOverlay({ banner, address, city, price, contact, preset }) {
  const c = PRESETS[preset] || PRESETS.classic;
  const esc = s => s ? s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : '';

  let html = `<div style="width:1080px;height:1920px;position:relative;font-family:Arial,Helvetica,sans-serif;">`;

  // Top banner
  if (banner) {
    html += `<div style="position:absolute;top:70px;left:0;right:0;text-align:center;font-size:82px;font-weight:900;color:${c.banner};text-shadow:3px 3px 10px rgba(0,0,0,0.9);letter-spacing:5px;">${esc(banner)}</div>`;
  }

  // Bottom gradient
  html += `<div style="position:absolute;bottom:0;left:0;right:0;height:440px;background:linear-gradient(to top,rgba(0,0,0,0.88) 0%,rgba(0,0,0,0.0) 100%);"></div>`;

  // Bottom text stack — build from bottom up
  let bottom = 75;

  if (contact) {
    html += `<div style="position:absolute;bottom:${bottom}px;left:0;right:0;text-align:center;font-size:33px;color:${c.contact};text-shadow:1px 1px 4px rgba(0,0,0,1);">${esc(contact)}</div>`;
    bottom += 58;
  }
  if (price) {
    html += `<div style="position:absolute;bottom:${bottom}px;left:0;right:0;text-align:center;font-size:50px;font-weight:700;color:${c.price};text-shadow:2px 2px 6px rgba(0,0,0,1);">${esc(price)}</div>`;
    bottom += 68;
  }
  if (city) {
    html += `<div style="position:absolute;bottom:${bottom}px;left:0;right:0;text-align:center;font-size:40px;color:${c.city};text-shadow:2px 2px 5px rgba(0,0,0,1);">${esc(city)}</div>`;
    bottom += 62;
  }
  if (address) {
    html += `<div style="position:absolute;bottom:${bottom}px;left:0;right:0;text-align:center;font-size:54px;font-weight:700;color:${c.address};text-shadow:3px 3px 8px rgba(0,0,0,1);">${esc(address)}</div>`;
  }

  html += `</div>`;
  return html;
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
  if (!videoRes.ok) throw new Error('Failed to fetch rendered video from Shotstack');
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

  const {
    videoUrl, address, city, banner, price, contact,
    preset = 'classic', fadeIn = true, isAidenPick = false,
  } = req.body;

  if (!videoUrl) return res.status(400).json({ error: 'videoUrl required' });
  if (!address) return res.status(400).json({ error: 'address required' });

  try {
    const overlayHtml = buildHtmlOverlay({ banner, address, city, price, contact, preset });

    const timeline = {
      tracks: [
        // Track 0 = top layer: HTML overlay with all text
        {
          clips: [{
            asset: { type: 'html', html: overlayHtml, width: 1080, height: 1920 },
            start: fadeIn ? 1 : 0,
            length: 59,
            position: 'center',
          }]
        },
        // Track 1 = bottom layer: source video
        {
          clips: [{
            asset: { type: 'video', src: videoUrl },
            start: 0,
            length: 60,
          }]
        }
      ]
    };

    // Submit render
    const renderRes = await fetch(`${BASE_URL}/render`, {
      method: 'POST',
      headers: { 'x-api-key': SHOTSTACK_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timeline,
        output: { format: 'mp4', resolution: 'hd', aspectRatio: '9:16' }
      }),
    });

    const renderData = await renderRes.json();
    if (!renderRes.ok || !renderData.success) {
      throw new Error(renderData?.response?.message || JSON.stringify(renderData));
    }

    const renderId = renderData.response.id;
    const shotstackUrl = await pollRender(renderId);

    // Upload to Supabase for permanent hosting
    const ts = Date.now();
    const slug = address.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().substring(0, 30);
    const fileName = `${slug}-${preset}-${ts}.mp4`;
    const outputUrl = await uploadToSupabase(shotstackUrl, fileName);

    return res.status(200).json({ outputUrl, fileName, renderId });

  } catch (err) {
    console.error('generate-overlay error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
