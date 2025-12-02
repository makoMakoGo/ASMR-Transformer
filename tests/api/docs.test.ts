import { describe, it, expect } from 'vitest'
import { BASE_URL } from '../setup'

describe('GET /api/docs', () => {
  it('返回 Markdown 格式文档', async () => {
    const res = await fetch(`${BASE_URL}/api/docs`)

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/markdown')

    const content = await res.text()
    expect(content).toContain('# API 文档')
    expect(content).toContain('/api/transcribe')
    expect(content).toContain('/api/polish')
  })

  it('返回 JSON 格式文档', async () => {
    const res = await fetch(`${BASE_URL}/api/docs?format=json`)

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')

    const data = await res.json()
    expect(data.title).toBeDefined()
    expect(data.version).toBeDefined()
    expect(data.content).toBeDefined()
    expect(data.endpoints).toBeInstanceOf(Array)
    expect(data.endpoints.length).toBeGreaterThan(0)
  })
})

describe('GET /docs (HTML page)', () => {
  it('返回 HTML 文档页面', async () => {
    const res = await fetch(`${BASE_URL}/docs`)

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')

    const html = await res.text()
    expect(html).toContain('API 文档')
  })
})
