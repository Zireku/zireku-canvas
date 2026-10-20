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
      const hasQuotes = cleanText.startsWith('“') || cleanText.startsWith('"')
      const maxWidth = 560

      let fontSize = 40
      if (cleanText.length > 65) fontSize = 24
      else if (cleanText.length > 45) fontSize = 28
      else if (cleanText.length > 25) fontSize = 34

      ctx.font = `bold ${fontSize}px "Aldrich", "Noto Color Emoji", "NotoColorEmoji", "Android Emoji", sans-serif`
      ctx.letterSpacing = '1.5px'

      let lines = wrapText(ctx, cleanText, maxWidth)

      if (lines.length > 3 && fontSize > 24) {
        fontSize = 24
        ctx.font = `bold ${fontSize}px "Aldrich", "Noto Color Emoji", "NotoColorEmoji", "Android Emoji", sans-serif`
        lines = wrapText(ctx, cleanText, maxWidth)
      }

      if (!hasQuotes && lines.length > 0) {
        lines[0] = `“ ${lines[0]}`
        lines[lines.length - 1] = `${lines[lines.length - 1]} ”`
      }

      const centerY = 785
      const lineHeight = Math.round(fontSize * 1.45)
      const totalHeight = lines.length * lineHeight
      const startY = centerY - totalHeight / 2 + fontSize / 2

      ctx.save()
      ctx.textAlign = 'center'
      ctx.fillStyle = '#FFFFFF'
      ctx.shadowColor = 'rgba(80, 180, 255, 0.95)'
      ctx.shadowBlur = 18
      ctx.font = `bold ${fontSize}px "Aldrich", "Noto Color Emoji", "NotoColorEmoji", "Android Emoji", sans-serif`
      ctx.letterSpacing = '1.5px'

      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], 368, startY + i * lineHeight)
      }
      ctx.restore()
    } else {
      const maxWidth = 760

      let fontSize = 58
      if (cleanText.length > 65) fontSize = 32
      else if (cleanText.length > 45) fontSize = 40
      else if (cleanText.length > 25) fontSize = 48

      ctx.font = `bold ${fontSize}px "Roboto Condensed Bold", "Noto Color Emoji", "NotoColorEmoji", "Android Emoji", sans-serif`
      let lines = wrapText(ctx, cleanText, maxWidth)

      if (lines.length > 4 && fontSize > 32) {
        fontSize = 32
        ctx.font = `bold ${fontSize}px "Roboto Condensed Bold", "Noto Color Emoji", "NotoColorEmoji", "Android Emoji", sans-serif`
        lines = wrapText(ctx, cleanText, maxWidth)
      }

      const centerY = 880
      const lineHeight = Math.round(fontSize * 1.3)
      const totalHeight = lines.length * lineHeight
      const startY = centerY - totalHeight / 2 + fontSize / 2

      ctx.save()
      ctx.textAlign = 'center'
      ctx.fillStyle = '#FFFFFF'
      ctx.shadowColor = 'rgba(160, 215, 255, 0.85)'
      ctx.shadowBlur = 15
      ctx.font = `bold ${fontSize}px "Roboto Condensed Bold", "Noto Color Emoji", "NotoColorEmoji", "Android Emoji", sans-serif`

      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], 478, startY + i * lineHeight)
      }
      ctx.restore()
    }

    return canvas.toBuffer('image/png')
  })
}
