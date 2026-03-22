export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.Anthropic_API_Key;
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'API key not configured' });

  const { messages, mode, clientId } = req.body;
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'Invalid messages' });

  // Rate limit: max 30 messages in history
  if (messages.length > 30) return res.status(429).json({ error: 'Session limit reached' });

  // Mode: 'chat' = Haiku (fast back-and-forth), 'summarize' = Sonnet (generate structured request)
  const model = (mode === 'summarize' || mode === 'summarize-intake')
    ? 'claude-sonnet-4-6'
    : 'claude-haiku-4-5';

  const systemPrompt = mode === 'summarize-intake'
    ? `You are Aiden at Aiden Intel. You just helped John Reilly think through his intake questions for a B2B Lead Generation project for Rayito de Sol.

Review the conversation and extract clear answers to these 4 intake questions. Format your response EXACTLY like this — one answer per line, no extra text:

Q1: [answer to "What's your current monthly web lead volume, and what % convert to enrolled students?"]
Q2: [answer to "Geographic focus for B2B outreach — Illinois, Minnesota, or both simultaneously?"]
Q3: [answer to "Do you have any existing B2B relationships or partnerships we should know about?"]
Q4: [answer to "What's your rough budget range for outreach materials (flyers, digital assets, direct mail)?"]

If John didn't address a question, write Q[n]: Not provided. Be concise — these go directly into form fields.`
    : mode === 'summarize'
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

    : buildChatSystemPrompt(clientId);

  function buildChatSystemPrompt(clientId) {
    const base = `You are Aiden, an AI consultant at Aiden Intel. You are having a brainstorming conversation with a client through their portal.

Your job:
- Help them think through and refine their idea
- Ask clarifying questions to make it specific and actionable
- Be honest if something sounds hard, expensive, or out of scope
- Keep responses short and conversational — this is a chat, not a report
- When the idea feels solid, tell them and suggest they click "Generate Request →"

Do not use bullet points or markdown headers. Keep it natural and direct — like texting with a sharp consultant.`;

    if (clientId === 'john') {
      return base + `

About this client — John Reilly:
- Operating partner of a holding company; first engagement is Rayito de Sol
- Rayito de Sol: Spanish immersion daycare & early learning center, ages 6 weeks–6 years
- Locations: Illinois and Minnesota
- Current focus: reducing reliance on web leads, building B2B outreach to residential condos and kid-adjacent businesses
- Discovery phase — no builds completed yet, still scoping
- Practical, gets to the point, thinks at a business/portfolio level`;
    }

    // Default: Jon Severson
    return base + `

About this client — Jon Severson:
- Real estate agent at Real Broker LLC in Minnesota
- Current projects: website redesign (awaiting approval), social media caption pipeline, SEO strategy
- Tech stack: Lofty CRM + Northstar MLS IDX feed
- Constraint: website must be built in Lofty (MLS requirement)
- Works with AGNT Media for professional listing videos
- Practical, direct, gets to the point`;
  }

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
