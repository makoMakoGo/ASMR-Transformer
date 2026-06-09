import { afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/check-audio/route'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('POST /api/check-audio', () => {
  it('does not expose resolved AList URLs in the check response', async () => {
    const resolvedUrl = 'https://asmr.121231234.xyz/file/test.mp3'
    const fetchFn = vi.fn(async (url: string) => {
      if (url === 'https://www.asmrgay.com/api/fs/get') {
        return new Response(
          JSON.stringify({
            code: 200,
            data: {
              raw_url: resolvedUrl,
              size: 123,
              type: 'audio/mpeg',
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      if (url === resolvedUrl) {
        return new Response(null, {
          status: 200,
          headers: {
            'content-length': '123',
            'content-type': 'audio/mpeg',
          },
        })
      }

      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchFn)

    const request = new Request('http://localhost/api/check-audio', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.asmrgay.com/asmr/123' }),
    }) as Parameters<typeof POST>[0]
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      success: true,
      name: '123',
      size: 123,
      type: 'audio/mpeg',
    })
    expect(data).not.toHaveProperty('resolvedUrl')
  })
})
