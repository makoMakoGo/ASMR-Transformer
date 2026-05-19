import { describe, expect, it } from 'vitest'
import {
  buildRemoteAudioMetadata,
  checkRemoteAudio,
  DEFAULT_REMOTE_AUDIO_USER_AGENT,
  proxyRemoteAudio,
  RemoteAudioError,
  resolveRemoteAudioSource,
} from '@/lib/remote-audio'

describe('resolveRemoteAudioSource', () => {
  it('keeps direct audio urls unchanged', async () => {
    const source = await resolveRemoteAudioSource('https://www.asmrgay.com/d/asmr/test.mp3?sign=abc')

    expect(source.isAlistPage).toBe(false)
    expect(source.resolvedUrl).toBe('https://www.asmrgay.com/d/asmr/test.mp3?sign=abc')
    expect(source.resolvedUrlObject.hostname).toBe('www.asmrgay.com')
  })

  it('resolves AList page urls through the shared resolver', async () => {
    const fetchFn = async (url: string, init?: RequestInit) => {
      expect(url).toBe('https://www.asmrgay.com/api/fs/get')
      expect(init?.method).toBe('POST')
      expect((init?.headers as Record<string, string>)['User-Agent']).toBe(DEFAULT_REMOTE_AUDIO_USER_AGENT)
      expect(init?.body).toBe(JSON.stringify({ path: '/asmr/123' }))

      return new Response(
        JSON.stringify({
          code: 200,
          data: {
            raw_url: 'https://asmr.121231234.xyz/file/test.mp3',
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

    const source = await resolveRemoteAudioSource('https://www.asmrgay.com/asmr/123', fetchFn)

    expect(source.isAlistPage).toBe(true)
    expect(source.resolvedUrl).toBe('https://asmr.121231234.xyz/file/test.mp3')
    expect(source.fileNameHint).toBe('123')
    expect(source.fileSizeHint).toBe(321)
    expect(source.contentTypeHint).toBe('audio/mpeg')
  })
})

describe('buildRemoteAudioMetadata', () => {
  it('prefers response headers over hints when both are available', () => {
    const metadata = buildRemoteAudioMetadata({
      source: {
        inputUrl: 'https://www.asmrgay.com/asmr/123',
        resolvedUrl: 'https://asmr.121231234.xyz/file/test.mp3',
        resolvedUrlObject: new URL('https://asmr.121231234.xyz/file/test.mp3'),
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
          inputUrl: 'https://www.asmrgay.com/asmr/123',
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
          inputUrl: 'https://www.asmrgay.com/asmr/123',
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

    const result = await checkRemoteAudio('https://www.asmrgay.com/d/audio/test.mp3', { fetchFn })

    expect(calls).toEqual([
      { url: 'https://www.asmrgay.com/d/audio/test.mp3', method: 'HEAD' },
    ])
    expect(result.source.isAlistPage).toBe(false)
    expect(result.metadata).toEqual({
      fileName: 'from-header.mp3',
      fileSize: 123,
      contentType: 'audio/mpeg',
      contentLength: '123',
    })
  })

  it('normalizes failed source HEAD checks', async () => {
    const fetchFn = async () => new Response(null, { status: 404, statusText: 'Not Found' })

    await expect(
      checkRemoteAudio('https://www.asmrgay.com/d/audio/test.mp3', { fetchFn })
    ).rejects.toMatchObject({
      code: 'SOURCE_RESPONSE_FAILED',
      status: 400,
      message: 'HTTP 404: Not Found',
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
      expect(url).toBe('https://www.asmrgay.com/d/audio/test.mp3')
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

    const result = await proxyRemoteAudio('https://www.asmrgay.com/d/audio/test.mp3', {
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

  it('rejects hinted files that exceed the configured size limit', async () => {
    const fetchFn = async () =>
      new Response(
        JSON.stringify({
          code: 200,
          data: {
            raw_url: 'https://asmr.121231234.xyz/file/test.mp3',
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
      proxyRemoteAudio('https://www.asmrgay.com/audio/test', {
        fetchFn,
        maxAudioBytes: 10,
      })
    ).rejects.toMatchObject({
      code: 'AUDIO_TOO_LARGE',
      status: 413,
      message: '音频文件过大，超过 0MB 限制',
    })
  })
})
