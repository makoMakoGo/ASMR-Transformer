import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { TEST_CONFIG, requireAsrApiKey, BASE_URL } from '../setup'

describe('POST /api/transcribe', () => {
  let asrApiKey: string
  let audioBuffer: Buffer
  let audioBlob: Blob

  beforeAll(() => {
    asrApiKey = requireAsrApiKey()

    const audioPath = resolve(process.cwd(), TEST_CONFIG.TEST_AUDIO_FILE)
    if (!existsSync(audioPath)) {
      throw new Error(`Test audio file not found: ${audioPath}`)
    }
    audioBuffer = readFileSync(audioPath)
    audioBlob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/mpeg' })
  })

  describe('参数验证', () => {
    it('缺少文件时返回 400', async () => {
      const formData = new FormData()
      formData.append('asrApiKey', asrApiKey)

      const res = await fetch(`${BASE_URL}/api/transcribe`, { method: 'POST', body: formData })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.success).toBe(false)
      expect(data.error).toContain('音频文件')
    })

    it('服务器未配置 ASR_API_KEY 且请求未提供时返回 400', async () => {
      // 注意：如果服务器已配置 ASR_API_KEY 环境变量，此测试会跳过
      // 因为 API 会使用环境变量中的 key
      const formData = new FormData()
      formData.append('file', audioBlob, 'test.mp3')

      const res = await fetch(`${BASE_URL}/api/transcribe`, { method: 'POST', body: formData })

      // 如果服务器配置了 ASR_API_KEY，请求会成功（使用环境变量）
      // 如果未配置，则返回 400
      if (res.status === 200) {
        console.log('服务器已配置 ASR_API_KEY，跳过此测试')
        return
      }

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.success).toBe(false)
    })
  })

  describe('基础转录功能', () => {
    it('成功转录音频文件', async () => {
      const formData = new FormData()
      formData.append('file', audioBlob, "Juya's Opening.mp3")
      formData.append('asrApiKey', asrApiKey)

      const res = await fetch(`${BASE_URL}/api/transcribe`, { method: 'POST', body: formData })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.transcription).toBeDefined()
      expect(data.transcription.length).toBeGreaterThan(0)

      // 输出转录结果
      console.log('\n========== 转录结果 ==========')
      console.log(`文件: ${data.metadata.fileName}`)
      console.log(`耗时: ${data.metadata.processingTime}ms`)
      console.log('原文:')
      console.log(data.transcription)
      console.log('==============================\n')
    }, 30000)
  })

  describe('转录 + 润色功能', () => {
    it('成功转录并润色', async () => {
      const formData = new FormData()
      formData.append('file', audioBlob, "Juya's Opening.mp3")
      formData.append('asrApiKey', asrApiKey)
      formData.append('polish', 'true')

      const res = await fetch(`${BASE_URL}/api/transcribe`, { method: 'POST', body: formData })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.transcription).toBeDefined()
      expect(data.polished).toBeDefined()

      // 输出转录和润色结果
      console.log('\n========== 转录 + 润色结果 ==========')
      console.log(`文件: ${data.metadata.fileName}`)
      console.log(`耗时: ${data.metadata.processingTime}ms`)
      console.log('\n【原始转录】')
      console.log(data.transcription)
      console.log('\n【润色后】')
      console.log(data.polished)
      console.log('=====================================\n')
    }, 60000)

    it('使用自定义润色指令（翻译成英文）', async () => {
      const formData = new FormData()
      formData.append('file', audioBlob, "Juya's Opening.mp3")
      formData.append('asrApiKey', asrApiKey)
      formData.append('polish', 'true')
      formData.append('customInstructions', '请将文本翻译成英文')

      const res = await fetch(`${BASE_URL}/api/transcribe`, { method: 'POST', body: formData })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)

      // 输出翻译结果
      console.log('\n========== 自定义指令（翻译）结果 ==========')
      console.log('\n【原始转录】')
      console.log(data.transcription)
      console.log('\n【英文翻译】')
      console.log(data.polished)
      console.log('============================================\n')
    }, 60000)
  })

  describe('错误处理', () => {
    it('无效的 ASR API Key 返回错误', async () => {
      const formData = new FormData()
      formData.append('file', audioBlob, 'test.mp3')
      formData.append('asrApiKey', 'invalid-key')

      const res = await fetch(`${BASE_URL}/api/transcribe`, { method: 'POST', body: formData })

      expect(res.status).not.toBe(200)
      const data = await res.json()
      expect(data.success).toBe(false)
      expect(data.error).toBeDefined()
    }, 30000)
  })
})

describe('GET /api/transcribe', () => {
  it('返回 API 信息', async () => {
    const res = await fetch(`${BASE_URL}/api/transcribe`)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.name).toBe('Transcribe API')
    expect(data.documentation).toBe('/docs')
  })
})
