import { createCanvas, loadImage, clearAllCache } from '@napi-rs/canvas'
import { readFile, stat } from 'node:fs/promises'
import { registerFonts, queueRender, normalizeAvatar, getAssetPath } from './common.js'

let cachedTemplateBuffer = null
let cachedTemplateMtime = 0

async function getTemplateImage(customPath) {
  const filePath = customPath || getAssetPath('canvas', 'iqontact', 'template.jpg')
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

function getFontString(fontSize, style, isTitle = false) {
  let fontStyle = ''
  if (style.italic) fontStyle += 'italic '
  let fontFamily = isTitle ? '"SF Pro Display Bold"' : '"SF Pro Text Regular"'
  if (style.bold && !isTitle) fontFamily = '"SF Pro Display Bold", "SF Pro Text Medium"'
  if (style.mono) fontFamily = 'monospace'
  return `${fontStyle}${fontSize}px ${fontFamily}, "Apple Color Emoji", "Noto Color Emoji", sans-serif`.trim()
}

function formatPhoneNumber(num) {
  if (!num) return ''
  let str = String(num).trim()
  if (str.startsWith('+')) return str
  if (str.startsWith('62')) return `+${str.slice(0, 2)} ${str.slice(2, 5)}-${str.slice(5, 9)}-${str.slice(9)}`
  if (str.startsWith('08')) return `+62 ${str.slice(1, 4)}-${str.slice(4, 8)}-${str.slice(8)}`
  return str
}

export async function renderIQontact(options = {}) {
  registerFonts()
  const rawName = typeof options === 'string' ? options : (options.name || options.contact || '')
  const name = rawName.trim()
  if (!name) {
    throw new Error('Parameter "name" wajib diisi.')
  }

  const rawNumber = options.number || options.nomor || ''
  const number = formatPhoneNumber(rawNumber)
  const rawTime = options.time || ''
  const finalTime = (rawTime && rawTime.trim() ? rawTime.trim() : getCurrentTime()).replace(':', '.')

  return queueRender(async () => {
    try {
      const template = await getTemplateImage(options.templatePath)
      const canvas = createCanvas(1080, 2338)
      const ctx = canvas.getContext('2d')

      ctx.drawImage(template, 0, 0, 1080, 2338)

      if (options.avatar) {
        try {
          const avatarBuf = await normalizeAvatar(options.avatar)
          const avatarImg = await loadImage(avatarBuf)
          const cx = 540
          const cy = 480
          const r = 156

          ctx.save()
          ctx.beginPath()
          ctx.arc(cx, cy, r, 0, Math.PI * 2)
          ctx.closePath()
          ctx.clip()
          ctx.drawImage(avatarImg, cx - r, cy - r, r * 2, r * 2)
          ctx.restore()
        } catch {}
      }

      ctx.fillStyle = '#ffffff'
      ctx.font = '37px "SF Pro Display Semibold", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(finalTime, 133, 76)

      const maxNameWidth = 920
      let nameFontSize = 73
      const nameSpans = parseMarkdown(name)

      function measureSpans(spans, size) {
        let w = 0
        for (const span of spans) {
          ctx.font = getFontString(size, span, true)
          w += ctx.measureText(span.text).width
        }
        return w
      }

      while (nameFontSize > 32 && measureSpans(nameSpans, nameFontSize) > maxNameWidth) {
        nameFontSize -= 2
      }

      const totalNameW = measureSpans(nameSpans, nameFontSize)
      let curX = 540 - (totalNameW / 2)
      const nameBaseline = 737

      ctx.textAlign = 'left'
      for (const span of nameSpans) {
        ctx.font = getFontString(nameFontSize, span, true)
        ctx.fillStyle = '#ffffff'
        ctx.fillText(span.text, curX, nameBaseline)
        if (span.strike) {
          const sw = ctx.measureText(span.text).width
          ctx.save()
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 2.5
          ctx.beginPath()
          ctx.moveTo(curX, nameBaseline - nameFontSize * 0.3)
          ctx.lineTo(curX + sw, nameBaseline - nameFontSize * 0.3)
          ctx.stroke()
          ctx.restore()
        }
        curX += ctx.measureText(span.text).width
      }

      if (number) {
        let numFontSize = 43
        ctx.font = `${numFontSize}px "SF Pro Text Regular", sans-serif`
        while (numFontSize > 24 && ctx.measureText(number).width > maxNameWidth) {
          numFontSize -= 1.5
          ctx.font = `${numFontSize}px "SF Pro Text Regular", sans-serif`
        }
        ctx.fillStyle = '#8e8e93'
        ctx.textAlign = 'center'
        ctx.fillText(number, 540, 807)
      }

      return await canvas.encode('png')
    } finally {
      clearAllCache()
    }
  })
}
