import { createCanvas, loadImage, clearAllCache } from '@napi-rs/canvas'
import fs from 'node:fs'
import sharp from 'sharp'
import { registerFonts, queueRender, getAssetPath } from './common.js'

let cachedTemplate1 = null
let cachedTemplate2 = null

async function getTemplateImage(choice, customPath) {
  if (customPath) {
    const buf = await fs.promises.readFile(customPath)
    return await loadImage(buf)
  }
  if (choice === 2) {
    if (cachedTemplate2) return cachedTemplate2
    const filePath = getAssetPath('canvas', 'bikintesti', 'template2.jpg')
    const buf = await fs.promises.readFile(filePath)
    cachedTemplate2 = await loadImage(buf)
    return cachedTemplate2
  }
  if (cachedTemplate1) return cachedTemplate1
  const filePath = getAssetPath('canvas', 'bikintesti', 'template1.jpg')
  const buf = await fs.promises.readFile(filePath)
  cachedTemplate1 = await loadImage(buf)
  return cachedTemplate1
}

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
    .resize({ width: 720, height: 1280, fit: 'cover' })
    .jpeg({ quality: 88 })
    .toBuffer()
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function chamferRect(ctx, x, y, w, h, c) {
  ctx.beginPath()
  ctx.moveTo(x + c, y)
  ctx.lineTo(x + w - c, y)
  ctx.lineTo(x + w, y + c)
  ctx.lineTo(x + w, y + h - c)
  ctx.lineTo(x + w - c, y + h)
  ctx.lineTo(x + c, y + h)
  ctx.lineTo(x, y + h - c)
  ctx.lineTo(x, y + c)
  ctx.closePath()
}

function fitText(ctx, text, maxW = 500, initialSize = 64) {
  let size = initialSize
  ctx.font = `bold ${size}px "Plus Jakarta Sans", "Poppins Bold", sans-serif`
  while (ctx.measureText(text).width > maxW && size > 22) {
    size -= 2
    ctx.font = `bold ${size}px "Plus Jakarta Sans", "Poppins Bold", sans-serif`
  }
  return size
}

export async function renderBikinTesti(options = {}) {
  registerFonts()
  const {
    image1,
    image2,
    number = '',
    name = '',
    template = 1,
    customTemplatePath
  } = options

  if (!image1 || !image2) {
    throw new Error('Parameter "image1" dan "image2" (Buffer / URL / FilePath) wajib diisi.')
  }

  const templateChoice = parseInt(template, 10) === 2 ? 2 : 1

  return await queueRender(async () => {
    try {
      const templateImg = await getTemplateImage(templateChoice, customTemplatePath)
      const [normBuf1, normBuf2] = await Promise.all([
        normalizeImage(image1),
        normalizeImage(image2)
      ])

      const imgLeft = await loadImage(normBuf1)
      const imgRight = await loadImage(normBuf2)

      const canvas = createCanvas(1080, 1350)
      const ctx = canvas.getContext('2d')

      if (templateChoice === 2) {

        ctx.fillStyle = '#000000'
        ctx.fillRect(0, 0, 1080, 1350)

        ctx.save()
        ctx.translate(542.14, 677.12)
        ctx.scale(0.6, 0.6)
        ctx.drawImage(templateImg, 0, 0, 1792, 2400, -896, -1200, 1792, 2400)
        ctx.restore()

        if (number) {
          ctx.save()
          ctx.translate(658, 1198)
          ctx.scale(0.31, 0.31)
          fitText(ctx, number, 450, 64)
          ctx.textAlign = 'left'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = '#08090b'
          ctx.fillText(number, 0, 0)
          ctx.restore()
        }

        if (name) {
          ctx.save()
          ctx.translate(325, 1198)
          ctx.scale(0.31, 0.31)
          fitText(ctx, name, 450, 64)
          ctx.textAlign = 'left'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = '#08090b'
          ctx.fillText(name, 0, 0)
          ctx.restore()
        }

        ctx.save()
        ctx.translate(540, 1132)
        ctx.scale(0.22, 0.22)
        ctx.font = 'bold 64px "Plus Jakarta Sans"'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = '#08090b'
        ctx.fillText('zireku.com', 0, 0)
        ctx.restore()

        ctx.save()
        ctx.translate(359.0, 762.5)
        roundRect(ctx, -172, -291.5, 344, 583, 18)
        ctx.clip()
        ctx.drawImage(imgLeft, 0, 0, imgLeft.width, imgLeft.height, -172, -291.5, 344, 583)
        ctx.restore()

        ctx.save()
        ctx.translate(724.5, 762.5)
        roundRect(ctx, -172, -291.5, 344, 583, 18)
        ctx.clip()
        ctx.drawImage(imgRight, 0, 0, imgRight.width, imgRight.height, -172, -291.5, 344, 583)
        ctx.restore()

      } else {

        ctx.fillStyle = '#0f1113'
        ctx.fillRect(0, 0, 1080, 1350)

        ctx.save()
        ctx.translate(540, 675)
        ctx.scale(0.59, 0.59)
        ctx.drawImage(templateImg, 0, 0, 1856, 2304, -928, -1152, 1856, 2304)
        ctx.restore()

        ctx.save()
        ctx.translate(358.5, 753.5)
        chamferRect(ctx, -168, -283, 336, 566, 14)
        ctx.clip()
        ctx.drawImage(imgLeft, 0, 0, imgLeft.width, imgLeft.height, -168, -283, 336, 566)
        ctx.restore()

        ctx.save()
        ctx.translate(720.5, 753.5)
        chamferRect(ctx, -168, -283, 336, 566, 14)
        ctx.clip()
        ctx.drawImage(imgRight, 0, 0, imgRight.width, imgRight.height, -168, -283, 336, 566)
        ctx.restore()

        if (number) {
          ctx.save()
          ctx.translate(270, 1195)
          ctx.scale(0.28, 0.28)
          fitText(ctx, number, 320, 64)
          ctx.textAlign = 'left'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = '#edeef0'
          ctx.fillText(number, 0, 0)
          ctx.restore()
        }

        if (name) {
          ctx.save()
          ctx.translate(764, 1195)
          ctx.scale(0.28, 0.28)
          fitText(ctx, name, 270, 64)
          ctx.textAlign = 'left'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = '#edeef0'
          ctx.fillText(name, 0, 0)
          ctx.restore()
        }
      }

      return await canvas.encode('png')
    } finally {
      clearAllCache()
    }
  })
}
