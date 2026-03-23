export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const payload = req.body;
    const record = payload?.record;
    if (!record) return res.status(400).json({ error: 'No record' });

    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_IDS = (process.env.TELEGRAM_CHAT_IDS || process.env.TELEGRAM_CHAT_ID).split(',');

    const isIntake = record.client_id === 'intake';
    const intakeLink = isIntake && record.audio_url
      ? `\n🔗 *Intake Page:* https://aidenintel.com/intake/${record.audio_url}`
      : '';
    const instruction = isIntake
      ? `Aiden — this is a new prospect intake. Review the request, post a response to their intake page within 30 minutes. Update the record in Supabase: set status='done' and prepend [response] to the message field with your response text.`
      : `Aiden — handle this request now, deploy the change, mark it done in Supabase, and reply here when complete.`;

    const msg = `🤖 *AIDEN AUTO-TASK*\n\n` +
      `New request from *${record.client_name}* (Request #${record.id})\n\n` +
      `📋 *Type:* ${record.request_type}\n` +
      `💬 *Request:* ${record.message}\n` +
      `🕐 *Time:* ${new Date(record.created_at).toLocaleString('en-US', {timeZone: 'America/Chicago'})}${intakeLink}\n\n` +
      instruction;

    await Promise.all(CHAT_IDS.map(chat_id =>
      fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chat_id.trim(),
          text: msg,
          parse_mode: 'Markdown'
        })
      })
    ));

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
