/**
 * generate-overlay.js — Shotstack-powered video overlay generator
 * POST /api/generate-overlay
 */

const SHOTSTACK_KEY = process.env.SHOTSTACK_API_KEY;
const SHOTSTACK_ENV = process.env.SHOTSTACK_ENV || 'sandbox';
const BASE_URL = SHOTSTACK_ENV === 'production'
  ? 'https://api.shotstack.io/v1'
  : 'https://api.shotstack.io/stage';

const SUPABASE_URL = 'https://oftrlapeiqvokgnsscxa.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET = 'workshop-videos';

// Style presets
const PRESETS = {
  classic: {
    bannerStyle: 'blockbuster',
    bannerColor: '#ffffff',
    addressColor: '#ffffff',
    cityColor: '#dddddd',
    contactColor: '#aaaaaa',
    priceColor: '#10b981',
    bgOverlay: true,
  },
  bold: {
    bannerStyle: 'blockbuster',
    bannerColor: '#ff6b35',
    addressColor: '#ffffff',
    cityColor: '#ffddcc',
    contactColor: '#ffaa88',
    priceColor: '#ff6b35',
    bgOverlay: true,
  },
  luxury: {
    bannerStyle: 'future',
    bannerColor: '#d4af37',
    addressColor: '#f5e6c8',
    cityColor: '#e8d5a8',
    contactColor: '#c8b888',
    priceColor: '#d4af37',
    bgOverlay: true,
  },
  minimal: {
    bannerStyle: 'minimal',
    bannerColor: '#eeeeee',
    addressColor: '#eeeeee',
    cityColor: '#cccccc',
    contactColor: '#999999',
    priceColor: '#ffffff',
    bgOverlay: false,
  },
  aiden: {
    bannerStyle: 'future',
    bannerColor: '#818cf8',
    addressColor: '#ffffff',
    cityColor: '#e8e8ff',
    contactColor: '#aaaacc',
    priceColor: '#818cf8',
    bgOverlay: true,
  },
  custom: {
    bannerStyle: 'blockbuster',
    bannerColor: '#ffffff',
    addressColor: '#ffffff',
    cityColor: '#dddddd',
    contactColor: '#aaaaaa',
    priceColor: '#10b981',
    bgOverlay: true,
  },
};

function buildTimeline({ videoUrl, address, city, banner, price, contact, preset, fadeIn }) {
  const p = PRESETS[preset] || PRESETS.classic;
  const transition = fadeIn ? 'fade' : 'none';
  const tracks = [];

  // Track 0: source video
  tracks.push({
    clips: [{
      asset: { type: 'video', src: videoUrl },
      start: 0,
      length: 44, // full video length
    }]
  });

  // Track 1: dark bottom bar overlay (if needed)
  if (p.bgOverlay && (address || contact)) {
    tracks.push({
      clips: [{
        asset: {
          type: 'luma',
          src: 'https://templates.shotstack.io/basic/asset/video/luma/fade-in-out.mp4',
        },
        start: 0,
        length: 44,
        opacity: 0.6,
        position: 'bottom',
        offset: { x: 0, y: 0 },
      }]
    });
  }

  // Track 2: top banner "JUST LISTED"
  if (banner) {
    tracks.push({
      clips: [{
        asset: {
          type: 'title',
          text: banner,
          style: p.bannerStyle,
          color: p.bannerColor,
          size: 'x-large',
          background: 'transparent',
        },
        start: 0.5,
        length: 43.5,
        position: 'top',
        offset: { x: 0, y: -0.05 },
        transition: { in: transition },
      }]
    });
  }

  // Track 3: address
  if (address) {
    tracks.push({
      clips: [{
        asset: {
          type: 'title',
          text: address,
          style: 'minimal',
          color: p.addressColor,
          size: 'medium',
          background: 'transparent',
        },
        start: 1,
        length: 43,
        position: 'bottom',
        offset: { x: 0, y: price ? 0.22 : 0.16 },
        transition: { in: transition },
      }]
    });
  }

  // Track 4: city
  if (city) {
    tracks.push({
      clips: [{
        asset: {
          type: 'title',
          text: city,
          style: 'minimal',
          color: p.cityColor,
          size: 'small',
          background: 'transparent',
        },
        start: 1.2,
        length: 42.8,
        position: 'bottom',
        offset: { x: 0, y: price ? 0.14 : 0.09 },
        transition: { in: transition },
      }]
    });
  }

  // Track 5: price
  if (price) {
    tracks.push({
      clips: [{
        asset: {
          type: 'title',
          text: price,
          style: 'minimal',
          color: p.priceColor,
          size: 'medium',
          background: 'transparent',
        },
        start: 1.4,
        length: 42.6,
        position: 'bottom',
        offset: { x: 0, y: 0.06 },
        transition: { in: transition },
      }]
    });
  }

  // Track 6: contact
  if (contact) {
    tracks.push({
      clips: [{
        asset: {
          type: 'title',
          text: contact,
          style: 'minimal',
          color: p.contactColor,
          size: 'x-small',
          background: 'transparent',
        },
        start: 1.6,
        length: 42.4,
        position: 'bottom',
        offset: { x: 0, y: 0.02 },
        transition: { in: transition },
      }]
    });
  }

  return { tracks };
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
    if (status === 'failed') throw new Error('Shotstack render failed');
  }
  throw new Error('Render timed out');
}

async function uploadToSupabase(videoUrl, fileName) {
  // Download from Shotstack
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) throw new Error('Failed to fetch rendered video');
  const buf = await videoRes.arrayBuffer();

  // Upload to Supabase
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
    // Build Shotstack timeline
    const timeline = buildTimeline({ videoUrl, address, city, banner, price, contact, preset, fadeIn });

    // Submit render
    const renderRes = await fetch(`${BASE_URL}/render`, {
      method: 'POST',
      headers: {
        'x-api-key': SHOTSTACK_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeline,
        output: { format: 'mp4', resolution: 'hd', aspectRatio: '9:16' }
      }),
    });

    const renderData = await renderRes.json();
    if (!renderRes.ok || !renderData.success) {
      throw new Error(renderData?.response?.message || 'Shotstack render failed to queue');
    }

    const renderId = renderData.response.id;

    // Poll for completion
    const shotstackUrl = await pollRender(renderId);

    // Upload to Supabase Storage for permanent hosting
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
