import { describe, expect, it } from 'vitest'
import {
  buildRemoteAudioMetadata,
  DEFAULT_REMOTE_AUDIO_USER_AGENT,
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
