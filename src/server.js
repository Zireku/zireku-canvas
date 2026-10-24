import http from 'node:http'
import zirekuCanvas from './index.js'

const PORT = process.env.PORT || 3000

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => {
      body += chunk
      if (body.length > 20 * 1024 * 1024) {
        reject(new Error('Payload terlalu besar (maksimal 20MB)'))
      }
    })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch (err) {
        reject(new Error('Format JSON tidak valid'))
      }
    })
    req.on('error', reject)
  })
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    return res.end()
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)

  if (url.pathname === '/' || url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({
      status: 'ok',
      engine: 'zireku-canvas',
      version: '1.0.0',
      uptime: process.uptime()
    }))
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: 'Gunakan HTTP POST untuk memanggil endpoint render canvas.' }))
  }

  try {
    const body = await parseJsonBody(req)

    if (url.pathname === '/api/iqc') {
      const buffer = await zirekuCanvas.renderIQC(body)
      res.writeHead(200, { 'Content-Type': 'image/png' })
      return res.end(buffer)
    }

    if (url.pathname === '/api/iqs') {
      const buffer = await zirekuCanvas.renderIQS(body)
      res.writeHead(200, { 'Content-Type': 'image/png' })
      return res.end(buffer)
    }

    if (url.pathname === '/api/iqontact') {
      const buffer = await zirekuCanvas.renderIQontact(body)
      res.writeHead(200, { 'Content-Type': 'image/png' })
      return res.end(buffer)
    }

    if (url.pathname === '/api/clubquotes') {
      const buffer = await zirekuCanvas.renderClubQuotes(body)
      res.writeHead(200, { 'Content-Type': 'image/jpeg' })
      return res.end(buffer)
    }

    if (url.pathname === '/api/fakech') {
      const buffer = await zirekuCanvas.renderFakeCH(body)
      res.writeHead(200, { 'Content-Type': 'image/png' })
      return res.end(buffer)
    }

    if (url.pathname === '/api/fakegc') {
      const buffer = await zirekuCanvas.renderFakeGC(body)
      res.writeHead(200, { 'Content-Type': 'image/png' })
      return res.end(buffer)
    }

    if (url.pathname === '/api/bikinqris') {
      const buffer = await zirekuCanvas.renderBikinQRIS(body)
      res.writeHead(200, { 'Content-Type': 'image/png' })
      return res.end(buffer)
    }

    if (url.pathname === '/api/bikinstokakun') {
      const buffer = await zirekuCanvas.renderBikinStokAkun(body)
      res.writeHead(200, { 'Content-Type': 'image/jpeg' })
      return res.end(buffer)
    }

    if (url.pathname === '/api/bikintesti') {
      const buffer = await zirekuCanvas.renderBikinTesti(body)
      res.writeHead(200, { 'Content-Type': 'image/png' })
      return res.end(buffer)
    }

    if (url.pathname === '/api/setupgaming') {
      const buffer = await zirekuCanvas.renderSetupGaming(body)
      res.writeHead(200, { 'Content-Type': 'image/jpeg' })
      return res.end(buffer)
    }

    if (url.pathname === '/api/fakettvt') {
      const buffer = await zirekuCanvas.renderFakeTTVT(body)
      res.writeHead(200, { 'Content-Type': 'image/png' })
      return res.end(buffer)
    }

    res.writeHead(404, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: 'Endpoint tidak ditemukan.' }))

  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }))
  }
})

server.listen(PORT, () => {
  console.log(`[zireku-canvas] REST API Server aktif berjalan di http://localhost:${PORT}`)
})
