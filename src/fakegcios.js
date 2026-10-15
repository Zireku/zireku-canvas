import { createCanvas, loadImage, clearAllCache } from '@napi-rs/canvas'
import { readFile } from 'node:fs/promises'
import { registerFonts, queueRender, normalizeAvatar, getAssetPath } from './common.js'

let cachedTemplateBuffer = null

async function getTemplateImage(customPath) {
  const filePath = customPath || getAssetPath('canvas', 'fakegcios', 'template.jpg')
  if (customPath) {
    const buf = await readFile(filePath)
    return await loadImage(buf)
  }
  if (!cachedTemplateBuffer) {
    cachedTemplateBuffer = await readFile(filePath)
  }
  return await loadImage(cachedTemplateBuffer)
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

export async function renderFakeGC(options = {}) {
  registerFonts()
  const {
    avatar,
    groupName = '',
    memberCount = '100',
    description = '',
    templatePath
  } = options

  if (!groupName) {
    throw new Error('Parameter "groupName" wajib diisi.')
  }

  let cleanNum = String(memberCount).replace(/anggota/i, '').replace(/peserta/i, '').replace(/members?/i, '').trim()
  if (!cleanNum) cleanNum = String(memberCount).trim()
  const memberText = `${cleanNum} anggota`

  return await queueRender(async () => {
    try {
      const templateImg = await getTemplateImage(templatePath)
      const userAvatarBuf = await normalizeAvatar(avatar || getAssetPath('canvas', 'fakegcios', 'template.jpg'))
      const userImg = await loadImage(userAvatarBuf)

      const canvas = createCanvas(591, 1280)
      const ctx = canvas.getContext('2d')

      let titleSize = 36
      let titleLines = layoutFormattedText(ctx, groupName, 520, titleSize, true)
      while (titleLines.length > 2 && titleSize > 24) {
        titleSize -= 2
        titleLines = layoutFormattedText(ctx, groupName, 520, titleSize, true)
      }
      const is2LineTitle = titleLines.length >= 2

      const descFontSize = 17.5
      const descLineHeight = 24
      const maxDescWidth = 500
      const descLines = description ? layoutFormattedText(ctx, description, maxDescWidth, descFontSize) : []
      const hasDesc = descLines.length > 0

      const descStartY = is2LineTitle ? 350 : 340
      const totalDescH = hasDesc ? descLines.length * descLineHeight : 24
      const availableH = 374 - descStartY
      const extraHeight = hasDesc ? Math.max(0, Math.ceil(totalDescH - availableH + 8)) : (is2LineTitle ? 20 : 0)

      ctx.drawImage(templateImg, 0, 0, 591, 370, 0, 0, 591, 370)

      if (extraHeight > 0) {
        ctx.fillStyle = '#0a0a0a'
        ctx.fillRect(0, 370, 591, extraHeight)
      }

      const bottomH = 1280 - 370
      ctx.drawImage(templateImg, 0, 370, 591, bottomH, 0, 370 + extraHeight, 591, bottomH)

      const cx = 295.5
      const cy = 153.5
      const r = 61

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
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
      ctx.stroke()
      ctx.restore()

      ctx.fillStyle = '#0a0a0a'
      ctx.fillRect(20, 236, 551, 130)

      const titleStartY = is2LineTitle ? 256 : 271
      const titleLineHeight = titleSize * 1.15
      ctx.textAlign = 'left'
      for (let i = 0; i < Math.min(2, titleLines.length); i++) {
        const line = titleLines[i]
        const y = titleStartY + i * titleLineHeight
        const startX = 295.5 - line.width / 2
        renderTokens(ctx, line.tokens, startX, y, titleSize, '#ffffff', true)
      }

      const memberY = is2LineTitle ? 320 : 305
      const part1 = 'Grup · '
      const part2 = memberText

      ctx.font = '18px "SF Pro Text Regular", "Apple Color Emoji", "Noto Color Emoji", sans-serif'
      const w1 = ctx.measureText(part1).width
      const w2 = ctx.measureText(part2).width
      const totalW = w1 + w2

      const startXMember = 295.5 - totalW / 2
      ctx.textAlign = 'left'
      ctx.fillStyle = '#8e8e93'
      ctx.fillText(part1, startXMember, memberY)
      ctx.fillStyle = '#25d366'
      ctx.fillText(part2, startXMember + w1, memberY)

      if (!hasDesc) {
        const defaultDescY = is2LineTitle ? 355 : 344
        ctx.font = '18px "SF Pro Text Regular", "Apple Color Emoji", "Noto Color Emoji", sans-serif'
        ctx.textAlign = 'center'
        ctx.fillStyle = '#25d366'
        ctx.fillText('Tambah deskripsi grup', 295.5, defaultDescY)
      } else {
        ctx.textAlign = 'left'
        for (let i = 0; i < descLines.length; i++) {
          const line = descLines[i]
          const y = descStartY + i * descLineHeight
          const startX = 295.5 - line.width / 2
          renderTokens(ctx, line.tokens, startX, y, descFontSize, '#8e8e93')
        }
      }

      return await canvas.encode('png')
    } finally {
      clearAllCache()
    }
  })
}
