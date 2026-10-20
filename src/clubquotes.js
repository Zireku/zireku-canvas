import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'
import { readFile } from 'node:fs/promises'
import fs from 'node:fs'
import path from 'node:path'
import { registerFonts, queueRender, getAssetPath } from './common.js'

let cachedT1 = null
let cachedT2 = null

function ensureFonts() {
  try {
    const roboto = getAssetPath('font', 'RobotoCondensed-Bold.ttf')
    if (fs.existsSync(roboto)) {
      GlobalFonts.registerFromPath(roboto, 'Roboto Condensed Bold')
    }
    const aldrich = getAssetPath('font', 'Aldrich-Regular.ttf')
    if (fs.existsSync(aldrich)) {
      GlobalFonts.registerFromPath(aldrich, 'Aldrich')
    }
  } catch (e) {}
}

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
    ensureFonts()

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
      const maxWidth = 590

      let fontSize = 32
      if (cleanText.length > 60) fontSize = 24
      else if (cleanText.length > 40) fontSize = 28

      ctx.font = `bold ${fontSize}px "Aldrich", "NK57", Arial, sans-serif, "Noto Color Emoji"`
      ctx.letterSpacing = '1.5px'

      let lines = wrapText(ctx, cleanText, maxWidth)

      if (lines.length > 3 && fontSize > 24) {
        fontSize = 24
        ctx.font = `bold ${fontSize}px "Aldrich", "NK57", Arial, sans-serif, "Noto Color Emoji"`
        lines = wrapText(ctx, cleanText, maxWidth)
      }

      if (!hasQuotes && lines.length > 0) {
        lines[0] = `“ ${lines[0]}`
        lines[lines.length - 1] = `${lines[lines.length - 1]} ”`
      }

      const lineHeight = Math.round(fontSize * 1.45)
      const totalHeight = lines.length * lineHeight
      const startY = -totalHeight / 2 + fontSize / 2

      ctx.save()
      ctx.translate(372, 762)
      ctx.rotate((-4.65 * Math.PI) / 180)

      ctx.textAlign = 'center'
      ctx.fillStyle = '#FFFFFF'
      ctx.shadowColor = 'rgba(80, 180, 255, 0.95)'
      ctx.shadowBlur = 18
      ctx.font = `bold ${fontSize}px "Aldrich", "NK57", Arial, sans-serif, "Noto Color Emoji"`
      ctx.letterSpacing = '1.5px'

      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], 0, startY + i * lineHeight)
      }
      ctx.restore()
    } else {
      const maxWidth = 780

      let fontSize = 52
      if (cleanText.length > 70) fontSize = 32
      else if (cleanText.length > 45) fontSize = 38
      else if (cleanText.length > 25) fontSize = 44

      ctx.font = `bold ${fontSize}px "Roboto Condensed Bold", "SF Pro Display Bold", Arial, sans-serif, "Noto Color Emoji"`
      let lines = wrapText(ctx, cleanText, maxWidth)

      if (lines.length > 3 && fontSize > 32) {
        fontSize = 32
        ctx.font = `bold ${fontSize}px "Roboto Condensed Bold", "SF Pro Display Bold", Arial, sans-serif, "Noto Color Emoji"`
        lines = wrapText(ctx, cleanText, maxWidth)
      }

      const lineHeight = Math.round(fontSize * 1.25)
      const totalHeight = lines.length * lineHeight
      const startY = -totalHeight / 2 + fontSize / 2

      ctx.save()
      ctx.translate(500, 855)
      ctx.rotate((2.85 * Math.PI) / 180)

      ctx.textAlign = 'center'
      ctx.fillStyle = '#FFFFFF'
      ctx.shadowColor = 'rgba(160, 215, 255, 0.9)'
      ctx.shadowBlur = 16
      ctx.font = `bold ${fontSize}px "Roboto Condensed Bold", "SF Pro Display Bold", Arial, sans-serif, "Noto Color Emoji"`

      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], 0, startY + i * lineHeight)
      }
      ctx.restore()
    }

    return canvas.toBuffer('image/png')
  })
}
