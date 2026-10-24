import { createCanvas, loadImage, clearAllCache } from '@napi-rs/canvas'
import { readFile } from 'node:fs/promises'
import { registerFonts, queueRender, getAssetPath } from './common.js'

let cachedTemplateBuffer = null

async function getTemplateImage(customPath) {
  let filePath = customPath || getAssetPath('canvas', 'iqs', 'template.jpg')
  if (customPath) {
    const buf = await readFile(filePath)
    return await loadImage(buf)
  }
  if (!cachedTemplateBuffer) {
    try {
      cachedTemplateBuffer = await readFile(filePath)
    } catch {
      filePath = getAssetPath('canvas', 'iqc', 'template.jpg')
      cachedTemplateBuffer = await readFile(filePath)
    }
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
            if (tokenWidth > maxWidth) {
              for (const ch of token) {
                const chWidth = ctx.measureText(ch).width
                if (currentLineWidth + chWidth <= maxWidth) {
                  currentLine.push({ text: ch, width: chWidth, style: span, isSpace: false })
                  currentLineWidth += chWidth
                } else {
                  if (currentLine.length > 0) lines.push({ tokens: currentLine, width: currentLineWidth })
                  currentLine = [{ text: ch, width: chWidth, style: span, isSpace: false }]
                  currentLineWidth = chWidth
                }
              }
            } else {
              if (currentLine.length > 0) lines.push({ tokens: currentLine, width: currentLineWidth })
              currentLine = [{ text: token, width: tokenWidth, style: span, isSpace: false }]
              currentLineWidth = tokenWidth
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

  const finalTime = time && time.trim() ? time.trim().replace(':', '.') : getCurrentTime()

  return queueRender(async () => {
    try {
      const template = await getTemplateImage(templatePath)
      const canvas = createCanvas(template.width, template.height)
      const ctx = canvas.getContext('2d')

      ctx.drawImage(template, 0, 0, template.width, template.height)

      const quoteX = 184
      const quoteY = 638
      const quoteMaxWidth = 232

      ctx.font = '15.5px "SF Pro Text Regular", "Apple Color Emoji", "Noto Color Emoji", sans-serif'
      ctx.fillStyle = '#8e8e93'
      ctx.textBaseline = 'alphabetic'

      let quoteDisplay = quote
      if (ctx.measureText(quoteDisplay).width > quoteMaxWidth) {
        while (quoteDisplay.length > 0 && ctx.measureText(quoteDisplay + '...').width > quoteMaxWidth) {
          quoteDisplay = quoteDisplay.slice(0, -1)
        }
        quoteDisplay += '...'
      }
      ctx.fillText(quoteDisplay, quoteX, quoteY)

      const textStartX = 175
      const textMaxWidth = 240
      const maxLines = 4

      let fontSize = 17.5
      let lineHeight = 21.5
      let layout = layoutMessage(ctx, message, textMaxWidth, fontSize)

      if (layout.length > maxLines) {
        fontSize = 15.5
        lineHeight = 19.5
        layout = layoutMessage(ctx, message, textMaxWidth, fontSize)
      }
      if (layout.length > maxLines) {
        fontSize = 14
        lineHeight = 17.5
        layout = layoutMessage(ctx, message, textMaxWidth, fontSize)
      }

      if (layout.length > maxLines) {
        layout = layout.slice(0, maxLines)
        const lastLine = layout[maxLines - 1]
        let currentTokens = lastLine.tokens
        let lineStr = currentTokens.map(t => t.text).join('')
        ctx.font = getFontString(fontSize, { bold: false, italic: false })
        while (lineStr.length > 0 && ctx.measureText(lineStr + '...').width > textMaxWidth) {
          lineStr = lineStr.slice(0, -1)
        }
        layout[maxLines - 1] = {
          tokens: [{ text: lineStr + '...', width: ctx.measureText(lineStr + '...').width, style: {} }],
          width: ctx.measureText(lineStr + '...').width
        }
      }

      const count = layout.length
      let startY
      let timeY
      if (count === 1) {
        startY = 673
        timeY = 673
      } else if (count === 2) {
        startY = 665
        timeY = 687
      } else if (count === 3) {
        startY = 660
        timeY = 696
      } else {
        startY = 654
        timeY = 702
      }

      for (let i = 0; i < layout.length; i++) {
        const line = layout[i]
        const y = startY + (i * lineHeight)
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
