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
    console.log(`[PASS] [1/7] renderIQC sukses: ${buf.length} bytes`)
  } catch (err) {
    console.error('[FAIL] [1/7] renderIQC error:', err)
  }

  try {
    const buf = await zirekuCanvas.renderFakeCH({
      avatar: sampleAvatar,
      channelName: 'Zireku Official Channel',
      followers: '25.000',
      description: 'Official announcements and updates for *Zireku* canvas engine.'
    })
    console.log(`[PASS] [2/7] renderFakeCH sukses: ${buf.length} bytes`)
  } catch (err) {
    console.error('[FAIL] [2/7] renderFakeCH error:', err)
  }

  try {
    const buf = await zirekuCanvas.renderFakeGC({
      avatar: sampleAvatar,
      groupName: 'Developer Community',
      memberCount: '150',
      description: 'Grup diskusi developer dan bot architecture.'
    })
    console.log(`[PASS] [3/7] renderFakeGC sukses: ${buf.length} bytes`)
  } catch (err) {
    console.error('[FAIL] [3/7] renderFakeGC error:', err)
  }

  try {
    const buf = await zirekuCanvas.renderBikinQRIS({
      qrisImage: sampleQris,
      number: '0812-3456-7890',
      name: '@zireku_store',
      template: 1
    })
    console.log(`[PASS] [4/7] renderBikinQRIS sukses: ${buf.length} bytes`)
  } catch (err) {
    console.error('[FAIL] [4/7] renderBikinQRIS error:', err)
  }

  try {
    const buf = await zirekuCanvas.renderBikinStokAkun({
      accountImage: sampleAvatar,
      store: 'ZIREKU STORE',
      price: '150000',
      number: '08123456789',
      sosmed: 'zireku.id'
    })
    console.log(`[PASS] [5/7] renderBikinStokAkun sukses: ${buf.length} bytes`)
  } catch (err) {
    console.error('[FAIL] [5/7] renderBikinStokAkun error:', err)
  }

  try {
    const buf = await zirekuCanvas.renderBikinTesti({
      image1: sampleAvatar,
      image2: sampleAvatar,
      number: '08123456789',
      name: '@zireku',
      template: 1
    })
    console.log(`[PASS] [6/7] renderBikinTesti sukses: ${buf.length} bytes`)
  } catch (err) {
    console.error('[FAIL] [6/7] renderBikinTesti error:', err)
  }

  try {
    const buf = await zirekuCanvas.renderSetupGaming({
      screenImage: sampleAvatar
    })
    console.log(`[PASS] [7/7] renderSetupGaming sukses: ${buf.length} bytes`)
  } catch (err) {
    console.error('[FAIL] [7/7] renderSetupGaming error:', err)
  }

  console.log('\n[INFO] Semua pengujian modul selesai dijalankan.')
}

runTests()
