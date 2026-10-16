import { GlobalFonts } from '@napi-rs/canvas'
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const ROOT_DIR = path.resolve(__dirname, '..')

export function getAssetPath(...segments) {
  return path.join(ROOT_DIR, 'media', ...segments)
}

export function registerFonts() {
  const fontMappings = [
    { file: 'SF-Pro-Display-Bold.otf', name: 'SF Pro Display Bold' },
    { file: 'SF-Pro-Display-Semibold.otf', name: 'SF Pro Display Semibold' },
    { file: 'SF-Pro-Display-Medium.otf', name: 'SF Pro Display Medium' },
    { file: 'SF-Pro-Text-Regular.otf', name: 'SF Pro Text Regular' },
    { file: 'SF-Pro-Text-Medium.otf', name: 'SF Pro Text Medium' },
    { file: 'SF-Pro.ttf', name: 'SF Pro' },
    { file: 'AppleColorEmoji.ttf', name: 'Apple Color Emoji' },
    { file: 'NotoColorEmoji.ttf', name: 'Noto Color Emoji' },
    { file: 'NotoColorEmoji.ttf', name: 'NotoColorEmoji' },
    { file: 'NotoColorEmoji.ttf', name: 'Android Emoji' },
    { file: 'Poppins-Bold.ttf', name: 'Poppins Bold' },
    { file: 'Poppins-Bold.ttf', name: 'Plus Jakarta Sans' },
    { file: 'Poppins-Medium.ttf', name: 'Poppins Medium' },
    { file: 'Poppins-Regular.ttf', name: 'Poppins Regular' },
    { file: 'Poppins-SemiBold.ttf', name: 'Poppins SemiBold' },
    { file: 'Anton-Regular.ttf', name: 'Anton' },
    { file: 'GreatVibes-Regular.ttf', name: 'Great Vibes' },
    { file: 'bebasneue.ttf', name: 'Bebas Neue' },
    { file: 'ihatcs.ttf', name: 'I Hate CS' },
    { file: 'nk57.otf', name: 'NK57' },
    { file: 'truestory.ttf', name: 'True Story' }
  ]

  for (const item of fontMappings) {
    const fullPath = getAssetPath('font', item.file)
    if (fs.existsSync(fullPath)) {
      try {
        GlobalFonts.registerFromPath(fullPath, item.name)
      } catch (err) {

      }
    }
  }

  const systemNoto = '/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf'
  if (fs.existsSync(systemNoto)) {
    try {
      GlobalFonts.registerFromPath(systemNoto, 'Noto Color Emoji')
      GlobalFonts.registerFromPath(systemNoto, 'NotoColorEmoji')
      GlobalFonts.registerFromPath(systemNoto, 'Android Emoji')
    } catch (e) {}
  }
}

let renderQueue = Promise.resolve()
export function queueRender(task) {
  const next = renderQueue.then(task, task)
  renderQueue = next.catch(() => {})
  return next
}

export async function normalizeAvatar(input, size = 300) {
  if (!input) return null
  let buf = input
  if (typeof input === 'string') {
    if (input.startsWith('http://') || input.startsWith('https://')) {
      const res = await fetch(input)
      buf = Buffer.from(await res.arrayBuffer())
    } else if (input.startsWith('data:image/')) {
      const b64 = input.split(',')[1] || ''
      buf = Buffer.from(b64, 'base64')
    } else if (/^[A-Za-z0-9+/=\s]{100,}$/.test(input.trim())) {
      buf = Buffer.from(input.trim().replace(/\s+/g, ''), 'base64')
    } else if (fs.existsSync(input)) {
      buf = await fs.promises.readFile(input)
    }
  }
  return await sharp(buf)
    .resize({ width: size, height: size, fit: 'cover', position: 'center' })
    .png({ quality: 95 })
    .toBuffer()
}

export function tokenizeMarkdown(text) {
  if (!text) return []
  const tokens = []
  let pos = 0
  const len = text.length

  while (pos < len) {
    const nextAst = text.indexOf('*', pos)
    const nextUnd = text.indexOf('_', pos)
    const nextTld = text.indexOf('~', pos)

    const candidates = [
      { type: 'bold', index: nextAst, char: '*' },
      { type: 'italic', index: nextUnd, char: '_' },
      { type: 'strike', index: nextTld, char: '~' }
    ].filter(c => c.index !== -1).sort((a, b) => a.index - b.index)

    if (candidates.length === 0) {
      tokens.push({ text: text.slice(pos), bold: false, italic: false, strike: false })
      break
    }

    const first = candidates[0]
    if (first.index > pos) {
      tokens.push({ text: text.slice(pos, first.index), bold: false, italic: false, strike: false })
      pos = first.index
    }

    const closeIdx = text.indexOf(first.char, pos + 1)
    if (closeIdx === -1) {
      tokens.push({ text: text.slice(pos), bold: false, italic: false, strike: false })
      break
    }

    const innerContent = text.slice(pos + 1, closeIdx)
    tokens.push({
      text: innerContent,
      bold: first.type === 'bold',
      italic: first.type === 'italic',
      strike: first.type === 'strike'
    })
    pos = closeIdx + 1
  }

  return tokens.filter(t => t.text.length > 0)
}

export function measureTokens(ctx, tokens, fontSize, fontType = 'Text') {
  let w = 0
  for (const tok of tokens) {
    ctx.font = getFontString(fontSize, tok, fontType)
    w += ctx.measureText(tok.text).width
  }
  return w
}

export function getFontString(size, style = {}, fontType = 'Text') {
  const isBold = Boolean(style.bold)
  const isItalic = Boolean(style.italic)
  let baseFamily = fontType === 'Display' ? 'SF Pro Display' : 'SF Pro Text'
  let weight = isBold ? 'bold' : (fontType === 'Display' ? '600' : 'normal')
  let fontName = isBold
    ? (fontType === 'Display' ? 'SF Pro Display Bold' : 'SF Pro Text Medium')
    : (fontType === 'Display' ? 'SF Pro Display Semibold' : 'SF Pro Text Regular')
  let fontStr = ''
  if (isItalic) fontStr += 'italic '
  fontStr += `${weight} ${size}px "${fontName}", "${baseFamily}", "Apple Color Emoji", "Noto Color Emoji", sans-serif`
  return fontStr
}

export function renderTokens(ctx, tokens, x, y, fontSize, defaultColor = '#ffffff', fontType = 'Text') {
  let curX = x
  for (const tok of tokens) {
    ctx.font = getFontString(fontSize, tok, fontType)
    ctx.fillStyle = defaultColor
    ctx.fillText(tok.text, curX, y)
    const tw = ctx.measureText(tok.text).width
    if (tok.strike) {
      ctx.save()
      ctx.strokeStyle = defaultColor
      ctx.lineWidth = Math.max(1, Math.round(fontSize / 15))
      ctx.beginPath()
      ctx.moveTo(curX, y - fontSize * 0.28)
      ctx.lineTo(curX + tw, y - fontSize * 0.28)
      ctx.stroke()
      ctx.restore()
    }
    curX += tw
  }
  return curX
}

export function formatRupiah(val) {
  if (val === undefined || val === null) return '0'
  const numStr = String(val).replace(/[^0-9]/g, '')
  if (!numStr) return '0'
  return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
