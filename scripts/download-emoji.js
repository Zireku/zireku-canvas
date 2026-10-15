import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FONT_DIR = path.resolve(__dirname, '../media/font')
const TARGET_FILE = path.join(FONT_DIR, 'AppleColorEmoji.ttf')
const ASSET_URL = 'https://github.com/Zireku/zireku-canvas/releases/download/v1.0.0/AppleColorEmoji.ttf'

if (fs.existsSync(TARGET_FILE)) {
  console.log('[zireku-canvas] AppleColorEmoji.ttf udah tersedia di media/font/. Skip download.')
  process.exit(0)
}

if (!fs.existsSync(FONT_DIR)) {
  fs.mkdirSync(FONT_DIR, { recursive: true })
}

console.log('[zireku-canvas] Mengunduh AppleColorEmoji.ttf (~110 MB) dari GitHub Releases...')

function downloadWithRedirect(url, dest) {
  const file = fs.createWriteStream(dest)

  function get(currentUrl) {
    https.get(currentUrl, (response) => {

      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return get(response.headers.location)
      }

      if (response.statusCode !== 200) {
        console.error(`[zireku-canvas] Gagal mengunduh: status code ${response.statusCode}`)
        fs.unlink(dest, () => {})
        process.exit(1)
      }

      const totalBytes = parseInt(response.headers['content-length'] || '0', 10)
      let downloadedBytes = 0
      let lastReport = 0

      response.on('data', (chunk) => {
        downloadedBytes += chunk.length
        if (totalBytes > 0) {
          const percent = Math.floor((downloadedBytes / totalBytes) * 100)
          if (percent >= lastReport + 10) {
            lastReport = percent
            console.log(`[zireku-canvas] Progress: ${percent}% (${(downloadedBytes / 1024 / 1024).toFixed(1)} MB)`)
          }
        }
      })

      response.pipe(file)

      file.on('finish', () => {
        file.close(() => {
          console.log('[zireku-canvas] AppleColorEmoji.ttf berhasil diunduh dan siap digunakan!')
        })
      })
    }).on('error', (err) => {
      fs.unlink(dest, () => {})
      console.error('[zireku-canvas] Error download:', err.message)
      process.exit(1)
    })
  }

  get(url)
}

downloadWithRedirect(ASSET_URL, TARGET_FILE)
