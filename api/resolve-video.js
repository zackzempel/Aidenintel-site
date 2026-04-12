/**
 * resolve-video.js — Resolve an Aryeo viewer URL to a direct .mp4 link
 * GET /api/resolve-video?url=https://agnt-media.aryeo.com/videos/...
 */

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url required' });

  // If it's already a direct mp4, just return it
  if (url.endsWith('.mp4')) {
    return res.status(200).json({ mp4: url, resolved: false });
  }

  try {
    const pageRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!pageRes.ok) throw new Error(`Page fetch failed: ${pageRes.status}`);

    const html = await pageRes.text();

    // Extract direct .mp4 URLs
    const matches = html.match(/https:\/\/[^"' \s]+\.mp4/g) || [];
    const unique = [...new Set(matches)];

    // Prefer videos.aryeo.com links
    const preferred = unique.find(u => u.includes('videos.aryeo.com')) || unique[0];

    if (!preferred) {
      return res.status(404).json({ error: 'No MP4 found on page. Try copying the direct video URL from AGNT Media.' });
    }

    return res.status(200).json({ mp4: preferred, resolved: true, allFound: unique });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
