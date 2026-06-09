import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildRemoteAudioMetadata,
  checkRemoteAudio,
  DEFAULT_REMOTE_AUDIO_USER_AGENT,
  getMaxRemoteAudioSizeMessage,
  proxyRemoteAudio,
  RemoteAudioError,
  resolveRemoteAudioSource,
} from '@/lib/remote-audio'

const ALIST_PAGE_URL = 'https://www.asmrgay.com/asmr/123'
const ALIST_API_URL = 'https://www.asmrgay.com/api/fs/get'
const DIRECT_AUDIO_URL = 'https://www.asmrgay.com/d/audio/test.mp3'
const RESOLVED_AUDIO_URL = 'https://asmr.121231234.xyz/file/test.mp3'
const RESOLVED_AUDIO_ORIGIN = 'https://asmr.121231234.xyz'

afterEach(() => {
  vi.useRealTimers()
})

describe('resolveRemoteAudioSource', () => {
  it('keeps direct audio urls unchanged', async () => {
    const source = await resolveRemoteAudioSource('https://www.asmrgay.com/d/asmr/test.mp3?sign=abc')

    expect(source.isAlistPage).toBe(false)
    expect(source.resolvedUrl).toBe('https://www.asmrgay.com/d/asmr/test.mp3?sign=abc')
    expect(source.resolvedUrlObject.hostname).toBe('www.asmrgay.com')
  })

  it('resolves AList page urls through the shared resolver', async () => {
    const fetchFn = async (url: string, init?: RequestInit) => {
      expect(url).toBe(ALIST_API_URL)
      expect(init?.method).toBe('POST')
      expect((init?.headers as Record<string, string>)['User-Agent']).toBe(DEFAULT_REMOTE_AUDIO_USER_AGENT)
      expect(init?.body).toBe(JSON.stringify({ path: '/asmr/123' }))

      return new Response(
        JSON.stringify({
          code: 200,
          data: {
            raw_url: RESOLVED_AUDIO_URL,
            size: 321,
            type: 'audio/mpeg',
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    const source = await resolveRemoteAudioSource(ALIST_PAGE_URL, fetchFn)

    expect(source.isAlistPage).toBe(true)
    expect(source.resolvedUrl).toBe(RESOLVED_AUDIO_URL)
    expect(source.fileNameHint).toBe('123')
    expect(source.fileSizeHint).toBe(321)
    expect(source.contentTypeHint).toBe('audio/mpeg')
  })
})

describe('buildRemoteAudioMetadata', () => {
  it('prefers response headers over hints when both are available', () => {
    const metadata = buildRemoteAudioMetadata({
      source: {
        inputUrl: ALIST_PAGE_URL,
        resolvedUrl: RESOLVED_AUDIO_URL,
        resolvedUrlObject: new URL(RESOLVED_AUDIO_URL),
        isAlistPage: true,
        fileNameHint: 'hint.mp3',
        fileSizeHint: 12,
        contentTypeHint: 'audio/mpeg',
      },
      contentDisposition: "attachment; filename*=UTF-8''%E6%B5%8B%E8%AF%95.mp3",
      contentType: 'audio/mpeg; charset=utf-8',
      contentLength: '42',
    })

    expect(metadata).toEqual({
      fileName: 'hint.mp3',
      fileSize: 42,
      contentType: 'audio/mpeg',
      contentLength: '42',
    })
  })

  it('rejects unsupported WMA audio early', () => {
    expect(() =>
      buildRemoteAudioMetadata({
        source: {
          inputUrl: ALIST_PAGE_URL,
          resolvedUrl: 'https://asmr.121231234.xyz/file/test.wma',
          resolvedUrlObject: new URL('https://asmr.121231234.xyz/file/test.wma'),
          isAlistPage: true,
          fileNameHint: 'test.wma',
        },
        contentType: 'audio/x-ms-wma',
      })
    ).toThrowError('不支持 WMA 格式，请转换为 mp3/wav/m4a/flac/ogg/webm/aac')
  })

  it('rejects non-audio responses even after URL resolution', () => {
    expect(() =>
      buildRemoteAudioMetadata({
        source: {
          inputUrl: ALIST_PAGE_URL,
          resolvedUrl: 'https://asmr.121231234.xyz/file/blob',
          resolvedUrlObject: new URL('https://asmr.121231234.xyz/file/blob'),
          isAlistPage: true,
        },
        contentType: 'text/html',
      })
    ).toThrowError('不是音频文件 (text/html)')
  })
})

describe('checkRemoteAudio', () => {
  it('returns metadata for a reachable direct audio url', async () => {
    const calls: Array<{ url: string; method?: string }> = []
    const fetchFn = async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method })

      return new Response(null, {
        status: 200,
        headers: {
          'content-length': '123',
          'content-type': 'audio/mpeg',
          'content-disposition': 'attachment; filename="from-header.mp3"',
        },
      })
    }

    const result = await checkRemoteAudio(DIRECT_AUDIO_URL, { fetchFn })

    expect(calls).toEqual([
      { url: DIRECT_AUDIO_URL, method: 'HEAD' },
    ])
    expect(result.source.isAlistPage).toBe(false)
    expect(result.metadata).toEqual({
      fileName: 'from-header.mp3',
      fileSize: 123,
      contentType: 'audio/mpeg',
      contentLength: '123',
    })
  })

  it('checks AList page urls by resolving internally before reading metadata', async () => {
    const calls: Array<{ url: string; method?: string }> = []
    const fetchFn = async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method })

      if (url === ALIST_API_URL) {
        return new Response(
          JSON.stringify({
            code: 200,
            data: {
              raw_url: RESOLVED_AUDIO_URL,
              size: 321,
              type: 'audio/mpeg',
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      if (url === RESOLVED_AUDIO_URL) {
        return new Response(null, {
          status: 200,
          headers: {
            'content-length': '456',
            'content-type': 'audio/mpeg',
          },
        })
      }

      throw new Error(`unexpected fetch: ${url}`)
    }

    const result = await checkRemoteAudio(ALIST_PAGE_URL, { fetchFn })

    expect(calls).toEqual([
      { url: ALIST_API_URL, method: 'POST' },
      { url: RESOLVED_AUDIO_URL, method: 'HEAD' },
    ])
    expect(result.source.inputUrl).toBe(ALIST_PAGE_URL)
    expect(result.source.resolvedUrl).toBe(RESOLVED_AUDIO_URL)
    expect(result.metadata).toEqual({
      fileName: '123',
      fileSize: 456,
      contentType: 'audio/mpeg',
      contentLength: '456',
    })
  })

  it('normalizes failed AList resolution checks', async () => {
    const calls: Array<{ url: string; method?: string }> = []
    const fetchFn = async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method })

      if (url === ALIST_API_URL) {
        return new Response(
          JSON.stringify({
            code: 200,
            data: {
              size: 321,
              type: 'audio/mpeg',
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      throw new Error(`unexpected fetch: ${url}`)
    }

    await expect(checkRemoteAudio(ALIST_PAGE_URL, { fetchFn })).rejects.toMatchObject({
      code: 'ALIST_RESOLVE_FAILED',
      status: 400,
      message: '解析播放页面失败: 无法获取音频地址',
    })
    expect(calls).toEqual([{ url: ALIST_API_URL, method: 'POST' }])
  })

  it('normalizes failed HEAD checks after AList resolution', async () => {
    const calls: Array<{ url: string; method?: string }> = []
    const fetchFn = async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method })

      if (url === ALIST_API_URL) {
        return new Response(
          JSON.stringify({
            code: 200,
            data: {
              raw_url: RESOLVED_AUDIO_URL,
              size: 321,
              type: 'audio/mpeg',
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      if (url === RESOLVED_AUDIO_URL) {
        return new Response(null, { status: 404, statusText: 'Not Found' })
      }

      throw new Error(`unexpected fetch: ${url}`)
    }

    await expect(checkRemoteAudio(ALIST_PAGE_URL, { fetchFn })).rejects.toMatchObject({
      code: 'SOURCE_RESPONSE_FAILED',
      status: 400,
      message: 'HTTP 404: Not Found',
    })
    expect(calls).toEqual([
      { url: ALIST_API_URL, method: 'POST' },
      { url: RESOLVED_AUDIO_URL, method: 'HEAD' },
    ])
  })

  it('normalizes failed source HEAD checks', async () => {
    const fetchFn = async () => new Response(null, { status: 404, statusText: 'Not Found' })

    await expect(
      checkRemoteAudio(DIRECT_AUDIO_URL, { fetchFn })
    ).rejects.toMatchObject({
      code: 'SOURCE_RESPONSE_FAILED',
      status: 400,
      message: 'HTTP 404: Not Found',
    })
  })

  it('normalizes source HEAD network failures', async () => {
    const fetchFn = async () => {
      throw new Error('socket closed')
    }

    await expect(
      checkRemoteAudio(DIRECT_AUDIO_URL, { fetchFn })
    ).rejects.toMatchObject({
      code: 'SOURCE_HEAD_FAILED',
      status: 500,
      message: '检查失败: socket closed',
    })
  })

  it('normalizes caller aborts during checks', async () => {
    const controller = new AbortController()
    controller.abort()
    const fetchFn = async (_url: string, init?: RequestInit) => {
      if (init?.signal?.aborted) throw new DOMException('aborted', 'AbortError')
      return new Response(null, { status: 200 })
    }

    await expect(
      checkRemoteAudio(DIRECT_AUDIO_URL, {
        fetchFn,
        signal: controller.signal,
      })
    ).rejects.toMatchObject({
      code: 'REQUEST_ABORTED',
      status: 499,
    })
  })

  it('normalizes check timeouts', async () => {
    vi.useFakeTimers()
    const fetchFn = async (_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'))
        })
      })
    const pending = checkRemoteAudio(DIRECT_AUDIO_URL, {
      fetchFn,
      timeoutMs: 1000,
    }).catch((error: unknown) => error)

    await vi.advanceTimersByTimeAsync(1000)
    await expect(pending).resolves.toMatchObject({
      code: 'REQUEST_TIMEOUT',
      status: 504,
      message: '检查超时（HEAD 阶段）',
    })
  })
})

describe('proxyRemoteAudio', () => {
  it('returns proxy headers and a size-limited stream', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]))
        controller.close()
      },
    })
    const fetchFn = async (url: string, init?: RequestInit) => {
      expect(url).toBe(DIRECT_AUDIO_URL)
      expect(init?.method).toBe('GET')
      expect((init?.headers as Record<string, string>)['User-Agent']).toBe(DEFAULT_REMOTE_AUDIO_USER_AGENT)
      expect((init?.headers as Record<string, string>).Referer).toBe('https://www.asmrgay.com')

      return new Response(body, {
        status: 200,
        headers: {
          'content-length': '3',
          'content-type': 'audio/mpeg',
          'content-disposition': 'attachment; filename="proxied.mp3"',
        },
      })
    }

    const result = await proxyRemoteAudio(DIRECT_AUDIO_URL, {
      fetchFn,
      maxAudioBytes: 10,
    })

    expect(result.metadata.fileName).toBe('proxied.mp3')
    expect(result.headers.get('content-type')).toBe('audio/mpeg')
    expect(result.headers.get('content-length')).toBe('3')
    expect(result.headers.get('x-file-name')).toBe('proxied.mp3')

    const proxied = await new Response(result.body).arrayBuffer()
    expect([...new Uint8Array(proxied)]).toEqual([1, 2, 3])
  })

  it('proxies AList page urls by resolving the audio url internally', async () => {
    const calls: Array<{ url: string; method?: string }> = []
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([4, 5, 6]))
        controller.close()
      },
    })
    const fetchFn = async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method })

      if (url === ALIST_API_URL) {
        return new Response(
          JSON.stringify({
            code: 200,
            data: {
              raw_url: RESOLVED_AUDIO_URL,
              size: 3,
              type: 'audio/mpeg',
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      if (url === RESOLVED_AUDIO_URL) {
        expect((init?.headers as Record<string, string>).Referer).toBe(RESOLVED_AUDIO_ORIGIN)
        return new Response(body, {
          status: 200,
          headers: {
            'content-length': '3',
            'content-type': 'audio/mpeg',
          },
        })
      }

      throw new Error(`unexpected fetch: ${url}`)
    }

    const result = await proxyRemoteAudio(ALIST_PAGE_URL, {
      fetchFn,
      maxAudioBytes: 10,
    })

    expect(calls).toEqual([
      { url: ALIST_API_URL, method: 'POST' },
      { url: RESOLVED_AUDIO_URL, method: 'GET' },
    ])
    expect(result.source.inputUrl).toBe(ALIST_PAGE_URL)
    expect(result.source.resolvedUrl).toBe(RESOLVED_AUDIO_URL)

    const proxied = await new Response(result.body).arrayBuffer()
    expect([...new Uint8Array(proxied)]).toEqual([4, 5, 6])
  })

  it('rejects hinted files that exceed the configured size limit', async () => {
    const fetchFn = async () =>
      new Response(
        JSON.stringify({
          code: 200,
          data: {
            raw_url: RESOLVED_AUDIO_URL,
            size: 11,
            type: 'audio/mpeg',
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )

    await expect(
      proxyRemoteAudio(ALIST_PAGE_URL, {
        fetchFn,
        maxAudioBytes: 10,
      })
    ).rejects.toMatchObject({
      code: 'AUDIO_TOO_LARGE',
      status: 413,
      message: '音频文件过大，超过 1KB 限制',
    })
  })

  it('rejects response content-length that exceeds the configured size limit', async () => {
    const fetchFn = async () =>
      new Response(new ReadableStream<Uint8Array>(), {
        status: 200,
        headers: {
          'content-length': '11',
          'content-type': 'audio/mpeg',
        },
      })

    await expect(
      proxyRemoteAudio(DIRECT_AUDIO_URL, {
        fetchFn,
        maxAudioBytes: 10,
      })
    ).rejects.toMatchObject({
      code: 'AUDIO_TOO_LARGE',
      status: 413,
      message: '音频文件过大，超过 1KB 限制',
    })
  })
})

describe('getMaxRemoteAudioSizeMessage', () => {
  it('uses KB for sub-MB limits and MB for larger limits', () => {
    expect(getMaxRemoteAudioSizeMessage(10)).toBe('音频文件过大，超过 1KB 限制')
    expect(getMaxRemoteAudioSizeMessage(512 * 1024)).toBe('音频文件过大，超过 512KB 限制')
    expect(getMaxRemoteAudioSizeMessage(100 * 1024 * 1024)).toBe('音频文件过大，超过 100MB 限制')
  })
})
