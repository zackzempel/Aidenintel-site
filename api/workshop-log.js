/**
 * workshop-log.js — Log workshop activity to Supabase
 * POST /api/workshop-log
 * Body: { event_type, listing_address, video_url, preset, details, error_message, status }
 *
 * Events: session_start, generate_start, generate_success, generate_error, aiden_pick_start, aiden_pick_success, aiden_pick_error, portal_deeplink
 */

const SUPABASE_URL = 'https://oftrlapeiqvokgnsscxa.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_IDS = (process.env.TELEGRAM_CHAT_IDS || process.env.TELEGRAM_CHAT_ID || '').split(',');

// Events that should trigger a Telegram ping
const NOTIFY_EVENTS = ['generate_error', 'aiden_pick_error', 'generate_success', 'aiden_pick_success'];

async function sendTelegram(text) {
  if (!TELEGRAM_BOT_TOKEN) return;
  await Promise.all(TELEGRAM_CHAT_IDS.map(chat_id =>
    fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat_id.trim(), text, parse_mode: 'HTML' }),
    })
  ));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const {
    event_type,
    listing_address = null,
    video_url = null,
    preset = null,
    details = {},
    error_message = null,
    status = 'ok',
  } = req.body || {};

  if (!event_type) return res.status(400).json({ error: 'event_type required' });

  try {
    // Store in Supabase
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/workshop_activity`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        client_id: 'jon',
        event_type,
        listing_address,
        video_url,
        preset,
        details,
        error_message,
        status,
      }),
    });

    if (!insertRes.ok) {
      const err = await insertRes.text();
      console.error('Supabase insert error:', err);
    }

    // Notify on key events
    if (NOTIFY_EVENTS.includes(event_type)) {
      const emoji = status === 'error' || event_type.includes('error') ? '⚠️' : '🎬';
      const label = {
        generate_success: 'Video rendered',
        generate_error: 'Render failed',
        aiden_pick_success: "Aiden's Pick rendered",
        aiden_pick_error: "Aiden's Pick failed",
      }[event_type] || event_type;

      let msg = `${emoji} <b>Workshop: ${label}</b>`;
      if (listing_address) msg += `\n📍 ${listing_address}`;
      if (preset) msg += `\n🎨 Style: ${preset}`;
      if (error_message) msg += `\n❌ ${error_message}`;
      if (video_url && status === 'ok') msg += `\n<a href="${video_url}">▶ Preview</a>`;

      await sendTelegram(msg);
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('workshop-log error:', e);
    return res.status(500).json({ error: e.message });
  }
}
