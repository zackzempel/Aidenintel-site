/**
 * gmb-callback.js — Handle Google OAuth callback, store tokens
 * GET /api/gmb-callback?code=...
 */

const CLIENT_ID     = process.env.GMB_CLIENT_ID;
const CLIENT_SECRET = process.env.GMB_CLIENT_SECRET;
const REDIRECT_URI  = 'https://www.aidenintel.com/api/gmb-callback';
const SUPABASE_URL  = 'https://oftrlapeiqvokgnsscxa.supabase.co';
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  const { code, error } = req.query;

  if (error) {
    return res.status(400).send(`OAuth error: ${error}`);
  }
  if (!code) {
    return res.status(400).send('No authorization code received');
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri:  REDIRECT_URI,
        grant_type:    'authorization_code',
      }),
    });

    const tokens = await tokenRes.json();
    if (!tokenRes.ok || tokens.error) {
      throw new Error(tokens.error_description || tokens.error || 'Token exchange failed');
    }

    // Get account info to find GMB account + location IDs
    const accountsRes = await fetch(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    const accountsData = await accountsRes.json();
    const account = accountsData.accounts?.[0];
    const accountId = account?.name; // e.g. "accounts/123456789"

    // Get first location
    let locationId = null;
    if (accountId) {
      const locRes = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${accountId}/locations?readMask=name,title`,
        { headers: { Authorization: `Bearer ${tokens.access_token}` } }
      );
      const locData = await locRes.json();
      locationId = locData.locations?.[0]?.name; // e.g. "locations/987654321"
    }

    // Store tokens in Supabase
    await fetch(`${SUPABASE_URL}/rest/v1/gmb_tokens`, {
      method: 'POST',
      headers: {
        'apikey':        SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type':  'application/json',
        'Prefer':        'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        client_id:     'jon',
        account_id:    accountId,
        location_id:   locationId,
        access_token:  tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at:    new Date(Date.now() + (tokens.expires_in * 1000)).toISOString(),
        scope:         tokens.scope,
      }),
    });

    return res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#0a0a0f;color:#f0f0f5;">
        <h2 style="color:#10b981;">✅ Google My Business Connected!</h2>
        <p style="color:#9090a8;">Account: ${account?.title || accountId || 'connected'}</p>
        <p style="color:#9090a8;">Location: ${locationId || 'found'}</p>
        <p style="margin-top:32px;"><a href="/clients/jon" style="color:#818cf8;">← Back to Portal</a></p>
      </body></html>
    `);

  } catch (e) {
    console.error('GMB callback error:', e);
    return res.status(500).send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#0a0a0f;color:#f0f0f5;">
        <h2 style="color:#ef4444;">❌ Connection failed</h2>
        <p style="color:#9090a8;">${e.message}</p>
        <p style="margin-top:32px;"><a href="/api/gmb-auth" style="color:#818cf8;">Try again →</a></p>
      </body></html>
    `);
  }
}
