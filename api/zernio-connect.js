/**
 * Zernio OAuth Connect — generates a platform-specific connect URL and redirects.
 * Usage: /api/zernio-connect?platform=instagram
 *
 * Requires env vars:
 *   ZERNIO_API_KEY       — Zernio API key (zackzempel@gmail.com account)
 *   ZERNIO_PROFILE_ID    — Zernio profile ID for Jon (auto-created on first run, then save it)
 */

const ZERNIO_BASE = 'https://zernio.com/api/v1';

const VALID_PLATFORMS = ['instagram', 'tiktok', 'facebook', 'youtube'];

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { platform } = req.query;

  if (!platform || !VALID_PLATFORMS.includes(platform)) {
    return res.status(400).json({ error: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(', ')}` });
  }

  const ZERNIO_API_KEY   = process.env.ZERNIO_API_KEY;
  const ZERNIO_PROFILE_ID = process.env.ZERNIO_PROFILE_ID;

  if (!ZERNIO_API_KEY) {
    return res.status(500).json({ error: 'ZERNIO_API_KEY not configured' });
  }

  try {
    let profileId = ZERNIO_PROFILE_ID;

    // If no profile ID configured, create one for Jon and surface the ID in logs
    if (!profileId) {
      const profileRes = await fetch(`${ZERNIO_BASE}/profiles`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ZERNIO_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Jon Severson',
          description: 'Real estate agent — Jon Severson, Real Broker LLC',
        }),
      });
      const profileData = await profileRes.json();
      if (!profileRes.ok) throw new Error(`Profile creation failed: ${JSON.stringify(profileData)}`);
      profileId = profileData.profile?._id;
      console.log(`[zernio-connect] Created profile: ${profileId} — add ZERNIO_PROFILE_ID=${profileId} to Vercel env vars`);
    }

    // Generate the OAuth connect URL
    const connectRes = await fetch(`${ZERNIO_BASE}/connect/url`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ZERNIO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ platform, profileId }),
    });

    const connectData = await connectRes.json();
    if (!connectRes.ok) throw new Error(`Connect URL failed: ${JSON.stringify(connectData)}`);

    const authUrl = connectData.authUrl || connectData.url;
    if (!authUrl) throw new Error(`No auth URL in response: ${JSON.stringify(connectData)}`);

    // Redirect Jon to the OAuth page
    return res.redirect(302, authUrl);

  } catch (err) {
    console.error('[zernio-connect] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
