import { describe, it, expect } from 'vitest'
import { TEST_CONFIG, BASE_URL } from '../setup'

describe('POST /api/polish', () => {
  const testText = '这是一段测试文本用于测试润色功能它没有标点符号需要被处理'

  describe('参数验证', () => {
    it('缺少必要参数时返回 400', async () => {
      const res = await fetch(`${BASE_URL}/api/polish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: testText }),
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('缺少必要参数')
    })

    it('缺少文本时返回 400', async () => {
      const res = await fetch(`${BASE_URL}/api/polish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiUrl: TEST_CONFIG.LLM_API_URL,
          apiKey: 'test-key',
          model: TEST_CONFIG.LLM_MODEL,
        }),
      })

      expect(res.status).toBe(400)
    })
  })

  describe('润色功能', () => {
    it('成功润色文本（SSE 流式响应）', async () => {
      const res = await fetch(`${BASE_URL}/api/polish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: testText,
          apiUrl: TEST_CONFIG.LLM_API_URL,
          apiKey: TEST_CONFIG.LLM_API_KEY || 'sk-kUm2RSHxuRJyjdrzdwprHYFYwvE4NTkIzRoyyaiDoh7YyDIZ',
          model: TEST_CONFIG.LLM_MODEL,
        }),
      })

      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain('text/event-stream')

      // 读取 SSE 流
      const reader = res.body?.getReader()
      expect(reader).toBeDefined()

      let fullContent = ''
      const decoder = new TextDecoder()

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.slice(6))
              const content = data.choices?.[0]?.delta?.content || ''
              fullContent += content
            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      expect(fullContent.length).toBeGreaterThan(0)
    }, 30000)

    it('使用自定义指令', async () => {
      const res = await fetch(`${BASE_URL}/api/polish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: '你好世界',
          apiUrl: TEST_CONFIG.LLM_API_URL,
          apiKey: TEST_CONFIG.LLM_API_KEY || 'sk-kUm2RSHxuRJyjdrzdwprHYFYwvE4NTkIzRoyyaiDoh7YyDIZ',
          model: TEST_CONFIG.LLM_MODEL,
          customInstructions: '请将文本翻译成英文',
        }),
      })

      expect(res.status).toBe(200)
    }, 30000)
  })
})
