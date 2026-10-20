import { createCanvas, loadImage, clearAllCache, GlobalFonts } from '@napi-rs/canvas'
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { registerFonts, queueRender, getAssetPath } from './common.js'

const cachedTemplates = {}
let cachedIconWa = null
let cachedIconSosmed = null
let cachedIconGroup = null

const ensureFonts = () => {
  try {
    const fontDir = getAssetPath('font')
    const poppins = path.join(fontDir, 'Poppins-Bold.ttf')
    if (fs.existsSync(poppins)) {
      GlobalFonts.registerFromPath(poppins, 'Poppins Bold')
      GlobalFonts.registerFromPath(poppins, 'Plus Jakarta Sans')
    }
    const sf = path.join(fontDir, 'SF-Pro-Display-Bold.otf')
    if (fs.existsSync(sf)) {
      GlobalFonts.registerFromPath(sf, 'SF Pro Display Bold')
    }
  } catch (e) {}
}

async function getTemplateImage(choice, customPath) {
  if (customPath) {
    const buf = await fs.promises.readFile(customPath)
    return await loadImage(buf)
  }
  if (cachedTemplates[choice]) return cachedTemplates[choice]
  const filePath = getAssetPath('canvas', 'bikinqris', `template${choice}.jpg`)
  if (fs.existsSync(filePath)) {
    const buf = await fs.promises.readFile(filePath)
    cachedTemplates[choice] = await loadImage(buf)
    return cachedTemplates[choice]
  }
  throw new Error(`Template QRIS ${choice} tidak ditemukan di ${filePath}`)
}

async function getIconWaImage() {
  if (cachedIconWa) return cachedIconWa
  const filePath = getAssetPath('canvas', 'bikinqris', 'icon_wa.jpg')
  const buf = await fs.promises.readFile(filePath)
  cachedIconWa = await loadImage(buf)
  return cachedIconWa
}

async function getIconSosmedImage() {
  if (cachedIconSosmed) return cachedIconSosmed
  const filePath = getAssetPath('canvas', 'bikinqris', 'icon_sosmed.jpg')
  const buf = await fs.promises.readFile(filePath)
  cachedIconSosmed = await loadImage(buf)
  return cachedIconSosmed
}

async function getIconGroupImage() {
  if (cachedIconGroup) return cachedIconGroup
  const filePath = getAssetPath('canvas', 'bikinqris', 'icon_group.png')
  if (fs.existsSync(filePath)) {
    const buf = await fs.promises.readFile(filePath)
    cachedIconGroup = await loadImage(buf)
    return cachedIconGroup
  }
  return await getIconSosmedImage()
}

async function normalizeQris(input, size = 496) {
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
    .resize({ width: size, height: size, fit: 'cover', position: 'center' })
    .png({ quality: 95 })
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

function fitText(ctx, text, maxW = 500, initialSize = 64) {
  let size = initialSize
  ctx.font = `bold ${size}px "Plus Jakarta Sans", "Poppins Bold", sans-serif`
  while (ctx.measureText(text).width > maxW && size > 22) {
    size -= 2
    ctx.font = `bold ${size}px "Plus Jakarta Sans", "Poppins Bold", sans-serif`
  }
  return size
}

function fitBadgeText(ctx, text, maxW = 165, initialSize = 13.5) {
  let size = initialSize
  ctx.font = `bold ${size}px "SF Pro Display Bold", "Poppins Bold", sans-serif`
  while (ctx.measureText(text).width > maxW && size > 9) {
    size -= 0.5
    ctx.font = `bold ${size}px "SF Pro Display Bold", "Poppins Bold", sans-serif`
  }
  return size
}

export async function renderBikinQRIS(options = {}) {
  registerFonts()
  ensureFonts()

  const {
    qrisImage,
    number = '',
    name = '',
    groupAvatar = null,
    template = 1,
    customTemplatePath
  } = options

  if (!qrisImage) {
    throw new Error('Parameter "qrisImage" (Buffer / URL / FilePath) wajib diisi.')
  }

  const templateChoice = parseInt(template, 10) || 1

  return await queueRender(async () => {
    try {
      const templateImg = await getTemplateImage(templateChoice, customTemplatePath)

      if (templateChoice === 1) {
        const [iconWaImg, iconSosmedImg] = await Promise.all([
          getIconWaImage(),
          getIconSosmedImage()
        ])
        const normQrisBuffer = await normalizeQris(qrisImage, 496)
        const qris = await loadImage(normQrisBuffer)

        const canvas = createCanvas(1080, 1350)
        const ctx = canvas.getContext('2d')

        ctx.fillStyle = '#000000'
        ctx.fillRect(0, 0, 1080, 1350)

        ctx.save()
        ctx.translate(540.02, 674.13)
        ctx.scale(0.6, 0.6)
        ctx.drawImage(templateImg, 0, 0, 1792, 2388, -896, -1194, 1792, 2388)
        ctx.restore()

        ctx.save()
        ctx.translate(540, 678)
        roundRect(ctx, -248, -247.5, 496, 495, 16)
        ctx.clip()
        ctx.drawImage(qris, 0, 0, qris.width, qris.height, -248, -247.5, 496, 495)
        ctx.restore()

        if (number) {
          ctx.save()
          ctx.translate(246, 1198)
          ctx.scale(0.31, 0.31)
          fitText(ctx, number, 420, 64)
          ctx.textAlign = 'left'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = '#edeef0'
          ctx.fillText(number, 0, 0)
          ctx.restore()

          ctx.save()
          ctx.translate(222.63, 1197.7)
          ctx.scale(0.03, 0.03)
          ctx.drawImage(iconWaImg, 0, 0, 736, 736, -368, -368, 736, 736)
          ctx.restore()
        }

        if (name) {
          ctx.save()
          ctx.translate(705, 1198)
          ctx.scale(0.31, 0.31)
          fitText(ctx, name, 420, 64)
          ctx.textAlign = 'left'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = '#edeef0'
          ctx.fillText(name, 0, 0)
          ctx.restore()

          ctx.save()
          ctx.translate(680.87, 1196.86)
          ctx.scale(0.04, 0.04)
          ctx.drawImage(iconSosmedImg, 0, 0, 626, 626, -313, -313, 626, 626)
          ctx.restore()
        }

        return await canvas.encode('png')
      }

      if (templateChoice === 2) {
        const [iconWaImg, iconSosmedImg] = await Promise.all([
          getIconWaImage(),
          getIconSosmedImage()
        ])
        const normQrisBuffer = await normalizeQris(qrisImage, 276)
        const qris = await loadImage(normQrisBuffer)

        const canvas = createCanvas(736, 736)
        const ctx = canvas.getContext('2d')

        ctx.drawImage(templateImg, 0, 0, 736, 736)

        ctx.save()
        roundRect(ctx, 412, 228, 276, 276, 8)
        ctx.clip()
        ctx.drawImage(qris, 0, 0, qris.width, qris.height, 412, 228, 276, 276)
        ctx.restore()

        if (number) {
          ctx.save()
          ctx.beginPath()
          ctx.arc(450 + 12, 566 + 12, 12, 0, Math.PI * 2)
          ctx.closePath()
          ctx.clip()
          ctx.drawImage(iconWaImg, 450, 566, 24, 24)
          ctx.restore()

          ctx.textAlign = 'left'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = '#111111'
          fitBadgeText(ctx, number, 165, 13.5)
          ctx.fillText(number, 480, 578)
        }

        if (name) {
          ctx.save()
          ctx.beginPath()
          ctx.arc(450 + 12, 622 + 12, 12, 0, Math.PI * 2)
          ctx.closePath()
          ctx.clip()
          ctx.drawImage(iconSosmedImg, 450, 622, 24, 24)
          ctx.restore()

          ctx.textAlign = 'left'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = '#111111'
          fitBadgeText(ctx, name, 165, 13.5)
          ctx.fillText(name, 480, 634)
        }

        return await canvas.encode('png')
      }

      if (templateChoice === 3) {
        const normQrisBuffer = await normalizeQris(qrisImage, 290)
        const qris = await loadImage(normQrisBuffer)

        const canvas = createCanvas(736, 736)
        const ctx = canvas.getContext('2d')

        ctx.drawImage(templateImg, 0, 0, 736, 736)

        ctx.save()
        roundRect(ctx, 112, 176, 290, 290, 14)
        ctx.clip()
        ctx.drawImage(qris, 0, 0, qris.width, qris.height, 112, 176, 290, 290)
        ctx.restore()

        return await canvas.encode('png')
      }

      if (templateChoice === 4) {
        const [iconWaImg, iconSosmedImg] = await Promise.all([
          getIconWaImage(),
          getIconSosmedImage()
        ])
        const normQrisBuffer = await normalizeQris(qrisImage, 282)
        const qris = await loadImage(normQrisBuffer)

        const canvas = createCanvas(736, 736)
        const ctx = canvas.getContext('2d')

        ctx.drawImage(templateImg, 0, 0, 736, 736)

        const theta = 0.170
        ctx.save()
        ctx.translate(543, 353)
        ctx.rotate(theta)
        const qrSize = 282
        const qx = -qrSize / 2
        const qy = -qrSize / 2
        roundRect(ctx, qx, qy, qrSize, qrSize, 10)
        ctx.clip()
        ctx.drawImage(qris, 0, 0, qris.width, qris.height, qx, qy, qrSize, qrSize)
        ctx.restore()

        if (number || name) {
          ctx.save()
          ctx.translate(510, 567)
          ctx.rotate(theta)

          if (number && name) {
            ctx.save()
            ctx.beginPath()
            ctx.arc(-126 + 9.5, 1, 9.5, 0, Math.PI * 2)
            ctx.closePath()
            ctx.clip()
            ctx.drawImage(iconWaImg, -126, -8.5, 19, 19)
            ctx.restore()

            ctx.textAlign = 'left'
            ctx.textBaseline = 'middle'
            ctx.fillStyle = '#1a1a1a'
            fitBadgeText(ctx, number, 108, 11.5)
            ctx.fillText(number, -102, 1.5)

            ctx.fillStyle = '#ff69b4'
            ctx.beginPath()
            ctx.arc(8, 1.5, 2.5, 0, Math.PI * 2)
            ctx.fill()

            ctx.save()
            ctx.beginPath()
            ctx.arc(17 + 9.5, 1, 9.5, 0, Math.PI * 2)
            ctx.closePath()
            ctx.clip()
            ctx.drawImage(iconSosmedImg, 17, -8.5, 19, 19)
            ctx.restore()

            ctx.textAlign = 'left'
            ctx.textBaseline = 'middle'
            ctx.fillStyle = '#1a1a1a'
            fitBadgeText(ctx, name, 102, 11.5)
            ctx.fillText(name, 40, 1.5)
          } else {
            const singleText = name || number
            const singleIcon = name ? iconSosmedImg : iconWaImg

            ctx.font = `bold 12px "SF Pro Display Bold", "Poppins Bold", sans-serif`
            const textW = ctx.measureText(singleText).width
            const totalW = 19 + 8 + textW
            const startX = -totalW / 2

            ctx.save()
            ctx.beginPath()
            ctx.arc(startX + 9.5, 1, 9.5, 0, Math.PI * 2)
            ctx.closePath()
            ctx.clip()
            ctx.drawImage(singleIcon, startX, -8.5, 19, 19)
            ctx.restore()

            ctx.textAlign = 'left'
            ctx.textBaseline = 'middle'
            ctx.fillStyle = '#1a1a1a'
            fitBadgeText(ctx, singleText, 220, 11.5)
            ctx.fillText(singleText, startX + 26, 1.5)
          }
          ctx.restore()
        }

        return await canvas.encode('png')
      }

      if (templateChoice === 5) {
        const [iconWaImg, defaultGroupIconImg] = await Promise.all([
          getIconWaImage(),
          getIconGroupImage()
        ])

        let groupAvatarImg = null
        if (groupAvatar) {
          try {
            let buf = groupAvatar
            if (typeof groupAvatar === 'string') {
              if (groupAvatar.startsWith('http://') || groupAvatar.startsWith('https://')) {
                const res = await fetch(groupAvatar)
                buf = Buffer.from(await res.arrayBuffer())
              } else if (fs.existsSync(groupAvatar)) {
                buf = await fs.promises.readFile(groupAvatar)
              }
            }
            const avatarPng = await sharp(buf)
              .resize(88, 88, { fit: 'cover' })
              .png()
              .toBuffer()
            groupAvatarImg = await loadImage(avatarPng)
          } catch (e) {
            groupAvatarImg = null
          }
        }
        const finalGroupIcon = groupAvatarImg || defaultGroupIconImg

        const normQrisBuffer = await normalizeQris(qrisImage, 477)
        const qris = await loadImage(normQrisBuffer)

        const canvas = createCanvas(1307, 735)
        const ctx = canvas.getContext('2d')

        ctx.drawImage(templateImg, 0, 0, 1307, 735)

        const qx = 38
        const qy = 224
        const qw = 477
        const qh = 477
        const qrRadius = 24

        ctx.save()
        roundRect(ctx, qx, qy, qw, qh, qrRadius)
        ctx.clip()
        ctx.drawImage(qris, qx, qy, qw, qh)
        ctx.restore()

        const iconSize = 44
        const groupIconX = 932
        const topCenterY = 571
        const groupIconY = Math.round(topCenterY - iconSize / 2)

        if (name) {
          ctx.save()
          ctx.beginPath()
          ctx.arc(groupIconX + iconSize / 2, groupIconY + iconSize / 2, iconSize / 2, 0, Math.PI * 2)
          ctx.closePath()
          ctx.clip()
          ctx.drawImage(finalGroupIcon, groupIconX, groupIconY, iconSize, iconSize)
          ctx.restore()

          ctx.textAlign = 'left'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = '#111111'
          fitBadgeText(ctx, name, 285, 22)
          ctx.fillText(name, 988, topCenterY)
        }

        const waIconX = 932
        const bottomCenterY = 682
        const waIconY = Math.round(bottomCenterY - iconSize / 2)

        if (number) {
          ctx.save()
          ctx.beginPath()
          ctx.arc(waIconX + iconSize / 2, waIconY + iconSize / 2, iconSize / 2, 0, Math.PI * 2)
          ctx.closePath()
          ctx.clip()
          ctx.drawImage(iconWaImg, waIconX, waIconY, iconSize, iconSize)
          ctx.restore()

          ctx.textAlign = 'left'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = '#111111'
          fitBadgeText(ctx, number, 285, 22)
          ctx.fillText(number, 988, bottomCenterY)
        }

        return await canvas.encode('png')
      }

      throw new Error(`Pilihan template ${templateChoice} tidak valid (pilih 1, 2, 3, 4, atau 5).`)
    } finally {
      clearAllCache()
    }
  })
}
