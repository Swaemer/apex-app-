export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // POST — كتابة IDs للشيت عبر Apps Script
  if (req.method === 'POST') {
    const WRITE_URL = process.env.SHEETS_WRITE_URL;
    if (!WRITE_URL) return res.status(503).json({ error: 'SHEETS_WRITE_URL not configured' });

    try {
      const body = JSON.stringify(req.body);

      // Apps Script يعمل redirect 302 — نتابعه يدوياً عشان ما تُفقد البيانات
      let response = await fetch(WRITE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        redirect: 'manual',
      });

      if (response.status === 301 || response.status === 302) {
        const location = response.headers.get('location');
        response = await fetch(location, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          redirect: 'follow',
        });
      }

      const text = await response.text();
      try {
        return res.json(JSON.parse(text));
      } catch {
        return res.json({ ok: true });
      }
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // GET — قراءة البيانات من الشيت
  const SHEET_URL =
    'https://docs.google.com/spreadsheets/d/1Hl4Gdt5_t_3DaYrHKAyK19KQu6GiiBpjBvEe-kduBTA/export?format=csv&gid=0';

  const response = await fetch(SHEET_URL, { redirect: 'follow' });
  const csv = await response.text();

  const rows = csv
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => l.split(',').map((c) => c.trim().replace(/^"|"$/g, '')));

  res.json(rows);
}
