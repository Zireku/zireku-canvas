import fs from 'node:fs'
import path from 'node:path'
import zirekuCanvas from './src/index.js'

async function runTests() {
  console.log('[INFO] Memulai pengujian modul Zireku Canvas Engine...\n')

  const sampleAvatar = path.resolve('media/canvas/fakechios/template.jpg')
  const sampleQris = path.resolve('media/canvas/bikinqris/icon_wa.jpg')

  try {
    const buf = await zirekuCanvas.renderIQC({
      quote: 'Hai, mau nanya nih bro',
      message: 'Ini contoh pesan *bold*, _italic_, ~strike~ dari engine canvas!',
      time: '12.45'
    })
    console.log(`[PASS] [1/8] renderIQC sukses: ${buf.length} bytes`)
  } catch (err) {
    console.error('[FAIL] [1/8] renderIQC error:', err)
  }

  try {
    const buf = await zirekuCanvas.renderFakeCH({
      avatar: sampleAvatar,
      channelName: 'Zireku Official Channel',
      followers: '25.000',
      description: 'Official announcements and updates for *Zireku* canvas engine.'
    })
    console.log(`[PASS] [2/8] renderFakeCH sukses: ${buf.length} bytes`)
  } catch (err) {
    console.error('[FAIL] [2/8] renderFakeCH error:', err)
  }

  try {
    const buf = await zirekuCanvas.renderFakeGC({
      avatar: sampleAvatar,
      groupName: 'Developer Community',
      memberCount: '150',
      description: 'Grup diskusi developer dan bot architecture.'
    })
    console.log(`[PASS] [3/8] renderFakeGC sukses: ${buf.length} bytes`)
  } catch (err) {
    console.error('[FAIL] [3/8] renderFakeGC error:', err)
  }

  try {
    const buf = await zirekuCanvas.renderBikinQRIS({
      qrisImage: sampleQris,
      number: '0812-3456-7890',
      name: '@zireku_store',
      template: 1
    })
    console.log(`[PASS] [4/8] renderBikinQRIS sukses: ${buf.length} bytes`)
  } catch (err) {
    console.error('[FAIL] [4/8] renderBikinQRIS error:', err)
  }

  try {
    const buf = await zirekuCanvas.renderBikinStokAkun({
      accountImage: sampleAvatar,
      store: 'ZIREKU STORE',
      price: '150000',
      number: '08123456789',
      sosmed: 'zireku.id'
    })
    console.log(`[PASS] [5/8] renderBikinStokAkun sukses: ${buf.length} bytes`)
  } catch (err) {
    console.error('[FAIL] [5/8] renderBikinStokAkun error:', err)
  }

  try {
    const buf = await zirekuCanvas.renderBikinTesti({
      image1: sampleAvatar,
      image2: sampleAvatar,
      number: '08123456789',
      name: '@zireku',
      template: 1
    })
    console.log(`[PASS] [6/8] renderBikinTesti sukses: ${buf.length} bytes`)
  } catch (err) {
    console.error('[FAIL] [6/8] renderBikinTesti error:', err)
  }

  try {
    const buf = await zirekuCanvas.renderSetupGaming({
      screenImage: sampleAvatar
    })
    console.log(`[PASS] [7/8] renderSetupGaming sukses: ${buf.length} bytes`)
  } catch (err) {
    console.error('[FAIL] [7/8] renderSetupGaming error:', err)
  }

  try {
    const buf = await zirekuCanvas.renderFakeTTVT({
      video: sampleAvatar,
      avatar: sampleAvatar,
      name: 'Zireku',
      caption: 'Review bot WhatsApp canggih #fyp #botwhatsapp',
      likes: '176K',
      comments: '3.876',
      shares: '1.987'
    })
    console.log(`[PASS] [8/8] renderFakeTTVT sukses: ${buf.length} bytes`)
  } catch (err) {
    console.error('[FAIL] [8/8] renderFakeTTVT error:', err)
  }

  console.log('\n[INFO] Semua pengujian modul selesai dijalankan.')
}

runTests()
