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
})
