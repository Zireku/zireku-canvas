import { createCanvas, loadImage, clearAllCache } from '@napi-rs/canvas'
import fs from 'node:fs'
import sharp from 'sharp'
import { registerFonts, queueRender, getAssetPath } from './common.js'

let cachedCleanTemplate = null

async function normalizeImage(input) {
  if (!input) return null
  let buf = input
  if (typeof input === 'string') {
    if (input.startsWith('http://') || input.startsWith('https://')) {
      const res = await fetch(input)
      buf = Buffer.from(await res.arrayBuffer())
    } else if (fs.existsSync(input)) {
      buf = await fs.promises.readFile(input)
    }
  }
  return await sharp(buf)
    .resize({ width: 1056, height: 528, fit: 'cover' })
    .jpeg({ quality: 90 })
    .toBuffer()
}

function formatPhone(val) {
  if (!val) return ''
  const clean = String(val).replace(/[^\d+]/g, '')
  if (clean.startsWith('+62')) {
    const rest = clean.slice(3)
    return `+62 ${rest.slice(0, 3)} ${rest.slice(3, 7)} ${rest.slice(7)}`.trim()
  }
  if (clean.startsWith('62')) {
    const rest = clean.slice(2)
    return `+62 ${rest.slice(0, 3)} ${rest.slice(3, 7)} ${rest.slice(7)}`.trim()
  }
  if (clean.startsWith('08')) {
    const rest = clean.slice(1)
    return `+62 ${rest.slice(0, 3)} ${rest.slice(3, 7)} ${rest.slice(7)}`.trim()
  }
  return String(val)
}

function formatIg(val) {
  if (!val) return ''
  const trimmed = String(val).trim()
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`
}

function formatPrice(val) {
  if (!val) return 'RP 0'
  const raw = String(val).trim()
  if (/^\d+$/.test(raw)) {
    const formatted = raw.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    return `RP ${formatted}`
  }
  if (/^RP\s*\d+$/i.test(raw)) {
    const num = raw.replace(/[^0-9]/g, '')
    const formatted = num.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    return `RP ${formatted}`
  }
  if (/^RP\s*[\d.]+$/i.test(raw)) {
    const digits = raw.replace(/[^0-9]/g, '')
    const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    return `RP ${formatted}`
  }
  if (/^[\d.]+$/.test(raw)) {
    const digits = raw.replace(/\./g, '')
    const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    return `RP ${formatted}`
  }
  if (/^[\d.,]+$/.test(raw)) {
    const commaParts = raw.split(',')
    if (commaParts.length === 2 && commaParts[1].length <= 2) {
      const digits = commaParts[0].replace(/[^\d]/g, '')
      const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
      return `RP ${formatted},${commaParts[1]}`
    }
    const digits = raw.replace(/[^\d]/g, '')
    const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    return `RP ${formatted}`
  }
  return raw.toUpperCase().startsWith('RP') ? raw.toUpperCase() : `RP ${raw.toUpperCase()}`
}

async function getCleanTemplateImage(customPath) {
  if (customPath) {
    const buf = await fs.promises.readFile(customPath)
    return await loadImage(buf)
  }
  if (cachedCleanTemplate) return cachedCleanTemplate
  const cleanPath = getAssetPath('canvas', 'bikinstokakun', 'template_clean.png')
  if (fs.existsSync(cleanPath)) {
    const buf = await fs.promises.readFile(cleanPath)
    cachedCleanTemplate = await loadImage(buf)
    return cachedCleanTemplate
  }
  const rawPath = getAssetPath('canvas', 'bikinstokakun', 'template.jpg')
  const base = await loadImage(rawPath)
  const canvas = createCanvas(base.width, base.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(base, 0, 0)
  ctx.save()
  ctx.beginPath()
  ctx.rect(186, 435, 522, 258)
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = 'black'
  ctx.fill()
  ctx.restore()
  const cleanBuf = await canvas.encode('png')
  cachedCleanTemplate = await loadImage(cleanBuf)
  return cachedCleanTemplate
}

export async function renderBikinStokAkun(options = {}) {
  registerFonts()
  const {
    accountImage,
    store = 'MY STORE',
    price = '0',
    number = '',
    sosmed = '',
    customTemplatePath
  } = options

  if (!accountImage) {
    throw new Error('Parameter "accountImage" (Buffer / URL / FilePath) wajib diisi.')
  }

  return await queueRender(async () => {
    try {
      const cleanTemplate = await getCleanTemplateImage(customTemplatePath)
      const normBuf = await normalizeImage(accountImage)
      const userImg = await loadImage(normBuf)

      const canvas = createCanvas(cleanTemplate.width, cleanTemplate.height)
      const ctx = canvas.getContext('2d')

      ctx.drawImage(userImg, 183, 432, 528, 264)

      ctx.drawImage(cleanTemplate, 0, 0)

      const storeText = String(store).toUpperCase()
      ctx.save()
      ctx.translate(448, 345)
      ctx.transform(1, 0, -0.16, 1, 0, 0)

      let fontSize = 66
      ctx.font = `${fontSize}px Anton, sans-serif`
      let textWidth = ctx.measureText(storeText).width
      while (textWidth > 400 && fontSize > 26) {
        fontSize -= 2
        ctx.font = `${fontSize}px Anton, sans-serif`
        textWidth = ctx.measureText(storeText).width
      }

      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'

      const extrudeDepth = 9
      for (let d = extrudeDepth; d >= 1; d--) {
        ctx.save()
        ctx.translate(0, d)
        ctx.strokeStyle = '#040e1c'
        ctx.lineWidth = 12
        ctx.strokeText(storeText, 0, 0)
        ctx.fillStyle = d >= 5 ? '#071c36' : '#0d2b52'
        ctx.fillText(storeText, 0, 0)
        ctx.restore()
      }

      ctx.strokeStyle = '#040e1c'
      ctx.lineWidth = 8
      ctx.strokeText(storeText, 0, 0)

      ctx.strokeStyle = '#4dc3ff'
      ctx.lineWidth = 3
      ctx.strokeText(storeText, 0, 0)

      const faceGrad = ctx.createLinearGradient(0, -fontSize / 2, 0, fontSize / 2)
      faceGrad.addColorStop(0, '#ffffff')
      faceGrad.addColorStop(0.55, '#ffffff')
      faceGrad.addColorStop(0.85, '#d6eaff')
      faceGrad.addColorStop(1, '#a8d4ff')
      ctx.fillStyle = faceGrad
      ctx.fillText(storeText, 0, 0)
      ctx.restore()

      const formattedPhone = formatPhone(number)
      const formattedIg = formatIg(sosmed)

      ctx.save()
      ctx.fillStyle = '#0c1e36'
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'left'

      if (formattedPhone) {
        let phoneSize = 17
        ctx.font = `bold ${phoneSize}px "SF Pro Display Bold", "Poppins Bold", sans-serif`
        while (ctx.measureText(formattedPhone).width > 144 && phoneSize > 10) {
          phoneSize -= 0.5
          ctx.font = `bold ${phoneSize}px "SF Pro Display Bold", "Poppins Bold", sans-serif`
        }
        ctx.fillText(formattedPhone, 338, 956)
      }

      if (formattedIg) {
        let igSize = 17
        ctx.font = `bold ${igSize}px "SF Pro Display Bold", "Poppins Bold", sans-serif`
        while (ctx.measureText(formattedIg).width > 165 && igSize > 10) {
          igSize -= 0.5
          ctx.font = `bold ${igSize}px "SF Pro Display Bold", "Poppins Bold", sans-serif`
        }
        ctx.fillText(formattedIg, 530, 956)
      }
      ctx.restore()

      ctx.save()
      ctx.beginPath()
      const bx = 312, by = 724, bw = 272, bh = 62, br = 8
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(bx, by, bw, bh, br)
      } else {
        ctx.rect(bx, by, bw, bh)
      }
      const grad = ctx.createLinearGradient(0, by, 0, by + bh)
      grad.addColorStop(0, '#1a6bd9')
      grad.addColorStop(0.3, '#0e4b9c')
      grad.addColorStop(0.7, '#082c64')
      grad.addColorStop(1, '#041a3d')
      ctx.fillStyle = grad
      ctx.fill()

      const priceText = formatPrice(price)
      ctx.fillStyle = '#ffffff'
      let pSize = 38
      ctx.font = `bold ${pSize}px Anton, sans-serif`
      while (ctx.measureText(priceText).width > 240 && pSize > 18) {
        pSize -= 1
        ctx.font = `bold ${pSize}px Anton, sans-serif`
      }
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'
      ctx.shadowOffsetY = 2
      ctx.shadowBlur = 4
      ctx.fillText(priceText, 448, 755)
      ctx.restore()

      return await canvas.encode('jpeg', 92)
    } finally {
      clearAllCache()
    }
  })
}
