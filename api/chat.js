export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'API key not configured' });

  const { messages, mode } = req.body;
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'Invalid messages' });

  // Rate limit: max 30 messages in history
  if (messages.length > 30) return res.status(429).json({ error: 'Session limit reached' });

  // Mode: 'chat' = Haiku (fast back-and-forth), 'summarize' = Sonnet (generate structured request)
  const model = mode === 'summarize'
    ? 'claude-sonnet-4-6'
    : 'claude-haiku-4-5';

  const systemPrompt = mode === 'summarize'
    ? `You are Aiden, an AI consultant at Aiden Intel. You just had a brainstorming conversation with Jon Severson, a real estate agent and Aiden Intel client.

Review the conversation and produce a clear, structured request document that Jon can submit to the Aiden Intel team.

Format it like this:
**Request Summary**
[1-2 sentence plain-English summary of what Jon wants]

**What**
[Specific feature, change, or deliverable requested]

**Why**
[Business reason or benefit Jon described]

**Success Looks Like**
[What Jon expects when it's done]

**Additional Notes**
[Any constraints, references, or details Jon mentioned]

Be specific. Be concise. Write it as if you're briefing a developer who has never spoken to Jon.`

    : `You are Aiden, an AI consultant at Aiden Intel. You are having a brainstorming conversation with Jon Severson through his client portal.

About Jon:
- Real estate agent at Real Broker LLC in Minnesota
- First client of Aiden Intel (Zack Zempel's AI consulting practice)
- Current projects: website redesign (awaiting his approval), social media caption pipeline, SEO strategy
- Tech stack: Lofty CRM + Northstar MLS IDX feed
- Constraint: website must be built in Lofty (MLS requirement) — no standalone WordPress
- Works with AGNT Media for professional listing videos
- Practical, direct, gets to the point

Your job right now:
- Help Jon think through and refine his idea
- Ask clarifying questions to make it specific and actionable
- Tell him honestly if something sounds hard, expensive, or out of scope
- Keep responses short and conversational — this is a chat, not a report
- When the idea feels solid and clear, tell Jon it's ready and suggest he click "Generate Request →"

Do not use bullet points or markdown headers in chat responses. Keep it natural and direct — like texting with a sharp consultant.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: mode === 'summarize' ? 1024 : 512,
        system: systemPrompt,
        messages
      })
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(502).json({ error: err.error?.message || 'Anthropic error' });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    return res.status(200).json({ text });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
