/**
 * One-time setup endpoint to create market_intelligence and signature_library tables
 * GET /api/setup-tables?token=SETUP
 */
export default async function handler(req, res) {
  if (req.query.token !== 'SETUP2026') return res.status(401).json({ error: 'Unauthorized' });

  const SUPABASE_URL = 'https://oftrlapeiqvokgnsscxa.supabase.co';
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const sql = `
    CREATE TABLE IF NOT EXISTS market_intelligence (
      id bigserial primary key,
      created_at timestamptz default now(),
      week_of date not null,
      platform text,
      hashtag text,
      top_formats jsonb,
      trending_hooks jsonb,
      format_insights jsonb,
      raw_data jsonb,
      status text default 'new'
    );
    CREATE TABLE IF NOT EXISTS signature_library (
      id bigserial primary key,
      created_at timestamptz default now(),
      client_id text default 'jon',
      name text not null,
      description text,
      preset_config jsonb not null,
      source text,
      approved_at timestamptz,
      performance_data jsonb,
      tags text[]
    );
    INSERT INTO signature_library (name, description, preset_config, source, tags)
    VALUES
      ('Classic', 'Clean white text, green price, dark gradient. Simple and professional.', '{"preset":"classic","phases":1}', 'built-in', ARRAY['simple','professional']),
      ('Bold', 'Orange accents, high contrast, punchy energy. Great for new construction.', '{"preset":"bold","phases":1}', 'built-in', ARRAY['energetic','newconstruction']),
      ('Luxury', 'Gold accents, italic banner, premium feel.', '{"preset":"luxury","phases":1}', 'built-in', ARRAY['luxury','gold','premium']),
      ('Minimal', 'Light text, clean and modern.', '{"preset":"minimal","phases":1}', 'built-in', ARRAY['modern','clean']),
      ('Signature', '5-phase cinematic sequence. Aiden''s flagship format.', '{"preset":"signature","phases":5}', 'aiden-built', ARRAY['cinematic','flagship','multi-phase'])
    ON CONFLICT DO NOTHING;
  `;

  const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': KEY,
      'Authorization': `Bearer ${KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql }),
  });

  // exec_sql may not exist — try via pg endpoint
  if (!resp.ok) {
    // Fallback: create tables by inserting to trigger auto-create isn't possible
    // Return instructions instead
    return res.status(200).json({
      message: 'Tables need to be created via Supabase dashboard SQL editor',
      sql: sql.trim(),
    });
  }

  return res.status(200).json({ success: true });
}
