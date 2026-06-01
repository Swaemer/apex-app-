import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'

const SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/1Hl4Gdt5_t_3DaYrHKAyK19KQu6GiiBpjBvEe-kduBTA/export?format=csv&gid=0'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    babel({ presets: [reactCompilerPreset()] }),
    {
      name: 'sheets-proxy',
      configureServer(server) {
        server.middlewares.use('/sheets-proxy', async (_req, res) => {
          try {
            const response = await fetch(SHEET_CSV_URL, { redirect: 'follow' })
            const csvText = await response.text()

            // Convert CSV → JSON array of arrays (same format as Apps Script)
            const rows = csvText
              .split('\n')
              .filter((line) => line.trim())
              .map((line) =>
                line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''))
              )

            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Access-Control-Allow-Origin', '*')
            res.end(JSON.stringify(rows))
          } catch (err) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: String(err) }))
          }
        })
      },
    },
  ],
})
