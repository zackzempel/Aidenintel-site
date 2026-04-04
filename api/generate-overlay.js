/**
 * generate-overlay.js — Video overlay generator for Jon's Workshop
 * POST /api/generate-overlay
 * 
 * Accepts video params, runs ffmpeg on the Mac mini via a local worker,
 * uploads result to Supabase Storage, returns public URL.
 * 
 * NOTE: Vercel serverless can't run ffmpeg. This endpoint proxies to a
 * local worker running on the Mac mini (openclaw workspace).
 */

const WORKER_URL = process.env.OVERLAY_WORKER_URL || 'http://localhost:18790';
const WORKER_TOKEN = process.env.OVERLAY_WORKER_TOKEN || '';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    videoUrl, address, city, banner, price, contact,
    preset = 'classic', fadeIn = true, isAidenPick = false,
  } = req.body;

  if (!videoUrl) return res.status(400).json({ error: 'videoUrl required' });
  if (!address) return res.status(400).json({ error: 'address required' });

  try {
    const workerRes = await fetch(`${WORKER_URL}/generate-overlay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(WORKER_TOKEN ? { 'Authorization': `Bearer ${WORKER_TOKEN}` } : {}),
      },
      body: JSON.stringify({ videoUrl, address, city, banner, price, contact, preset, fadeIn, isAidenPick }),
      signal: AbortSignal.timeout(120000), // 2 min timeout
    });

    if (!workerRes.ok) {
      const err = await workerRes.text();
      throw new Error(`Worker error: ${err}`);
    }

    const data = await workerRes.json();
    return res.status(200).json(data);

  } catch (err) {
    console.error('generate-overlay error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
