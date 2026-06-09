import { describe, expect, it } from 'vitest'

import {
  fetchRemoteAudioForAsr,
  type RemoteAudioFetchEvent,
} from '@/lib/browser-remote-audio'

const AUDIO_URL = 'https://www.asmrgay.com/asmr/123'

const streamFromChunks = (chunks: Uint8Array[]): ReadableStream<Uint8Array> =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk)
      }
      controller.close()
    },
  })

describe('fetchRemoteAudioForAsr', () => {
  it('downloads known-size proxy audio into an ASR file and reports progress', async () => {
    const events: RemoteAudioFetchEvent[] = []
    const fetchFn: typeof fetch = async (url, init) => {
      expect(String(url)).toBe('/api/proxy-audio')
      expect(init?.method).toBe('POST')
      expect(init?.body).toBe(JSON.stringify({ url: AUDIO_URL }))

      return new Response(
        streamFromChunks([
          new Uint8Array([1]),
          new Uint8Array([2, 3]),
        ]),
        {
          status: 200,
          headers: {
            'content-length': '3',
            'content-type': 'audio/mpeg',
            'x-file-name': encodeURIComponent('clip.mp3'),
          },
        }
      )
    }

    const file = await fetchRemoteAudioForAsr(AUDIO_URL, {
      fetchFn,
      maxAudioBytes: 10,
      onProgress: (event) => events.push(event),
    })

    expect(file.name).toBe('clip.mp3')
    expect(file.type).toBe('audio/mpeg')
    expect(file.size).toBe(3)
    expect([...new Uint8Array(await file.arrayBuffer())]).toEqual([1, 2, 3])
    expect(events).toEqual([
      { type: 'download-start', fileName: 'clip.mp3', totalBytes: 3 },
      { type: 'download-progress', receivedBytes: 1, totalBytes: 3, percent: 33 },
      { type: 'download-progress', receivedBytes: 3, totalBytes: 3, percent: 100 },
      { type: 'download-complete', receivedBytes: 3 },
    ])
  })

  it('downloads unknown-size proxy audio without percentage progress', async () => {
    const events: RemoteAudioFetchEvent[] = []
    const fetchFn: typeof fetch = async () =>
      new Response(streamFromChunks([new Uint8Array([4, 5])]), {
        status: 200,
        headers: {
          'content-type': 'audio/wav',
          'x-file-name': 'remote.wav',
        },
      })

    const file = await fetchRemoteAudioForAsr(AUDIO_URL, {
      fetchFn,
      maxAudioBytes: 10,
      onProgress: (event) => events.push(event),
    })

    expect(file.name).toBe('remote.wav')
    expect(file.type).toBe('audio/wav')
    expect(file.size).toBe(2)
    expect(events).toEqual([
      { type: 'download-start', fileName: 'remote.wav', totalBytes: null },
      { type: 'download-progress', receivedBytes: 2, totalBytes: null, percent: null },
      { type: 'download-complete', receivedBytes: 2 },
    ])
  })

  it('rejects proxy audio that declares a content length above the browser limit', async () => {
    const fetchFn: typeof fetch = async () =>
      new Response(streamFromChunks([new Uint8Array([1])]), {
        status: 200,
        headers: {
          'content-length': '11',
          'content-type': 'audio/mpeg',
        },
      })

    await expect(
      fetchRemoteAudioForAsr(AUDIO_URL, {
        fetchFn,
        maxAudioBytes: 10,
      })
    ).rejects.toThrow('文件过大 (11 B)，为避免浏览器崩溃已中止。最大支持 10 B。')
  })

  it('rejects unknown-size proxy audio when streamed bytes exceed the browser limit', async () => {
    const fetchFn: typeof fetch = async () =>
      new Response(
        streamFromChunks([
          new Uint8Array(6),
          new Uint8Array(5),
        ]),
        {
          status: 200,
          headers: {
            'content-type': 'audio/mpeg',
          },
        }
      )

    await expect(
      fetchRemoteAudioForAsr(AUDIO_URL, {
        fetchFn,
        maxAudioBytes: 10,
      })
    ).rejects.toThrow('文件过大 (11 B)，为避免浏览器崩溃已中止。最大支持 10 B。')
  })

  it('reads JSON proxy errors instead of treating them as audio', async () => {
    const fetchFn: typeof fetch = async () =>
      new Response(JSON.stringify({ error: '音频 URL 无效或不受支持' }), {
        status: 400,
        headers: {
          'content-type': 'application/json',
        },
      })

    await expect(
      fetchRemoteAudioForAsr(AUDIO_URL, {
        fetchFn,
        maxAudioBytes: 10,
      })
    ).rejects.toThrow('音频 URL 无效或不受支持')
  })

  it('rejects proxy responses without a readable body', async () => {
    const fetchFn: typeof fetch = async () =>
      new Response(null, {
        status: 200,
        headers: {
          'content-type': 'audio/mpeg',
        },
      })

    await expect(
      fetchRemoteAudioForAsr(AUDIO_URL, {
        fetchFn,
        maxAudioBytes: 10,
      })
    ).rejects.toThrow('无法读取音频数据流')
  })
})
