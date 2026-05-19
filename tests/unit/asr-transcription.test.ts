import { describe, expect, it } from 'vitest'
import {
  formatAsrApiErrorMessage,
  hasAsrApiKey,
  normalizeAsrRunSettings,
  runAsrTranscription,
  type AsrTranscriptionCallbacks,
} from '@/lib/asr-transcription'
import { DEFAULT_SETTINGS, type Settings } from '@/lib/app-settings'

class FakeXMLHttpRequest {
  upload: XMLHttpRequestUpload = {} as XMLHttpRequestUpload
  status = 200
  responseText = '{"text":"ok"}'
  timeout = 0
  method = ''
  url = ''
  headers: Record<string, string> = {}
  body: BodyInit | null = null
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  ontimeout: (() => void) | null = null
  abortCount = 0

  open(method: string, url: string) {
    this.method = method
    this.url = url
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value
  }

  send(body: BodyInit | null) {
    this.body = body
  }

  abort() {
    this.abortCount += 1
  }
}

const buildSettings = (overrides: Partial<Settings> = {}): Settings => ({
  ...DEFAULT_SETTINGS,
  apiKey: ' key ',
  apiUrl: ' https://asr.example/v1/audio/transcriptions ',
  model: ' model ',
  ...overrides,
})

describe('ASR run settings', () => {
  it('normalizes the ASR settings used by a run', () => {
    expect(normalizeAsrRunSettings(buildSettings())).toEqual({
      apiKey: 'key',
      apiUrl: 'https://asr.example/v1/audio/transcriptions',
      model: 'model',
    })
  })

  it('detects missing ASR API keys after trimming', () => {
    expect(hasAsrApiKey(buildSettings({ apiKey: '  ' }))).toBe(false)
    expect(hasAsrApiKey(buildSettings({ apiKey: 'sk-test' }))).toBe(true)
  })

  it('formats ASR API error payloads consistently', () => {
    expect(formatAsrApiErrorMessage({
      ok: false,
      status: 401,
      data: { error: 'bad key' },
      text: '',
    })).toBe('错误: 401 - {"error":"bad key"}')
  })
})

describe('runAsrTranscription', () => {
  it('uploads the file with model and authorization settings', async () => {
    const xhr = new FakeXMLHttpRequest()
    const pending = runAsrTranscription(
      new File(['audio'], 'test.mp3', { type: 'audio/mpeg' }),
      normalizeAsrRunSettings(buildSettings()),
      {},
      { requestFactory: () => xhr as unknown as XMLHttpRequest }
    )

    expect(xhr.method).toBe('POST')
    expect(xhr.url).toBe('https://asr.example/v1/audio/transcriptions')
    expect(xhr.headers.Authorization).toBe('Bearer key')
    expect(xhr.timeout).toBe(300000)
    expect(xhr.body).toBeInstanceOf(FormData)

    xhr.onload?.()
    await expect(pending).resolves.toMatchObject({
      ok: true,
      status: 200,
      text: 'ok',
      data: { text: 'ok' },
    })
  })

  it('reports upload progress and wait heartbeat through callbacks', async () => {
    const xhr = new FakeXMLHttpRequest()
    let now = 0
    let intervalHandler: (() => void) | null = null
    const events: Array<string> = []
    const callbacks: AsrTranscriptionCallbacks = {
      onUploadProgress: (progress) => {
        events.push(`upload:${progress.loaded}/${progress.total}:${progress.percent}:${progress.shouldLog}`)
      },
      onUploadComplete: () => events.push('upload-complete'),
      onWaitHeartbeat: (heartbeat) => {
        events.push(`wait:${heartbeat.elapsedSeconds}:${heartbeat.shouldLog}`)
      },
    }

    const pending = runAsrTranscription(
      new File(['audio'], 'test.mp3'),
      normalizeAsrRunSettings(buildSettings()),
      callbacks,
      {
        requestFactory: () => xhr as unknown as XMLHttpRequest,
        now: () => now,
        setIntervalFn: (handler) => {
          intervalHandler = handler
          return 1 as unknown as ReturnType<typeof setInterval>
        },
        clearIntervalFn: () => undefined,
      }
    )

    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 25, total: 100 } as ProgressEvent)
    xhr.upload.onload?.({} as ProgressEvent)
    now = 10000
    intervalHandler?.()
    now = 20000
    intervalHandler?.()
    xhr.onload?.()

    await pending
    expect(events).toEqual([
      'upload:25/100:25:true',
      'upload-complete',
      'wait:10:true',
      'wait:20:true',
    ])
  })

  it('guards zero upload totals, negative elapsed time, and null JSON payloads', async () => {
    const xhr = new FakeXMLHttpRequest()
    let now = 1000
    let intervalHandler: (() => void) | null = null
    const events: Array<string> = []
    xhr.responseText = 'null'
    const pending = runAsrTranscription(
      new File(['audio'], 'test.mp3'),
      normalizeAsrRunSettings(buildSettings()),
      {
        onUploadProgress: (progress) => {
          events.push(`upload:${progress.percent}`)
        },
        onWaitHeartbeat: (heartbeat) => {
          events.push(`wait:${heartbeat.elapsedSeconds}`)
        },
      },
      {
        requestFactory: () => xhr as unknown as XMLHttpRequest,
        now: () => now,
        setIntervalFn: (handler) => {
          intervalHandler = handler
          return 1 as unknown as ReturnType<typeof setInterval>
        },
        clearIntervalFn: () => undefined,
      }
    )

    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 0 } as ProgressEvent)
    xhr.upload.onload?.({} as ProgressEvent)
    now = 0
    intervalHandler?.()
    xhr.onload?.()

    await expect(pending).resolves.toMatchObject({
      ok: true,
      data: {},
      text: '',
    })
    expect(events).toEqual(['upload:0', 'wait:0'])
  })

  it('rejects invalid JSON responses', async () => {
    const xhr = new FakeXMLHttpRequest()
    xhr.responseText = 'not-json'
    const pending = runAsrTranscription(
      new File(['audio'], 'test.mp3'),
      normalizeAsrRunSettings(buildSettings()),
      {},
      { requestFactory: () => xhr as unknown as XMLHttpRequest }
    )

    xhr.onload?.()

    await expect(pending).rejects.toThrow('响应解析失败')
  })

  it('rejects with AbortError when the signal is already aborted before send', async () => {
    const xhr = new FakeXMLHttpRequest()
    const controller = new AbortController()
    controller.abort()

    const pending = runAsrTranscription(
      new File(['audio'], 'test.mp3'),
      normalizeAsrRunSettings(buildSettings()),
      {},
      {
        requestFactory: () => xhr as unknown as XMLHttpRequest,
        signal: controller.signal,
      }
    )

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(xhr.abortCount).toBe(1)
  })

  it('rejects with AbortError, calls xhr.abort, and stops the heartbeat when signal aborts mid-flight', async () => {
    const xhr = new FakeXMLHttpRequest()
    const controller = new AbortController()
    let clearedTimers = 0
    let intervalHandler: (() => void) | null = null

    const pending = runAsrTranscription(
      new File(['audio'], 'test.mp3'),
      normalizeAsrRunSettings(buildSettings()),
      {},
      {
        requestFactory: () => xhr as unknown as XMLHttpRequest,
        signal: controller.signal,
        setIntervalFn: (handler) => {
          intervalHandler = handler
          return 1 as unknown as ReturnType<typeof setInterval>
        },
        clearIntervalFn: () => {
          clearedTimers += 1
        },
      }
    )

    // simulate upload completion → heartbeat timer started
    xhr.upload.onload?.({} as ProgressEvent)
    expect(intervalHandler).not.toBeNull()

    controller.abort()

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(xhr.abortCount).toBe(1)
    expect(clearedTimers).toBe(1)
  })

  it('detaches the abort listener on successful response so later aborts are no-ops', async () => {
    const xhr = new FakeXMLHttpRequest()
    const controller = new AbortController()

    const pending = runAsrTranscription(
      new File(['audio'], 'test.mp3'),
      normalizeAsrRunSettings(buildSettings()),
      {},
      {
        requestFactory: () => xhr as unknown as XMLHttpRequest,
        signal: controller.signal,
      }
    )

    xhr.onload?.()
    await expect(pending).resolves.toMatchObject({ ok: true })

    controller.abort()
    expect(xhr.abortCount).toBe(0)
  })
})
