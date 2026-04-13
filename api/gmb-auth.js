/**
 * gmb-auth.js — Initiate Google My Business OAuth flow
 * GET /api/gmb-auth
 * Redirects Zack to Google's consent screen to authorize GMB access
 */

const CLIENT_ID     = process.env.GMB_CLIENT_ID;
const REDIRECT_URI  = 'https://www.aidenintel.com/api/gmb-callback';

const SCOPES = [
  'https://www.googleapis.com/auth/business.manage',
].join(' ');

export default function handler(req, res) {
  if (!CLIENT_ID) return res.status(500).json({ error: 'GMB_CLIENT_ID not configured' });

  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    response_type: 'code',
    scope:         SCOPES,
    access_type:   'offline',   // gets refresh token
    prompt:        'consent',   // forces refresh token every time
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
