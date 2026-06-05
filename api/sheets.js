export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // POST — كتابة IDs للشيت عبر Apps Script
  if (req.method === 'POST') {
    const WRITE_URL = process.env.SHEETS_WRITE_URL;
    if (!WRITE_URL) return res.status(503).json({ error: 'SHEETS_WRITE_URL not configured' });

    const response = await fetch(WRITE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      redirect: 'follow',
    });
    const data = await response.json();
    return res.json(data);
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
