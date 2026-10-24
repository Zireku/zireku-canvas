import { createCanvas, loadImage, clearAllCache } from '@napi-rs/canvas'
import { readFile, stat } from 'node:fs/promises'
import { registerFonts, queueRender, getAssetPath } from './common.js'

let cachedTemplateBuffer = null
let cachedTemplateMtime = 0

async function getTemplateImage(customPath) {
  let filePath = customPath || getAssetPath('canvas', 'iqs', 'template.jpg')
  if (customPath) {
    const buf = await readFile(filePath)
    return await loadImage(buf)
  }
  const st = await stat(filePath)
  if (!cachedTemplateBuffer || cachedTemplateMtime !== st.mtimeMs) {
    cachedTemplateBuffer = await readFile(filePath)
    cachedTemplateMtime = st.mtimeMs
  }
  return await loadImage(cachedTemplateBuffer)
}

function getCurrentTime() {
  try {
    const now = new Date()
    const str = now.toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
    return str.replace(':', '.')
  } catch {
    const d = new Date()
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${hh}.${mm}`
  }
}

function parseMarkdown(text) {
  function parse(str, style = { bold: false, italic: false, strike: false, mono: false }) {
    const spans = []
    const re = /(```(?!\s)([\s\S]+?)(?<!\s)```)|(\*_(?!\s)([\s\S]+?)(?<!\s)_\*)|(_\*(?!\s)([\s\S]+?)(?<!\s)\*_)|(\*(?!\s)([^*\n]+?)(?<!\s)\*)|(_(?!\s)([^_\n]+?)(?<!\s)_)|(~(?!\s)([^~\n]+?)(?<!\s)~)/g
    let lastIndex = 0
    let match
    while ((match = re.exec(str)) !== null) {
      if (match.index > lastIndex) {
        spans.push({ text: str.slice(lastIndex, match.index), ...style })
      }
      if (match[1]) {
        spans.push({ text: match[2], ...style, mono: true })
      } else if (match[3]) {
        spans.push(...parse(match[4], { ...style, bold: true, italic: true }))
      } else if (match[5]) {
        spans.push(...parse(match[6], { ...style, bold: true, italic: true }))
      } else if (match[7]) {
        spans.push(...parse(match[8], { ...style, bold: true }))
      } else if (match[9]) {
        spans.push(...parse(match[10], { ...style, italic: true }))
      } else if (match[11]) {
        spans.push(...parse(match[12], { ...style, strike: true }))
      }
      lastIndex = re.lastIndex
    }
    if (lastIndex < str.length) {
      spans.push({ text: str.slice(lastIndex), ...style })
    }
    return spans
  }
  return parse(text)
}

function getFontString(fontSize, style) {
  let fontStyle = ''
  if (style.italic) fontStyle += 'italic '
  let fontFamily = '"SF Pro Text Regular"'
  if (style.bold) fontFamily = '"SF Pro Display Bold", "SF Pro Text Medium"'
  if (style.mono) fontFamily = 'monospace'
  return `${fontStyle}${fontSize}px ${fontFamily}, "Apple Color Emoji", "Noto Color Emoji", sans-serif`.trim()
}

function layoutMessage(ctx, text, maxWidth, fontSize = 17.5) {
  const paragraphs = text.split(/\r?\n/)
  const lines = []
  for (const para of paragraphs) {
    const spans = parseMarkdown(para)
    let currentLine = []
    let currentLineWidth = 0
    for (const span of spans) {
      ctx.font = getFontString(fontSize, span)
      const tokens = span.text.match(/\S+|\s+/g) || []
      for (const token of tokens) {
        const isSpace = /^\s+$/.test(token)
        const tokenWidth = ctx.measureText(token).width
        if (isSpace) {
          if (currentLine.length > 0 && currentLineWidth + tokenWidth <= maxWidth) {
            currentLine.push({ text: token, width: tokenWidth, style: span, isSpace: true })
            currentLineWidth += tokenWidth
          }
        } else {
          if (currentLineWidth + tokenWidth <= maxWidth) {
            currentLine.push({ text: token, width: tokenWidth, style: span, isSpace: false })
            currentLineWidth += tokenWidth
          } else {
            if (currentLine.length > 0) {
              while (currentLine.length > 0 && currentLine[currentLine.length - 1].isSpace) {
                currentLineWidth -= currentLine.pop().width
              }
              lines.push({ tokens: currentLine, width: currentLineWidth })
              currentLine = []
              currentLineWidth = 0
            }
            if (tokenWidth <= maxWidth) {
              currentLine.push({ text: token, width: tokenWidth, style: span, isSpace: false })
              currentLineWidth += tokenWidth
            } else {
              let charBuf = ''
              for (const ch of token) {
                const chWidth = ctx.measureText(charBuf + ch).width
                if (chWidth <= maxWidth) {
                  charBuf += ch
                } else {
                  if (charBuf) {
                    const w = ctx.measureText(charBuf).width
                    lines.push({ tokens: [{ text: charBuf, width: w, style: span, isSpace: false }], width: w })
                  }
                  charBuf = ch
                }
              }
              if (charBuf) {
                const w = ctx.measureText(charBuf).width
                currentLine.push({ text: charBuf, width: w, style: span, isSpace: false })
                currentLineWidth = w
              }
            }
          }
        }
      }
    }
    if (currentLine.length > 0) {
      while (currentLine.length > 0 && currentLine[currentLine.length - 1].isSpace) {
        currentLineWidth -= currentLine.pop().width
      }
      lines.push({ tokens: currentLine, width: currentLineWidth })
    } else if (spans.length === 0) {
      lines.push({ tokens: [], width: 0 })
    }
  }
  return lines
}

export async function renderIQS(options = {}) {
  registerFonts()
  const {
    quote = '',
    message = '',
    time = '',
    templatePath
  } = options

  if (!quote || !message) {
    throw new Error('Parameter "quote" dan "message" wajib diisi.')
  }

  const finalTime = time ? time.trim().replace(':', '.') : getCurrentTime()

  return await queueRender(async () => {
    try {
      const templateImg = await getTemplateImage(templatePath)
      const canvas = createCanvas(591, 1280)
      const ctx = canvas.getContext('2d')

      const maxTextWidth = 352
      const fontSize = 17.5
      const lineHeight = 23

      const lines = layoutMessage(ctx, message, maxTextWidth, fontSize)

      ctx.font = '13.5px "SF Pro Text Regular", sans-serif'
      const timeWidth = ctx.measureText(finalTime).width
      const timeGap = 8

      const isSingleLine = lines.length <= 1
      const lastLine = lines.length > 0 ? lines[lines.length - 1] : { width: 0 }
      const timeFitsOnLastLine = (lastLine.width + timeGap + timeWidth) <= maxTextWidth

      const textStartY = isSingleLine && timeFitsOnLastLine ? 575 : 569
      const numLines = Math.max(1, lines.length)
      const lastLineY = textStartY + (numLines - 1) * lineHeight

      let timeY
      let contentBottom
      if (timeFitsOnLastLine) {
        timeY = lastLineY + 1
        contentBottom = lastLineY + 8
      } else {
        timeY = lastLineY + 18
        contentBottom = timeY + 6
      }

      const defaultBubbleBottom = 601
      const requiredBottom = contentBottom + 9
      const rawExtraHeight = Math.max(0, Math.ceil(requiredBottom - defaultBubbleBottom))
      const extraHeight = Math.min(220, rawExtraHeight)

      ctx.drawImage(templateImg, 0, 0, 591, 580, 0, 0, 591, 580)

      if (extraHeight > 0) {
        ctx.drawImage(templateImg, 0, 579, 591, 1, 0, 579, 591, extraHeight + 2)
      }

      const bottomH = 1280 - 580
      ctx.drawImage(templateImg, 0, 580, 591, bottomH, 0, 580 + extraHeight, 591, bottomH)

      const statusTime = finalTime
      ctx.fillStyle = 'rgb(30, 30, 30)'
      ctx.fillRect(40, 22, 68, 26)

      ctx.font = '22px "SF Pro Display Semibold", "SF Pro Display Bold", sans-serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = '#ffffff'
      ctx.fillText(statusTime, 73, 43)

      ctx.font = '18px "SF Pro Text Regular", "Apple Color Emoji", "Noto Color Emoji", sans-serif'
      ctx.textAlign = 'left'
      ctx.fillStyle = '#9ca0a6'

      const maxQuoteWidth = 312
      let qText = quote.replace(/[*_~`]/g, '')
      if (ctx.measureText(qText).width > maxQuoteWidth) {
        while (ctx.measureText(qText + '...').width > maxQuoteWidth && qText.length > 0) {
          qText = qText.slice(0, -1).trim()
        }
        qText += '...'
      }
      ctx.fillText(qText, 76, 524)

      const textStartX = 40
      ctx.textAlign = 'left'
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const y = textStartY + i * lineHeight
        let curX = textStartX
        for (const tok of line.tokens) {
          ctx.font = getFontString(fontSize, tok.style)
          ctx.fillStyle = '#ffffff'
          ctx.fillText(tok.text, curX, y)

          if (tok.style.strike) {
            ctx.save()
            ctx.strokeStyle = '#ffffff'
            ctx.lineWidth = 1.2
            ctx.beginPath()
            ctx.moveTo(curX, y - fontSize * 0.28)
            ctx.lineTo(curX + tok.width, y - fontSize * 0.28)
            ctx.stroke()
            ctx.restore()
          }
          curX += tok.width
        }
      }

      const timeX = 403
      ctx.font = '13.5px "SF Pro Text Regular", sans-serif'
      ctx.fillStyle = '#8e8e93'
      ctx.textAlign = 'right'
      ctx.fillText(finalTime, timeX, timeY)

      return await canvas.encode('png')
    } finally {
      clearAllCache()
    }
  })
}

export const renderIQC = renderIQS
