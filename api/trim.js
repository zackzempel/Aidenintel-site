import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  const { url, start, end } = req.query;

  if (!url || start === undefined || end === undefined) {
    return res.status(400).json({ error: 'Missing url, start, or end' });
  }

  const s = parseFloat(start);
  const e = parseFloat(end);
  if (isNaN(s) || isNaN(e) || e <= s) {
    return res.status(400).json({ error: 'Invalid start/end times' });
  }

  // Allow only Aryeo video URLs for security
  let decodedUrl;
  try {
    decodedUrl = decodeURIComponent(url);
    const u = new URL(decodedUrl);
    if (!u.hostname.endsWith('aryeo.com') && !u.hostname.endsWith('videos.aryeo.com')) {
      return res.status(403).json({ error: 'URL not allowed' });
    }
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Disposition', `attachment; filename="clip-${Math.round(s)}-${Math.round(e)}s.mp4"`);
  res.setHeader('Access-Control-Allow-Origin', '*');

  // ffmpeg: seek input, copy streams, fragmented MP4 to stdout
  const args = [
    '-ss', s.toFixed(3),
    '-to', e.toFixed(3),
    '-i', decodedUrl,
    '-c', 'copy',
    '-movflags', 'frag_keyframe+empty_moov',
    '-f', 'mp4',
    'pipe:1'
  ];

  const ff = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });

  ff.stdout.pipe(res);

  ff.stderr.on('data', () => {}); // suppress ffmpeg logs

  ff.on('error', (err) => {
    console.error('ffmpeg spawn error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'ffmpeg error' });
  });

  ff.on('close', (code) => {
    if (code !== 0 && !res.writableEnded) res.end();
  });

  req.on('close', () => ff.kill('SIGTERM'));
}
