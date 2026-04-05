/**
 * workshop-chat.js — Aiden's creative direction chat for the Video Workshop
 * POST /api/workshop-chat
 * Body: { messages: [...], listing: { videoUrl, address, city, price } }
 *
 * Aiden reads the listing context, understands the creative brief from Jon,
 * and returns both a chat reply AND structured form overrides to apply.
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.Anthropic_API_Key;
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'API key not configured' });

  const { messages, listing = {} } = req.body;
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'Invalid messages' });

  const { address = '', city = '', price = '', videoUrl = '' } = listing;

  const systemPrompt = `You are Aiden — a creative director and AI consultant at Aiden Intel. You are helping Jon Severson, a real estate agent in the Twin Cities / Anoka County, Minnesota, design a listing video overlay using Shotstack.

Current listing context:
- Address: ${address || 'not set'}
- City: ${city || 'not set'}
- Price: ${price || 'not set'}
- Video URL: ${videoUrl ? 'loaded' : 'not loaded'}

Available style presets:
- classic: Clean white text, "JUST LISTED" banner, professional and timeless
- bold: High energy, orange accents, fire emoji, loud and attention-grabbing
- luxury: Gold accents, "NOW AVAILABLE", elegant and upscale, good for higher-end homes
- minimal: No top banner, subtle gray/white text, modern and understated
- custom: Fully custom — you control banner text, colors, everything

Available overlay options you can set:
- preset: (classic/bold/luxury/minimal/custom)
- banner: top banner text (e.g. "JUST LISTED", "PRICE REDUCED", "OPEN HOUSE SAT 12-2PM", etc.)
- price: price text (e.g. "$425,000")
- showPrice: true/false — whether to show price on video
- showBanner: true/false — whether to show top banner
- accentColor: hex color for accents (e.g. "#d4af37" for gold, "#ff6b35" for orange)
- textColor: hex color for main text

Your job:
1. Have a natural creative conversation with Jon — ask about the property vibe, what he wants to highlight, who the buyer is
2. Make specific suggestions — don't just ask questions, give recommendations based on what you know about MN real estate
3. When you have enough to make a solid recommendation, include a JSON block at the end of your response with your suggested settings
4. Keep responses SHORT — 2-4 sentences max, then the JSON if ready. This is a chat, not an essay.
5. Be direct and opinionated. Jon wants a creative partner, not a yes-man.

When ready to apply settings, end your message with a JSON block like this (and ONLY when you have a real recommendation):
<settings>
{
  "preset": "luxury",
  "banner": "JUST LISTED",
  "price": "$425,000",
  "showPrice": true,
  "showBanner": true,
  "accentColor": "#d4af37",
  "textColor": "#f5e6c8",
  "readyToApply": true
}
</settings>

If you're still gathering info or just chatting, do NOT include the <settings> block.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 600,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(502).json({ error: err.error?.message || 'Anthropic error' });
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text || '';

    // Parse out settings block if present
    const settingsMatch = rawText.match(/<settings>([\s\S]*?)<\/settings>/);
    let settings = null;
    let text = rawText;

    if (settingsMatch) {
      try {
        settings = JSON.parse(settingsMatch[1].trim());
        text = rawText.replace(/<settings>[\s\S]*?<\/settings>/, '').trim();
      } catch (e) {
        // If JSON parse fails, just return the raw text
      }
    }

    return res.status(200).json({ text, settings });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
