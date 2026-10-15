import { createCanvas, loadImage } from '@napi-rs/canvas'
import { readFile } from 'node:fs/promises'
import { registerFonts, queueRender, normalizeAvatar, getAssetPath } from './common.js'

let cachedAssets = null

async function getAssets() {
  if (cachedAssets) return cachedAssets
  const [topBuf, botBuf, heartBuf, commentBuf, bookmarkBuf, shareBuf] = await Promise.all([
    readFile(getAssetPath('canvas', 'fakettvt', 'top.png')),
    readFile(getAssetPath('canvas', 'fakettvt', 'bottom.png')),
    readFile(getAssetPath('canvas', 'fakettvt', 'heart.png')),
    readFile(getAssetPath('canvas', 'fakettvt', 'comment.png')),
    readFile(getAssetPath('canvas', 'fakettvt', 'bookmark.png')),
    readFile(getAssetPath('canvas', 'fakettvt', 'share.png'))
  ])

  const [topImg, botImg, heartImg, commentImg, bookmarkImg, shareImg] = await Promise.all([
    loadImage(topBuf),
    loadImage(botBuf),
    loadImage(heartBuf),
    loadImage(commentBuf),
    loadImage(bookmarkBuf),
    loadImage(shareBuf)
  ])

  cachedAssets = {
    top: topImg,
    bottom: botImg,
    heart: heartImg,
    comment: commentImg,
    bookmark: bookmarkImg,
    share: shareImg
  }
  return cachedAssets
}

function formatCount(val) {
  if (!val) return '0'
  const str = String(val).trim()
  if (/^[0-9]+$/.test(str)) {
    const num = parseInt(str, 10)
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1).replace('.0', '').replace('.', ',') + 'M'
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace('.0', '').replace('.', ',') + ' rb'
    }
    return String(num)
  }
  return str
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(/\s+/)
  const lines = []
  let currentLine = ''

  for (const word of words) {
    const testLine = currentLine ? currentLine + ' ' + word : word
    const width = ctx.measureText(testLine).width
    if (width <= maxWidth) {
      currentLine = testLine
    } else {
      if (currentLine) lines.push(currentLine)
      currentLine = word
    }
  }
  if (currentLine) lines.push(currentLine)
  return lines
}

function drawPlus(ctx, x, y, r = 15) {
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 4
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = '#FE2C55'
  ctx.fill()

  ctx.strokeStyle = '#FFFFFF'
  ctx.lineWidth = 3.2
  ctx.lineCap = 'round'

  const arm = r * 0.44
  ctx.beginPath()
  ctx.moveTo(x - arm, y)
  ctx.lineTo(x + arm, y)
  ctx.moveTo(x, y - arm)
  ctx.lineTo(x, y + arm)
  ctx.stroke()
  ctx.restore()
}

function drawVinylDisc(ctx, cx, cy, outerR, innerR, img) {
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = 8
  ctx.beginPath()
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2)
  ctx.fillStyle = '#111111'
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 1.2
  for (let r = innerR + 4; r < outerR - 2; r += 3.5) {
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(cx, cy, outerR - 1, 0, Math.PI * 2)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2)
  ctx.clip()
  ctx.drawImage(img, cx - innerR, cy - innerR, innerR * 2, innerR * 2)

  ctx.beginPath()
  ctx.arc(cx, cy, 6, 0, Math.PI * 2)
  ctx.fillStyle = '#111111'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'
  ctx.lineWidth = 1.2
  ctx.stroke()

  ctx.restore()
}

export async function renderFakeTTVT(options = {}) {
  return queueRender(async () => {
    registerFonts()
    const {
      video,
      avatar,
      name = 'TikTok User',
      caption = '',
      likes = '0',
      comments = '0',
      shares = '0',
      bookmarks
    } = options

    const assets = await getAssets()

    let normalizedAvatarBuf = null
    if (avatar) {
      normalizedAvatarBuf = await normalizeAvatar(avatar, 200)
    }

    const [videoImg, avatarImg] = await Promise.all([
      loadImage(video),
      normalizedAvatarBuf ? loadImage(normalizedAvatarBuf) : Promise.resolve(null)
    ])

    const width = 720
    const height = 1600
    const canvas = createCanvas(width, height)
    const ctx = canvas.getContext('2d')

    const vRatio = videoImg.width / videoImg.height
    const cRatio = width / height
    let sWidth, sHeight, sx, sy
    if (vRatio > cRatio) {
      sHeight = videoImg.height
      sWidth = videoImg.height * cRatio
      sx = (videoImg.width - sWidth) / 2
      sy = 0
    } else {
      sWidth = videoImg.width
      sHeight = videoImg.width / cRatio
      sx = 0
      sy = (videoImg.height - sHeight) / 2
    }
    ctx.drawImage(videoImg, sx, sy, sWidth, sHeight, 0, 0, width, height)

    const topGrad = ctx.createLinearGradient(0, 0, 0, 260)
    topGrad.addColorStop(0, 'rgba(0,0,0,0.85)')
    topGrad.addColorStop(0.5, 'rgba(0,0,0,0.4)')
    topGrad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = topGrad
    ctx.fillRect(0, 0, width, 260)

    const bottomGrad = ctx.createLinearGradient(0, 1000, 0, 1460)
    bottomGrad.addColorStop(0, 'rgba(0,0,0,0)')
    bottomGrad.addColorStop(0.4, 'rgba(0,0,0,0.35)')
    bottomGrad.addColorStop(1, 'rgba(0,0,0,0.8)')
    ctx.fillStyle = bottomGrad
    ctx.fillRect(0, 1000, width, 460)

    const rightGrad = ctx.createLinearGradient(580, 0, 720, 0)
    rightGrad.addColorStop(0, 'rgba(0,0,0,0)')
    rightGrad.addColorStop(1, 'rgba(0,0,0,0.4)')
    ctx.fillStyle = rightGrad
    ctx.fillRect(580, 700, 140, 760)

    ctx.drawImage(assets.top, 0, 0, width, 200)
    ctx.drawImage(assets.bottom, 0, height - 140, width, 140)

    const sideX = 659

    const avatarY = 791
    const avatarR = 38
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = 6
    ctx.beginPath()
    ctx.arc(sideX, avatarY, avatarR, 0, Math.PI * 2)
    ctx.fillStyle = '#FFFFFF'
    ctx.fill()
    if (avatarImg) {
      ctx.beginPath()
      ctx.arc(sideX, avatarY, avatarR - 2.5, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(avatarImg, sideX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2)
    }
    ctx.restore()

    drawPlus(ctx, sideX, avatarY + avatarR - 1, 15)

    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.6)'
    ctx.shadowBlur = 6
    ctx.shadowOffsetY = 2

    const heartY = 907
    ctx.drawImage(assets.heart, sideX - assets.heart.width / 2, heartY - assets.heart.height / 2)

    const commentY = 1027
    ctx.drawImage(assets.comment, sideX - assets.comment.width / 2, commentY - assets.comment.height / 2)

    const bookmarkY = 1147
    ctx.drawImage(assets.bookmark, sideX - assets.bookmark.width / 2, bookmarkY - assets.bookmark.height / 2)

    const shareY = 1270
    ctx.drawImage(assets.share, sideX - assets.share.width / 2, shareY - shareImgWidth(assets.share) / 2)
    ctx.restore()

    function shareImgWidth(img) {
      return img.height
    }

    let resolvedBookmarks = bookmarks
    if (!resolvedBookmarks) {
      const parsedLikes = parseInt(String(likes).replace(/[^0-9]/g, ''), 10)
      if (!isNaN(parsedLikes) && parsedLikes > 0) {
        resolvedBookmarks = Math.max(1, Math.round(parsedLikes * 0.12))
      } else {
        resolvedBookmarks = '1.240'
      }
    }

    ctx.save()
    ctx.fillStyle = '#FFFFFF'
    ctx.textAlign = 'center'
    ctx.font = 'bold 22px "SF Pro Display Bold", "SF Pro Display Semibold", "SF Pro", sans-serif'
    ctx.shadowColor = 'rgba(0,0,0,0.7)'
    ctx.shadowBlur = 3.5
    ctx.shadowOffsetY = 1

    ctx.fillText(formatCount(likes), sideX, 966)
    ctx.fillText(formatCount(comments), sideX, 1085)
    ctx.fillText(formatCount(resolvedBookmarks), sideX, 1205)
    ctx.fillText(formatCount(shares), sideX, 1324)
    ctx.restore()

    if (avatarImg) {
      drawVinylDisc(ctx, sideX, 1405, 44, 24, avatarImg)
    }

    const leftX = 26
    const maxTextW = 540

    ctx.save()
    ctx.font = '22px "SF Pro Text Regular", "Noto Color Emoji", "SF Pro", sans-serif'
    const captionLines = wrapText(ctx, caption, maxTextW)

    const audioH = 28
    const captionH = captionLines.length * 30

    let curY = height - 155 - audioH - captionH

    ctx.fillStyle = '#FFFFFF'
    ctx.textAlign = 'left'
    ctx.font = 'bold 26px "SF Pro Display Bold", "SF Pro", sans-serif'
    ctx.shadowColor = 'rgba(0,0,0,0.85)'
    ctx.shadowBlur = 5
    ctx.shadowOffsetY = 1
    ctx.fillText(name, leftX, curY)

    curY += 32

    ctx.font = '22px "SF Pro Text Regular", "Noto Color Emoji", "SF Pro", sans-serif'
    for (const line of captionLines) {
      ctx.fillText(line, leftX, curY)
      curY += 30
    }

    curY += 6

    ctx.font = '19px "SF Pro Text Regular", "Noto Color Emoji", "SF Pro", sans-serif'
    ctx.fillText('suara asli - ' + name, leftX, curY)

    ctx.restore()

    return canvas.toBuffer('image/png')
  })
}
