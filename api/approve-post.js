/**
 * approve-post.js — Jon's Social Approval & Post Endpoint
 * POST /api/approve-post
 * Body: { captionId, approvedAccounts: ['instagram_main','instagram_fishtrap','tiktok','youtube'], collabTags: ['@calebcarlson'] }
 * 
 * Flow:
 *  1. Fetch caption row from Supabase
 *  2. Post to each approved platform via Zernio
 *  3. Mark caption as 'posted' in Supabase
 *  4. Send confirmation email to Jon + Telegram to Zack
 */

const SUPABASE_URL = 'https://oftrlapeiqvokgnsscxa.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
const ZERNIO_API_KEY = process.env.ZERNIO_API_KEY;
const AGENTMAIL_API_KEY = process.env.AGENTMAIL_API_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = '8725425836';

// Jon's Instagram accounts
const IG_ACCOUNTS = {
  instagram_main:     process.env.ZERNIO_IG_MAIN_ACCOUNT_ID     || null, // @seversonrealestate
  instagram_fishtrap: process.env.ZERNIO_INSTAGRAM_ACCOUNT_ID,           // @seversonrealestatefishtrap (connected)
  instagram_personal: process.env.ZERNIO_IG_PERSONAL_ACCOUNT_ID || null, // @realjonserverson
};

const PLATFORM_ACCOUNTS = {
  tiktok:  process.env.ZERNIO_TIKTOK_ACCOUNT_ID,
  youtube: process.env.ZERNIO_YOUTUBE_ACCOUNT_ID,
};

const ZERNIO_BASE = 'https://zernio.com/api/v1';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function supabaseFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase ${path}: ${res.status} ${err}`);
  }
  return options.method === 'PATCH' ? null : res.json();
}

async function zernioPost({ accountId, platform, caption, videoUrl, collabTags = [] }) {
  const body = {
    mediaItems: [{ type: 'video', url: videoUrl }],
    platforms: [{ platform: platform.startsWith('instagram') ? 'instagram' : platform, accountId }],
    content: caption,
    publishNow: true,
  };

  // Add TikTok settings
  if (platform === 'tiktok') {
    body.tiktokSettings = {
      privacy_level: 'PUBLIC_TO_EVERYONE',
      allow_comment: true,
      allow_duet: true,
      allow_stitch: true,
    };
  }

  // Add YouTube settings
  if (platform === 'youtube') {
    body.youtubeSettings = {
      title: caption.split('\n')[0].substring(0, 100),
      privacyStatus: 'public',
      madeForKids: false,
    };
  }

  // Collab tags for Instagram
  if (platform.startsWith('instagram') && collabTags.length > 0) {
    body.instagramSettings = {
      collaborators: collabTags.map(t => t.replace('@', '')).slice(0, 5),
    };
  }

  const res = await fetch(`${ZERNIO_BASE}/posts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ZERNIO_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Zernio ${platform}: ${res.status} ${JSON.stringify(data)}`);
  return data;
}

async function sendEmail({ to, subject, text }) {
  const res = await fetch('https://api.agentmail.to/v0/inboxes/aiden.intel@agentmail.to/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AGENTMAIL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ to: [to], subject, text }),
  });
  if (!res.ok) console.error('Email send failed:', await res.text());
}

async function sendTelegram(text) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'HTML' }),
  });
}

// ── Main Handler ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { captionId, approvedAccounts = [], collabTags = [], dryRun = false } = req.body;

  if (!captionId) return res.status(400).json({ error: 'captionId required' });
  if (!approvedAccounts.length) return res.status(400).json({ error: 'Select at least one platform' });

  try {
    // 1. Fetch the caption row
    const rows = await supabaseFetch(`/social_captions?id=eq.${captionId}&select=*`);
    if (!rows.length) return res.status(404).json({ error: 'Caption not found' });
    const caption = rows[0];

    if (caption.status === 'posted') {
      return res.status(409).json({ error: 'Already posted' });
    }

    // 2. Build post jobs
    const jobs = [];

    for (const acct of approvedAccounts) {
      if (acct === 'instagram_main' && IG_ACCOUNTS.instagram_main) {
        jobs.push({ platform: 'instagram_main', accountId: IG_ACCOUNTS.instagram_main, caption: caption.instagram_caption });
      } else if (acct === 'instagram_fishtrap' && IG_ACCOUNTS.instagram_fishtrap) {
        jobs.push({ platform: 'instagram_fishtrap', accountId: IG_ACCOUNTS.instagram_fishtrap, caption: caption.instagram_caption });
      } else if (acct === 'instagram_personal' && IG_ACCOUNTS.instagram_personal) {
        jobs.push({ platform: 'instagram_personal', accountId: IG_ACCOUNTS.instagram_personal, caption: caption.instagram_caption });
      } else if (acct === 'tiktok' && PLATFORM_ACCOUNTS.tiktok) {
        jobs.push({ platform: 'tiktok', accountId: PLATFORM_ACCOUNTS.tiktok, caption: caption.tiktok_caption });
      } else if (acct === 'youtube' && PLATFORM_ACCOUNTS.youtube) {
        jobs.push({ platform: 'youtube', accountId: PLATFORM_ACCOUNTS.youtube, caption: caption.youtube_description });
      }
    }

    if (!jobs.length) return res.status(400).json({ error: 'No connected accounts matched selection' });

    // 3. Dry run — just return what would be posted
    if (dryRun) {
      return res.status(200).json({
        dryRun: true,
        captionId,
        listing: caption.listing_address,
        jobs: jobs.map(j => ({ platform: j.platform, captionPreview: j.caption?.substring(0, 80) + '...' })),
        collabTags,
      });
    }

    // 4. Post to each platform
    const results = [];
    const errors = [];

    for (const job of jobs) {
      try {
        const result = await zernioPost({
          accountId: job.accountId,
          platform: job.platform,
          caption: job.caption,
          videoUrl: caption.video_url,
          collabTags: job.platform.startsWith('instagram') ? collabTags : [],
        });
        results.push({ platform: job.platform, postId: result.id || result.postId, status: 'ok' });
      } catch (err) {
        errors.push({ platform: job.platform, error: err.message });
      }
    }

    // 5. Update Supabase status
    const allFailed = results.length === 0;
    await supabaseFetch(`/social_captions?id=eq.${captionId}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        status: allFailed ? 'error' : 'posted',
        approved_at: new Date().toISOString(),
      }),
    });

    // 6. Build summary
    const posted = results.map(r => {
      const labels = { instagram_main: 'Instagram (Main)', instagram_fishtrap: 'Instagram (Fishtrap)', instagram_personal: 'Instagram (Personal)', tiktok: 'TikTok', youtube: 'YouTube' };
      return labels[r.platform] || r.platform;
    });
    const failed = errors.map(e => e.platform);

    // 7. Notify Jon via email
    if (!allFailed) {
      const jonEmail = 'jon@seversonre.com';
      await sendEmail({
        to: jonEmail,
        subject: `✅ Posted: ${caption.listing_address}`,
        text: `Hey Jon,\n\nYour listing is live!\n\n📍 ${caption.listing_address}\n\n✅ Posted to: ${posted.join(', ')}${failed.length ? `\n⚠️ Failed: ${failed.join(', ')}` : ''}\n\n${collabTags.length ? `Collab tags sent to: ${collabTags.join(', ')}\n\n` : ''}Check your accounts — posts should be visible within a few minutes.\n\n— Aiden\nAiden Intel`,
      });
    }

    // 8. Notify Zack via Telegram
    await sendTelegram(
      `📱 <b>Jon's post fired!</b>\n📍 ${caption.listing_address}\n✅ ${posted.join(', ')}${failed.length ? `\n⚠️ Failed: ${failed.join(', ')}` : ''}${collabTags.length ? `\n🤝 Collab: ${collabTags.join(', ')}` : ''}`
    );

    return res.status(200).json({ success: true, posted, failed, errors });

  } catch (err) {
    console.error('approve-post error:', err);
    return res.status(500).json({ error: err.message });
  }
}
