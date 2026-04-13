/**
 * gmb-reviews.js — Poll for new GMB reviews, draft 3 responses, email Jon
 * POST /api/gmb-reviews (called by cron or manually)
 */

const CLIENT_ID     = process.env.GMB_CLIENT_ID;
const CLIENT_SECRET = process.env.GMB_CLIENT_SECRET;
const SUPABASE_URL  = 'https://oftrlapeiqvokgnsscxa.supabase.co';
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.Anthropic_API_Key;
const AGENTMAIL_KEY = process.env.AGENTMAIL_API_KEY;
const TELEGRAM_BOT  = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT = '8725425836';

// ── Token Management ──────────────────────────────────────────────────────────

async function getTokens() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/gmb_tokens?client_id=eq.jon&limit=1`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  );
  const rows = await res.json();
  if (!rows.length) throw new Error('GMB not connected — run /api/gmb-auth first');
  return rows[0];
}

async function refreshAccessToken(refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type:    'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Token refresh failed: ${data.error_description || data.error}`);

  // Update in Supabase
  await fetch(`${SUPABASE_URL}/rest/v1/gmb_tokens?client_id=eq.jon`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json', 'Prefer': 'return=minimal',
    },
    body: JSON.stringify({
      access_token: data.access_token,
      expires_at:   new Date(Date.now() + (data.expires_in * 1000)).toISOString(),
    }),
  });
  return data.access_token;
}

async function getValidToken(tokenRow) {
  const expired = new Date(tokenRow.expires_at) < new Date(Date.now() + 60000);
  if (expired) return refreshAccessToken(tokenRow.refresh_token);
  return tokenRow.access_token;
}

// ── GMB Reviews API ───────────────────────────────────────────────────────────

async function fetchReviews(accessToken, accountId, locationId) {
  const res = await fetch(
    `https://mybusiness.googleapis.com/v4/${accountId}/${locationId}/reviews?pageSize=10`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`Reviews API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.reviews || [];
}

// ── Claude Response Drafting ──────────────────────────────────────────────────

async function draftResponses(review) {
  const rating = review.starRating; // ONE, TWO, THREE, FOUR, FIVE
  const comment = review.comment || '(no comment left)';
  const reviewer = review.reviewer?.displayName || 'this customer';

  const prompt = `You are helping Jon Severson, a real estate agent in the Twin Cities / Anoka County, Minnesota, respond to a Google Business Profile review.

Reviewer: ${reviewer}
Star Rating: ${rating}
Review: "${comment}"

Write 3 different response options for Jon to choose from:

1. WARM — Personal, grateful, mentions specific details from the review if possible
2. PROFESSIONAL — Polished and business-like, appropriate for all audiences  
3. FRIENDLY — Casual and conversational, feels like Jon's natural voice

Rules:
- Keep each response under 150 words
- Never be defensive (even for negative reviews)
- Always thank the reviewer
- For negative reviews: acknowledge, apologize briefly, offer to make it right (phone/email)
- Include Jon's contact info naturally in at least one response: 763-639-3763
- Don't use clichés like "We strive for excellence"

Return ONLY valid JSON like this:
{
  "warm": "...",
  "professional": "...",
  "friendly": "..."
}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || '';
  const match = text.match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : { warm: text, professional: text, friendly: text };
}

// ── Email Jon ─────────────────────────────────────────────────────────────────

async function emailJon(review, responses) {
  const stars = { ONE: '⭐', TWO: '⭐⭐', THREE: '⭐⭐⭐', FOUR: '⭐⭐⭐⭐', FIVE: '⭐⭐⭐⭐⭐' };
  const rating = stars[review.starRating] || review.starRating;
  const reviewer = review.reviewer?.displayName || 'Someone';
  const comment = review.comment || '(no written comment)';
  const reviewDate = new Date(review.createTime).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const text = `Hey Jon!

New Google review just came in — here are 3 response options ready for you.

━━━━━━━━━━━━━━━━━━━━━━
NEW REVIEW
━━━━━━━━━━━━━━━━━━━━━━

${rating} from ${reviewer} on ${reviewDate}

"${comment}"

━━━━━━━━━━━━━━━━━━━━━━
YOUR 3 RESPONSE OPTIONS
━━━━━━━━━━━━━━━━━━━━━━

OPTION 1 — Warm
${responses.warm}

───

OPTION 2 — Professional
${responses.professional}

───

OPTION 3 — Friendly
${responses.friendly}

━━━━━━━━━━━━━━━━━━━━━━

Reply to this email with the option number you want (1, 2, or 3), any edits, and I'll confirm which one to post. Or just post directly on Google Business Profile.

— Aiden
Aiden Intel`;

  await fetch('https://api.agentmail.to/v0/inboxes/aiden.intel@agentmail.to/messages/send', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${AGENTMAIL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: ['jon@seversonre.com'],
      cc: ['brentzempel@gmail.com'],
      subject: `New Google Review ${rating} — 3 response options ready`,
      text,
    }),
  });
}

async function sendTelegram(text) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text, parse_mode: 'HTML' }),
  });
}

// ── Supabase — Track Processed Reviews ───────────────────────────────────────

async function getProcessedReviewIds() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/gmb_reviews_processed?client_id=eq.jon&select=review_id`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  );
  const rows = await res.json();
  return new Set(rows.map(r => r.review_id));
}

async function markReviewProcessed(reviewId, reviewerName, rating) {
  await fetch(`${SUPABASE_URL}/rest/v1/gmb_reviews_processed`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json', 'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ client_id: 'jon', review_id: reviewId, reviewer_name: reviewerName, star_rating: rating }),
  });
}

// ── Main Handler ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).end();

  try {
    const tokenRow  = await getTokens();
    const token     = await getValidToken(tokenRow);
    const reviews   = await fetchReviews(token, tokenRow.account_id, tokenRow.location_id);
    const processed = await getProcessedReviewIds();

    const newReviews = reviews.filter(r => !processed.has(r.reviewId));
    console.log(`GMB reviews: ${reviews.length} total, ${newReviews.length} new`);

    const results = [];
    for (const review of newReviews) {
      try {
        console.log(`Processing review from ${review.reviewer?.displayName}: ${review.starRating}`);
        const responses = await draftResponses(review);
        await emailJon(review, responses);
        await markReviewProcessed(review.reviewId, review.reviewer?.displayName, review.starRating);

        const stars = { ONE: '⭐', TWO: '⭐⭐', THREE: '⭐⭐⭐', FOUR: '⭐⭐⭐⭐', FIVE: '⭐⭐⭐⭐⭐' };
        await sendTelegram(`⭐ <b>New GMB Review for Jon!</b>\n${stars[review.starRating] || review.starRating} from ${review.reviewer?.displayName || 'Anonymous'}\n\n"${(review.comment || '').substring(0, 150)}"\n\n3 response options sent to Jon.`);

        results.push({ reviewId: review.reviewId, status: 'drafted' });
      } catch (e) {
        console.error(`Failed to process review ${review.reviewId}:`, e.message);
        results.push({ reviewId: review.reviewId, status: 'error', error: e.message });
      }
    }

    return res.status(200).json({
      total: reviews.length,
      new: newReviews.length,
      processed: results,
    });

  } catch (e) {
    console.error('gmb-reviews error:', e);
    return res.status(500).json({ error: e.message });
  }
}
