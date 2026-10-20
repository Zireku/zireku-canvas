import { createCanvas, loadImage } from '@napi-rs/canvas'
import { readFile } from 'node:fs/promises'
import { registerFonts, queueRender, getAssetPath } from './common.js'

let cachedT1 = null
let cachedT2 = null

async function getTemplate(templateNum) {
  if (templateNum === 2) {
    if (!cachedT2) {
      const buf = await readFile(getAssetPath('canvas', 'clubquotes', 'template_2.jpg'))
      cachedT2 = await loadImage(buf)
    }
    return cachedT2
  }
  if (!cachedT1) {
    const buf = await readFile(getAssetPath('canvas', 'clubquotes', 'template_1.jpg'))
    cachedT1 = await loadImage(buf)
  }
  return cachedT1
}

function wrapText(ctx, text, maxWidth) {
  const rawLines = text.split('\n')
  const lines = []

  for (const rawLine of rawLines) {
    const words = rawLine.trim().split(/\s+/)
    let currentLine = ''

    for (const word of words) {
      if (!word) continue
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const metrics = ctx.measureText(testLine)
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine)
        currentLine = word
      } else {
        currentLine = testLine
      }
    }
    if (currentLine) {
      lines.push(currentLine)
    }
  }
  return lines
}

export async function renderClubQuotes(options = {}) {
  return queueRender(async () => {
    registerFonts()
    const {
      text = '',
      template = 1
    } = options

    const tmplNum = Number(template) === 2 ? 2 : 1
    const bg = await getTemplate(tmplNum)

    const canvas = createCanvas(bg.width, bg.height)
    const ctx = canvas.getContext('2d')

    ctx.drawImage(bg, 0, 0)

    let cleanText = String(text || '').trim().toUpperCase()

    if (tmplNum === 2) {
      if (!cleanText.startsWith('"') && !cleanText.endsWith('"')) {
        cleanText = `"${cleanText}"`
      }

      const maxWidth = 580
      let fontSize = 28
      if (cleanText.length > 50) fontSize = 22
      else if (cleanText.length > 30) fontSize = 25

      ctx.font = `${fontSize}px "NK57", "Noto Color Emoji", "NotoColorEmoji", "Android Emoji", sans-serif`
      let lines = wrapText(ctx, cleanText, maxWidth)

      if (lines.length > 3 && fontSize > 20) {
        fontSize = 20
        ctx.font = `${fontSize}px "NK57", "Noto Color Emoji", "NotoColorEmoji", "Android Emoji", sans-serif`
        lines = wrapText(ctx, cleanText, maxWidth)
      }

      const centerY = 785
      const lineHeight = Math.round(fontSize * 1.45)
      const totalHeight = lines.length * lineHeight
      const startY = centerY - totalHeight / 2 + fontSize / 2

      ctx.save()
      ctx.textAlign = 'center'
      ctx.fillStyle = '#FFFFFF'
      ctx.shadowColor = 'rgba(80, 180, 255, 0.95)'
      ctx.shadowBlur = 16

      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], 368, startY + i * lineHeight)
      }
      ctx.restore()
    } else {
      const maxWidth = 740
      let fontSize = 42
      if (cleanText.length > 60) fontSize = 30
      else if (cleanText.length > 40) fontSize = 34
      else if (cleanText.length > 25) fontSize = 38

      ctx.font = `bold ${fontSize}px "SF Pro Display Bold", "Noto Color Emoji", "NotoColorEmoji", "Android Emoji", sans-serif`
      let lines = wrapText(ctx, cleanText, maxWidth)

      if (lines.length > 4 && fontSize > 26) {
        fontSize = 26
        ctx.font = `bold ${fontSize}px "SF Pro Display Bold", "Noto Color Emoji", "NotoColorEmoji", "Android Emoji", sans-serif`
        lines = wrapText(ctx, cleanText, maxWidth)
      }

      const centerY = 880
      const lineHeight = Math.round(fontSize * 1.35)
      const totalHeight = lines.length * lineHeight
      const startY = centerY - totalHeight / 2 + fontSize / 2

      ctx.save()
      ctx.textAlign = 'center'
      ctx.fillStyle = '#FFFFFF'
      ctx.shadowColor = 'rgba(160, 215, 255, 0.85)'
      ctx.shadowBlur = 14

      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], 478, startY + i * lineHeight)
      }
      ctx.restore()
    }

    return canvas.toBuffer('image/png')
  })
}
