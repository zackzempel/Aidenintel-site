// AgentMail webhook receiver
// Receives incoming email events, stores in Supabase, triggers cron check

const SUPABASE_URL = 'https://oftrlapeiqvokgnsscxa.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || 'sb_publishable_5Yb-xvGR2Wbng3dK5gSODg_Dl5v_mtB';
const AGENTMAIL_WEBHOOK_SECRET = process.env.AGENTMAIL_WEBHOOK_SECRET || '';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = req.body;

    // Basic validation
    if (!payload || !payload.type) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    // Only handle message.received events
    if (payload.type !== 'message.received') {
      return res.status(200).json({ ok: true, skipped: true });
    }

    const msg = payload.message;
    if (!msg) return res.status(400).json({ error: 'No message in payload' });

    const fromAddress = msg.from?.[0]?.email || 'unknown';
    const fromName = msg.from?.[0]?.name || fromAddress;
    const toAddress = msg.to?.[0]?.email || msg.inbox_id || 'unknown';
    const subject = msg.subject || '(no subject)';
    const bodyText = msg.text || msg.html || '';
    const messageId = msg.message_id || msg.id;
    const inboxId = msg.inbox_id || payload.inbox_id;

    // Insert into Supabase emails table
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/emails`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        message_id: messageId,
        inbox_id: inboxId,
        from_email: fromAddress,
        from_name: fromName,
        to_email: toAddress,
        subject: subject,
        body_text: bodyText.slice(0, 10000), // cap at 10k chars
        raw_payload: payload,
        status: 'new'
      })
    });

    if (!insertRes.ok) {
      const err = await insertRes.text();
      console.error('Supabase insert error:', err);
      return res.status(500).json({ error: 'Failed to store email', detail: err });
    }

    const inserted = await insertRes.json();

    // Notify via existing Telegram notify endpoint (optional wake signal)
    // We rely on the cron job to pick this up, but we can also fire a wake
    try {
      const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = '8725425836'; // Zack's chat

      if (telegramBotToken) {
        await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `📬 New email to ${toAddress}\n\nFrom: ${fromName} <${fromAddress}>\nSubject: ${subject}\n\nI'll handle it shortly.`,
            parse_mode: 'HTML'
          })
        });
      }
    } catch (notifyErr) {
      // Non-fatal
      console.warn('Telegram notify failed:', notifyErr.message);
    }

    return res.status(200).json({ ok: true, id: inserted[0]?.id });

  } catch (err) {
    console.error('Email webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
}
