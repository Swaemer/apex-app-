export default async function handler(req, res) {
  const SHEET_URL =
    'https://docs.google.com/spreadsheets/d/1Hl4Gdt5_t_3DaYrHKAyK19KQu6GiiBpjBvEe-kduBTA/export?format=csv&gid=0';

  const response = await fetch(SHEET_URL, { redirect: 'follow' });
  const csv = await response.text();

  const rows = csv
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => l.split(',').map((c) => c.trim().replace(/^"|"$/g, '')));

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json(rows);
}
