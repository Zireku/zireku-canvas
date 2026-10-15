import { createCanvas, loadImage, clearAllCache } from '@napi-rs/canvas'
import fs from 'node:fs'
import sharp from 'sharp'
import { registerFonts, queueRender, getAssetPath } from './common.js'

let cachedTemplate = null

async function getTemplateImage(customPath) {
  if (customPath) {
    const buf = await fs.promises.readFile(customPath)
    return await loadImage(buf)
  }
  if (cachedTemplate) return cachedTemplate
  const filePath = getAssetPath('canvas', 'setupgaming', 'template.jpg')
  const buf = await fs.promises.readFile(filePath)
  cachedTemplate = await loadImage(buf)
  return cachedTemplate
}

async function normalizeUserImage(input) {
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
    .resize({ width: 1280, height: 720, fit: 'cover', position: 'center' })
    .jpeg({ quality: 92 })
    .toBuffer()
}

export async function renderSetupGaming(options = {}) {
  registerFonts()
  const {
    screenImage,
    customTemplatePath
  } = options

  if (!screenImage) {
    throw new Error('Parameter "screenImage" (Buffer / URL / FilePath) wajib diisi.')
  }

  return await queueRender(async () => {
    try {
      const templateImg = await getTemplateImage(customTemplatePath)
      const normUserBuf = await normalizeUserImage(screenImage)
      const userImg = await loadImage(normUserBuf)

      const canvas = createCanvas(1080, 1920)
      const ctx = canvas.getContext('2d')

      ctx.drawImage(templateImg, 0, 0, 1080, 1920)

      const TL = { x: -5, y: 439 }
      const TR = { x: 841, y: 531 }
      const BR = { x: 826, y: 1003 }
      const BL = { x: -5, y: 1084 }

      ctx.save()

      const r = 2
      ctx.beginPath()
      ctx.moveTo(TL.x, TL.y)
      ctx.lineTo(TR.x - r, TR.y)
      ctx.arcTo(TR.x, TR.y, TR.x, TR.y + r, r)
      ctx.lineTo(BR.x, BR.y - r)
      ctx.arcTo(BR.x, BR.y, BR.x - r, BR.y, r)
      ctx.lineTo(BL.x, BL.y)
      ctx.lineTo(TL.x, TL.y)
      ctx.closePath()
      ctx.clip()

      const N = 240
      const depthRatio = 1.28

      for (let i = 0; i < N; i++) {
        const t0 = i / N
        const t1 = (i + 1) / N

        const s0 = (t0 * depthRatio) / (1 + (depthRatio - 1) * t0)
        const s1 = (t1 * depthRatio) / (1 + (depthRatio - 1) * t1)

        const sx = s0 * userImg.width
        const sw = Math.max((s1 - s0) * userImg.width, 0.5)

        const xTop0 = (1 - t0) * TL.x + t0 * TR.x
        const xTop1 = (1 - t1) * TL.x + t1 * TR.x
        const xBot0 = (1 - t0) * BL.x + t0 * BR.x
        const xBot1 = (1 - t1) * BL.x + t1 * BR.x

        const dx0 = Math.min(xTop0, xBot0)
        const dx1 = Math.max(xTop1, xBot1)
        const dw = (dx1 - dx0) + 1.2

        const yTop0 = (1 - t0) * TL.y + t0 * TR.y
        const yBot0 = (1 - t0) * BL.y + t0 * BR.y
        const dh = (yBot0 - yTop0) + 1.0

        ctx.drawImage(userImg, sx, 0, sw, userImg.height, dx0, yTop0, dw, dh)
      }

      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      const glowGrad = ctx.createRadialGradient(400, 750, 40, 400, 750, 520)
      glowGrad.addColorStop(0, 'rgba(180, 220, 255, 0.18)')
      glowGrad.addColorStop(0.5, 'rgba(100, 180, 240, 0.09)')
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = glowGrad
      ctx.fillRect(0, 400, 850, 750)
      ctx.restore()

      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      const ambientGrad = ctx.createLinearGradient(841, 531, 0, 1084)
      ambientGrad.addColorStop(0, 'rgba(70, 190, 255, 0.14)')
      ambientGrad.addColorStop(0.4, 'rgba(50, 160, 220, 0.05)')
      ambientGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = ambientGrad
      ctx.fillRect(0, 400, 850, 750)
      ctx.restore()

      ctx.save()
      const vignetteGrad = ctx.createRadialGradient(410, 750, 280, 410, 750, 560)
      vignetteGrad.addColorStop(0, 'rgba(0, 0, 0, 0)')
      vignetteGrad.addColorStop(1, 'rgba(0, 12, 30, 0.14)')
      ctx.fillStyle = vignetteGrad
      ctx.fillRect(0, 400, 850, 750)
      ctx.restore()

      ctx.restore()

      return await canvas.encode('jpeg', 92)
    } finally {
      clearAllCache()
    }
  })
}
