import { createCanvas, loadImage, clearAllCache } from '@napi-rs/canvas'
import { readFile } from 'node:fs/promises'
import { registerFonts, queueRender, normalizeAvatar, getAssetPath } from './common.js'

let cachedTemplateBuffer = null

async function getTemplateImage(customPath) {
  const filePath = customPath || getAssetPath('canvas', 'fakechios', 'template.jpg')
  if (customPath) {
    const buf = await readFile(filePath)
    return await loadImage(buf)
  }
  if (!cachedTemplateBuffer) {
    cachedTemplateBuffer = await readFile(filePath)
  }
  return await loadImage(cachedTemplateBuffer)
}

function formatFollowers(val) {
  if (!val) return '0 pengikut'
  const clean = String(val).trim()
  if (/pengikut/i.test(clean)) return clean
  const numOnly = parseInt(clean.replace(/[^0-9]/g, ''), 10)
  if (isNaN(numOnly)) return `${clean} pengikut`
  if (numOnly >= 1000000) {
    const formatted = (numOnly / 1000000).toFixed(1).replace('.0', '').replace('.', ',')
    return `${formatted} jt pengikut`
  }
  if (numOnly >= 1000) {
    const formatted = (numOnly / 1000).toFixed(1).replace('.0', '').replace('.', ',')
    return `${formatted} rb pengikut`
  }
  return `${numOnly} pengikut`
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

function getFontString(fontSize, style, isTitle = false) {
  let fontStyle = ''
  if (style.italic) fontStyle += 'italic '
  let fontFamily = isTitle ? '"SF Pro Display Bold"' : '"SF Pro Text Regular"'
  if (style.bold && !isTitle) fontFamily = '"SF Pro Display Bold", "SF Pro Text Medium"'
  if (style.mono) fontFamily = 'monospace'
  return `${fontStyle}${fontSize}px ${fontFamily}, "Apple Color Emoji", "Noto Color Emoji", sans-serif`.trim()
}

function layoutFormattedText(ctx, text, maxWidth, fontSize, isTitle = false) {
  const paragraphs = (text || '').split(/\r?\n/)
  const lines = []
  for (const para of paragraphs) {
    const spans = parseMarkdown(para)
    let currentLine = []
    let currentLineWidth = 0
    for (const span of spans) {
      ctx.font = getFontString(fontSize, span, isTitle)
      const tokens = span.text.match(/\S+|\s+/g) || []
      for (const token of tokens) {
        const isSpace = /^\s+$/.test(token)
        let tokenWidth = ctx.measureText(token).width
        if (isSpace && isTitle) {
          tokenWidth = Math.max(tokenWidth, fontSize * 0.28)
        }
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

function renderTokens(ctx, tokens, startX, y, fontSize, defaultColor = '#ffffff', isTitle = false) {
  let curX = startX
  for (const tok of tokens) {
    ctx.font = getFontString(fontSize, tok.style, isTitle)
    ctx.fillStyle = defaultColor
    ctx.fillText(tok.text, curX, y)
    if (tok.style.strike) {
      ctx.save()
      ctx.strokeStyle = defaultColor
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(curX, y - fontSize * 0.3)
      ctx.lineTo(curX + tok.width, y - fontSize * 0.3)
      ctx.stroke()
      ctx.restore()
    }
    curX += tok.width
  }
}

function drawChevron(ctx, x, y, size = 14, color = '#636366') {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(x - size * 0.25, y - size * 0.45)
  ctx.lineTo(x + size * 0.25, y)
  ctx.lineTo(x - size * 0.25, y + size * 0.45)
  ctx.stroke()
  ctx.restore()
}

export async function renderFakeCH(options = {}) {
  registerFonts()
  const {
    avatar,
    channelName = '',
    followers = '0',
    description = '',
    deskripsi = '',
    templatePath
  } = options
  const descText = description || deskripsi || ''

  if (!channelName) {
    throw new Error('Parameter "channelName" wajib diisi.')
  }

  const followerText = formatFollowers(followers)

  return await queueRender(async () => {
    try {
      const templateImg = await getTemplateImage(templatePath)
      const userAvatarBuf = await normalizeAvatar(avatar || getAssetPath('canvas', 'fakechios', 'template.jpg'))
      const userImg = await loadImage(userAvatarBuf)

      const canvas = createCanvas(591, 1280)
      const ctx = canvas.getContext('2d')

      ctx.drawImage(templateImg, 0, 0, 591, 1280)

      const cx = 295.5
      const cy = 262.5
      const r = 84.5

      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.closePath()
      ctx.clip()
      ctx.drawImage(userImg, cx - r, cy - r, r * 2, r * 2)
      ctx.restore()

      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
      ctx.stroke()
      ctx.restore()

      ctx.fillStyle = '#0a0a0a'
      ctx.fillRect(20, 360, 551, 95)

      let titleSize = 36
      let titleLines = layoutFormattedText(ctx, channelName, 520, titleSize, true)
      while (titleLines.length > 2 && titleSize > 24) {
        titleSize -= 2
        titleLines = layoutFormattedText(ctx, channelName, 520, titleSize, true)
      }
      const is2LineTitle = titleLines.length >= 2
      const titleStartY = is2LineTitle ? 385 : 402
      const titleLineHeight = titleSize * 1.15

      ctx.textAlign = 'left'
      for (let i = 0; i < Math.min(2, titleLines.length); i++) {
        const line = titleLines[i]
        const y = titleStartY + i * titleLineHeight
        const startX = 295.5 - line.width / 2
        renderTokens(ctx, line.tokens, startX, y, titleSize, '#ffffff', true)
      }

      const followerY = is2LineTitle ? 445 : 440
      ctx.font = '18px "SF Pro Text Regular", "Apple Color Emoji", "Noto Color Emoji", sans-serif'
      ctx.fillStyle = '#8e8e93'
      ctx.textAlign = 'center'
      ctx.fillText(followerText, 295.5, followerY)

      const fontDescSize = 21.5
      const descLineHeight = 32
      const maxTextWidth = 438
      const descLines = layoutFormattedText(ctx, descText, maxTextWidth, fontDescSize)

      const maxLines = 5
      const hasSeeMore = descLines.length > maxLines
      const actualLines = descLines.slice(0, maxLines)
      const lineCount = Math.max(1, actualLines.length)

      const cardTop = 606
      const startX = 54
      const startY = 645
      const cardBottom = startY + (lineCount - 1) * descLineHeight + 25
      const cardHeight = Math.min(192, cardBottom - cardTop)

      ctx.fillStyle = '#0a0a0a'
      ctx.fillRect(20, 606, 551, 195)

      ctx.save()
      ctx.beginPath()
      ctx.roundRect(23, cardTop, 545, cardHeight, 12)
      ctx.fillStyle = '#171717'
      ctx.fill()
      ctx.restore()

      const chevronY = cardTop + cardHeight / 2
      drawChevron(ctx, 533, chevronY, 14, '#636366')

      ctx.textAlign = 'left'
      if (!hasSeeMore) {
        for (let i = 0; i < lineCount; i++) {
          const y = startY + i * descLineHeight
          renderTokens(ctx, actualLines[i].tokens, startX, y, fontDescSize, '#ffffff')
        }
      } else {
        for (let i = 0; i < lineCount - 1; i++) {
          const y = startY + i * descLineHeight
          renderTokens(ctx, actualLines[i].tokens, startX, y, fontDescSize, '#ffffff')
        }
        const lastLine = actualLines[lineCount - 1]
        const seeMoreText = 'Lihat selengkapnya'
        const seeMorePrefix = '.... '
        ctx.font = getFontString(fontDescSize, { bold: false, italic: false })
        const seeMoreTotalW = ctx.measureText(seeMorePrefix + seeMoreText).width

        let curTokens = []
        let curW = 0
        for (const tok of lastLine.tokens) {
          if (curW + tok.width + seeMoreTotalW <= maxTextWidth) {
            curTokens.push(tok)
            curW += tok.width
          } else {
            let buf = ''
            for (const ch of tok.text) {
              const chW = ctx.measureText(buf + ch).width
              if (curW + chW + seeMoreTotalW <= maxTextWidth) buf += ch
              else break
            }
            if (buf) {
              const w = ctx.measureText(buf).width
              curTokens.push({ text: buf, width: w, style: tok.style })
              curW += w
            }
            break
          }
        }
        const yLast = startY + (lineCount - 1) * descLineHeight
        renderTokens(ctx, curTokens, startX, yLast, fontDescSize, '#ffffff')
        ctx.font = getFontString(fontDescSize, { bold: false, italic: false })
        ctx.fillStyle = '#ffffff'
        ctx.fillText(seeMorePrefix, startX + curW, yLast)
        const prefixW = ctx.measureText(seeMorePrefix).width
        ctx.fillStyle = '#25d366'
        ctx.fillText(seeMoreText, startX + curW + prefixW, yLast)
      }

      return await canvas.encode('png')
    } finally {
      clearAllCache()
    }
  })
}
