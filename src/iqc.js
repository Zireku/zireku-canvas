import { createCanvas, loadImage, clearAllCache } from '@napi-rs/canvas'
import { readFile, stat } from 'node:fs/promises'
import { registerFonts, queueRender, getAssetPath } from './common.js'

let cachedTemplateBuffer = null
let cachedTemplateMtime = 0

async function getTemplateImage(customPath) {
  const filePath = customPath || getAssetPath('canvas', 'iqc', 'template.jpg')
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
  if (style.bold) fontFamily = '"SF Pro Display Bold", "SF Pro Display Semibold"'
  if (style.mono) fontFamily = '"Aldrich", "SF Pro", monospace'
  return `${fontStyle}${fontSize}px ${fontFamily}, "Apple Color Emoji", "Noto Color Emoji", sans-serif`.trim()
}

function wrapText(ctx, text, maxWidth, fontSize) {
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
                  if (currentLine.length > 0) lines.push({ spans: currentLine, width: currentLineWidth })
                  currentLine = [{ text: ch, width: chWidth, style: span, isSpace: false }]
                  currentLineWidth = chWidth
                }
              }
            } else {
              if (currentLine.length > 0) lines.push({ spans: currentLine, width: currentLineWidth })
              currentLine = [{ text: token, width: tokenWidth, style: span, isSpace: false }]
              currentLineWidth = tokenWidth
            }
          }
        }
      }
    }
    if (currentLine.length > 0) {
      lines.push({ spans: currentLine, width: currentLineWidth })
    }
  }
  return lines
}

export async function renderIQC(options = {}) {
  registerFonts()
  const rawText = typeof options === 'string' ? options : (options.text || options.message || '')
  const text = rawText.trim()
  if (!text) {
    throw new Error('Parameter "text" wajib diisi.')
  }

  const rawTime = options.time || ''
  const finalTime = rawTime && rawTime.trim() ? rawTime.trim().replace(':', '.') : getCurrentTime()

  return queueRender(async () => {
    try {
      const template = await getTemplateImage(options.templatePath)
      const canvas = createCanvas(template.width, template.height)
      const ctx = canvas.getContext('2d')

      ctx.drawImage(template, 0, 0, template.width, template.height)

      const bubbleX = 42
      const maxBubbleW = 742
      const targetAreaY = 875
      const maxAvailableH = 180
      const maxInnerW = maxBubbleW - 54

      let fontSize = 44.5
      let timeFontSize = 30
      let lines = []
      let lineHeight = 54
      let timeHeight = 36

      while (fontSize >= 18) {
        lineHeight = Math.round(fontSize * 1.22)
        timeFontSize = Math.max(20, Math.round(fontSize * 0.68))
        timeHeight = Math.round(timeFontSize * 1.15)
        lines = wrapText(ctx, text, maxInnerW, fontSize)

        ctx.font = `${timeFontSize}px "SF Pro Text Regular", sans-serif`
        const timeWidth = ctx.measureText(finalTime).width + 24
        const lastLine = lines[lines.length - 1]
        const canInlineTime = lines.length === 1 && (lastLine ? (lastLine.width + timeWidth <= maxInnerW) : true)

        const contentH = canInlineTime
          ? lines.length * lineHeight
          : lines.length * lineHeight + timeHeight

        if (contentH + 34 <= maxAvailableH) {
          break
        }
        fontSize -= 1.5
      }

      ctx.font = `${timeFontSize}px "SF Pro Text Regular", sans-serif`
      const timeWidth = ctx.measureText(finalTime).width
      const lastLine = lines[lines.length - 1]
      const canInlineTime = lines.length === 1 && (lastLine ? (lastLine.width + timeWidth + 24 <= maxInnerW) : true)

      let bubbleW = 0
      if (canInlineTime && lastLine) {
        bubbleW = Math.max(220, Math.min(maxBubbleW, Math.round(lastLine.width + timeWidth + 60)))
      } else {
        let maxLineW = 0
        for (const l of lines) {
          if (l.width > maxLineW) maxLineW = l.width
        }
        bubbleW = Math.max(240, Math.min(maxBubbleW, Math.round(Math.max(maxLineW + 54, timeWidth + 60))))
      }

      const innerH = canInlineTime
        ? lines.length * lineHeight
        : lines.length * lineHeight + timeHeight
      const bubbleH = innerH + 32

      const bubbleY = targetAreaY + Math.max(0, Math.floor((maxAvailableH - bubbleH) / 2))

      ctx.beginPath()
      ctx.roundRect(bubbleX, bubbleY, bubbleW, bubbleH, 34)
      const grad = ctx.createLinearGradient(0, bubbleY, 0, bubbleY + bubbleH)
      grad.addColorStop(0, '#2b2d2c')
      grad.addColorStop(1, '#252726')
      ctx.fillStyle = grad
      ctx.fill()

      const textStartX = bubbleX + 27
      let curY = bubbleY + 16

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        let curX = textStartX
        const baseline = curY + Math.round(fontSize * 0.88)

        for (const span of line.spans) {
          ctx.font = getFontString(fontSize, span.style)
          ctx.fillStyle = '#ffffff'
          ctx.textBaseline = 'alphabetic'
          ctx.fillText(span.text, curX, baseline)

          if (span.style.strike) {
            const spanW = ctx.measureText(span.text).width
            ctx.strokeStyle = '#ffffff'
            ctx.lineWidth = Math.max(1, Math.round(fontSize * 0.07))
            ctx.beginPath()
            ctx.moveTo(curX, baseline - fontSize * 0.3)
            ctx.lineTo(curX + spanW, baseline - fontSize * 0.3)
            ctx.stroke()
          }
          curX += span.width
        }
        curY += lineHeight
      }

      ctx.font = `${timeFontSize}px "SF Pro Text Regular", sans-serif`
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
      ctx.textBaseline = 'alphabetic'

      const timeX = bubbleX + bubbleW - 24 - timeWidth
      if (canInlineTime) {
        const timeBaseline = bubbleY + 16 + Math.round(fontSize * 0.88)
        ctx.fillText(finalTime, timeX, timeBaseline)
      } else {
        const timeBaseline = curY + Math.round(timeFontSize * 0.82)
        ctx.fillText(finalTime, timeX, timeBaseline)
      }

      return await canvas.encode('png')
    } finally {
      clearAllCache()
    }
  })
}
