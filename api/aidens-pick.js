/**
 * aidens-pick.js — Returns Aiden's weekly intelligence brief for Jon's workshop
 * GET /api/aidens-pick
 * Pulls Jon's Metricool data, analyzes with Claude, returns recommendation
 */

const JON_METRICOOL_KEY = process.env.JON_METRICOOL_API_KEY;
const JON_USER = process.env.JON_METRICOOL_USER_ID || '4447917';
const JON_BLOG = process.env.JON_METRICOOL_BLOG_ID || '5741000';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

async function fetchReels() {
  const to = new Date().toISOString().split('T')[0];
  const from = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const res = await fetch(
    `https://app.metricool.com/api/v2/analytics/reels/instagram?blogId=${JON_BLOG}&userId=${JON_USER}&from=${from}T00%3A00%3A00&to=${to}T23%3A59%3A59`,
    { headers: { 'X-Mc-Auth': JON_METRICOOL_KEY } }
  );
  if (!res.ok) throw new Error(`Metricool error: ${res.status}`);
  const data = await res.json();
  return (data.data || []).map(r => ({
    date: r.publishedAt?.dateTime?.split('T')[0],
    views: r.views || 0,
    engagement: Math.round((r.engagement || 0) * 100) / 100,
    avgWatch: Math.round((r.averageWatchTime || 0) * 10) / 10,
    skipRate: Math.round((r.reelsSkipRate || 0) * 10) / 10,
    likes: r.likes || 0,
    shares: r.shares || 0,
    saves: r.saved || 0,
    caption: (r.content || '').substring(0, 150),
  }));
}

async function analyzeWithClaude(reels) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `You are Aiden, AI creative director for Jon Severson, real estate agent in Anoka County / Twin Cities Minnesota.

Analyze his last 6 months of Instagram Reels and give me a recommendation.

DATA: ${JSON.stringify(reels.slice(0, 20))}

Return ONLY valid JSON:
{
  "week_summary": "2-3 sentence brief on what's working for Jon right now",
  "top_insight": "single most important data-backed insight",
  "best_format": "what content type performs best for Jon",
  "avoid": "what to avoid posting",
  "aidens_pick": {
    "format_name": "name",
    "hook": "irresistible first caption line",
    "banner_text": "text for video top overlay (2-3 words)",
    "video_style": "classic",
    "reasoning": "1 sentence on why this will outperform recent content",
    "predicted_engagement": "X% vs his recent average"
  }
}`
      }]
    })
  });

  const data = await res.json();
  let text = data.content?.[0]?.text || '{}';
  if (text.includes('```json')) text = text.split('```json')[1].split('```')[0].trim();
  else if (text.includes('```')) text = text.split('```')[1].split('```')[0].trim();
  return JSON.parse(text);
}

export default async function handler(req, res) {
  // Cache for 24 hours (was 6) to prevent repeated API calls
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600');

  try {
    const reels = await fetchReels();
    if (!reels.length) {
      return res.status(200).json({
        week_summary: "Connect your Instagram account in Metricool to unlock personalized insights.",
        top_insight: "No data yet — check back after connecting your accounts.",
        aidens_pick: null,
      });
    }

    const analysis = await analyzeWithClaude(reels);

    // Add reel stats summary
    const avgEngagement = (reels.reduce((s, r) => s + r.engagement, 0) / reels.length).toFixed(1);
    const avgViews = Math.round(reels.reduce((s, r) => s + r.views, 0) / reels.length);
    const topReel = reels.sort((a, b) => b.engagement - a.engagement)[0];

    return res.status(200).json({
      ...analysis,
      stats: {
        totalReels: reels.length,
        avgEngagement,
        avgViews,
        topPerformer: { engagement: topReel.engagement, caption: topReel.caption?.substring(0, 60) + '...' }
      }
    });

  } catch (err) {
    console.error('aidens-pick error:', err.message);
    // Return error but still cache it for 1 hour to prevent hammering on failures
    res.setHeader('Cache-Control', 's-maxage=3600');
    return res.status(500).json({ error: err.message });
  }
}
