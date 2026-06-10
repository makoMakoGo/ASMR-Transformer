import { describe, expect, it } from 'vitest'
import { type AsrRunSettings } from '@/lib/asr-transcription'
import {
  runTranscription,
  type RemoteAudioForAsrFetcher,
  type TranscriptionRunLogEntry,
  type TranscriptionRunStatePatch,
} from '@/lib/transcription-run'

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

const buildSettings = (overrides: Partial<AsrRunSettings> = {}): AsrRunSettings => ({
  apiKey: ' key ',
  apiUrl: ' https://asr.example/v1/audio/transcriptions ',
  model: ' whisper-large ',
  ...overrides,
})

const buildFile = (): File => new File(['audio'], 'sample.mp3', { type: 'audio/mpeg' })

const collectRunEvents = () => {
  const states: TranscriptionRunStatePatch[] = []
  const logs: TranscriptionRunLogEntry[] = []

  return {
    states,
    logs,
    callbacks: {
      onState: (patch: TranscriptionRunStatePatch) => {
        states.push(patch)
      },
      onLog: (entry: TranscriptionRunLogEntry) => {
        logs.push(entry)
      },
    },
  }
}

describe('runTranscription', () => {
  it('emits start, upload, heartbeat, and success state for a local ASR run', async () => {
    const xhr = new FakeXMLHttpRequest()
    const events = collectRunEvents()
    let now = 0
    let intervalHandler: (() => void) | null = null

    const pending = runTranscription({ source: 'local', file: buildFile() }, buildSettings(), events.callbacks, {
      requestFactory: () => xhr as unknown as XMLHttpRequest,
      now: () => now,
      setIntervalFn: (handler) => {
        intervalHandler = handler
        return 1 as unknown as ReturnType<typeof setInterval>
      },
      clearIntervalFn: () => undefined,
    })

    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 25, total: 100 } as ProgressEvent)
    xhr.upload.onload?.({} as ProgressEvent)
    now = 10000
    intervalHandler?.()
    intervalHandler?.()
    xhr.onload?.()

    await expect(pending).resolves.toMatchObject({
      kind: 'success',
      result: { kind: 'success', text: 'ok' },
      status: 'done',
      statusMessage: '转录完成',
      uploadProgress: 25,
    })
    expect(events.states[0]).toMatchObject({
      result: { kind: 'idle' },
      uploadProgress: 0,
      status: 'processing',
      statusMessage: '正在上传文件...',
    })
    expect(events.states).toContainEqual({
      uploadProgress: 25,
      statusMessage: '正在上传 25 B / 100 B',
    })
    expect(events.states).toContainEqual({
      status: 'transcribing',
      statusMessage: '正在识别语音... 已等待 0s',
    })
    expect(events.logs).toContainEqual({ message: '上传进度: 25%', type: 'info' })
    expect(events.logs).toContainEqual({ message: '上传完成，正在识别语音...', type: 'success' })
    expect(events.logs.filter((entry) => entry.message === '仍在识别中... 已等待 10s')).toHaveLength(1)
    expect(events.logs).toContainEqual({ message: '转录成功! 文本长度: 2 字符', type: 'success' })
  })

  it('handles missing callbacks without throwing', async () => {
    const xhr = new FakeXMLHttpRequest()
    const pending = runTranscription({ source: 'local', file: buildFile() }, buildSettings(), undefined, {
      requestFactory: () => xhr as unknown as XMLHttpRequest,
    })

    xhr.onload?.()

    await expect(pending).resolves.toMatchObject({
      kind: 'success',
      result: { kind: 'success', text: 'ok' },
      status: 'done',
      statusMessage: '转录完成',
    })
  })

  it('returns an empty result when ASR succeeds without text', async () => {
    const xhr = new FakeXMLHttpRequest()
    xhr.responseText = '{"text":"   "}'
    const events = collectRunEvents()
    const pending = runTranscription({ source: 'local', file: buildFile() }, buildSettings(), events.callbacks, {
      requestFactory: () => xhr as unknown as XMLHttpRequest,
    })

    xhr.onload?.()

    await expect(pending).resolves.toMatchObject({
      kind: 'empty',
      result: { kind: 'empty' },
      status: 'done',
      statusMessage: '转录完成（无文本）',
    })
    expect(events.logs).toContainEqual({ message: '转录完成，但服务未返回文本', type: 'warning' })
  })

  it('formats non-2xx ASR API responses as run errors', async () => {
    const xhr = new FakeXMLHttpRequest()
    xhr.status = 401
    xhr.responseText = '{"error":"bad key"}'
    const events = collectRunEvents()
    const pending = runTranscription({ source: 'local', file: buildFile() }, buildSettings(), events.callbacks, {
      requestFactory: () => xhr as unknown as XMLHttpRequest,
    })

    xhr.onload?.()

    await expect(pending).resolves.toMatchObject({
      kind: 'error',
      result: { kind: 'error', message: '错误: 401 - {"error":"bad key"}' },
      status: 'error',
      statusMessage: '转录失败',
    })
    expect(events.logs).toContainEqual({ message: 'API 错误: {"error":"bad key"}', type: 'error' })
  })

  it('maps request failures into error state and logs', async () => {
    const xhr = new FakeXMLHttpRequest()
    const events = collectRunEvents()
    const pending = runTranscription({ source: 'local', file: buildFile() }, buildSettings(), events.callbacks, {
      requestFactory: () => xhr as unknown as XMLHttpRequest,
    })

    xhr.onerror?.()

    await expect(pending).resolves.toMatchObject({
      kind: 'error',
      result: { kind: 'error', message: '请求失败: 网络错误' },
      status: 'error',
      statusMessage: '请求失败',
    })
    expect(events.logs).toContainEqual({ message: '请求失败: 网络错误', type: 'error' })
  })

  it('maps aborts into idle state without surfacing a request error', async () => {
    const xhr = new FakeXMLHttpRequest()
    const controller = new AbortController()
    const events = collectRunEvents()
    const pending = runTranscription({ source: 'local', file: buildFile() }, buildSettings(), events.callbacks, {
      requestFactory: () => xhr as unknown as XMLHttpRequest,
      signal: controller.signal,
    })

    controller.abort()

    await expect(pending).resolves.toMatchObject({
      kind: 'aborted',
      status: 'idle',
      statusMessage: '',
    })
    expect(xhr.abortCount).toBe(1)
    expect(events.logs).toContainEqual({ message: '转录已取消', type: 'info' })
    expect(events.logs.some((entry) => entry.message.startsWith('请求失败'))).toBe(false)
  })

  it('fetches remote audio before entering the shared ASR run', async () => {
    const xhr = new FakeXMLHttpRequest()
    const events = collectRunEvents()
    const fetchRemoteAudio: RemoteAudioForAsrFetcher = async (url, options) => {
      expect(url).toBe('https://www.asmrgay.com/asmr/123')
      expect(options.maxAudioBytes).toBe(100)
      options.onProgress?.({ type: 'download-start', fileName: 'remote.mp3', totalBytes: 4 })
      options.onProgress?.({ type: 'download-progress', receivedBytes: 4, totalBytes: 4, percent: 100 })
      options.onProgress?.({ type: 'download-complete', receivedBytes: 4 })
      return new File(['data'], 'remote.mp3', { type: 'audio/mpeg' })
    }

    const pending = runTranscription(
      {
        source: 'remote',
        url: 'https://www.asmrgay.com/asmr/123',
        maxAudioBytes: 100,
        fetchRemoteAudio,
      },
      buildSettings(),
      events.callbacks,
      { requestFactory: () => xhr as unknown as XMLHttpRequest }
    )

    await Promise.resolve()
    xhr.upload.onload?.({} as ProgressEvent)
    xhr.onload?.()

    await expect(pending).resolves.toMatchObject({
      kind: 'success',
      result: { kind: 'success', text: 'ok' },
      status: 'done',
      statusMessage: '转录完成',
    })
    expect(events.states[0]).toMatchObject({
      result: { kind: 'idle' },
      uploadProgress: 0,
      status: 'processing',
      statusMessage: '正在连接音频源...',
    })
    expect(events.states).toContainEqual({ statusMessage: '正在下载 remote.mp3...' })
    expect(events.states).toContainEqual({ uploadProgress: 100, statusMessage: '正在下载 4 B / 4 B' })
    expect(events.states).toContainEqual({ uploadProgress: 0, statusMessage: '正在上传到识别服务...' })
    expect(events.logs).toContainEqual({
      message: '开始从链接导入音频: https://www.asmrgay.com/asmr/123',
      type: 'info',
    })
    expect(events.logs).toContainEqual({ message: '下载完成: 4 B', type: 'success' })
    expect(events.logs).toContainEqual({ message: '开始上传到 ASR 服务...', type: 'info' })
    expect(events.logs).toContainEqual({ message: '开始处理文件: remote.mp3', type: 'info' })
  })

  it('maps remote download failures into import errors before ASR starts', async () => {
    const events = collectRunEvents()
    const fetchRemoteAudio: RemoteAudioForAsrFetcher = async () => {
      throw new Error('source unavailable')
    }

    await expect(
      runTranscription(
        {
          source: 'remote',
          url: 'https://www.asmrgay.com/asmr/123',
          maxAudioBytes: 100,
          fetchRemoteAudio,
        },
        buildSettings(),
        events.callbacks
      )
    ).resolves.toMatchObject({
      kind: 'error',
      result: { kind: 'error', message: '请求失败: source unavailable' },
      status: 'error',
      statusMessage: '导入失败',
    })
    expect(events.logs).toContainEqual({ message: '导入失败: source unavailable', type: 'error' })
  })

  it('keeps ASR API failures on the shared transcription error path after remote fetch', async () => {
    const xhr = new FakeXMLHttpRequest()
    xhr.status = 401
    xhr.responseText = '{"error":"bad key"}'
    const events = collectRunEvents()
    const fetchRemoteAudio: RemoteAudioForAsrFetcher = async () =>
      new File(['data'], 'remote.mp3', { type: 'audio/mpeg' })

    const pending = runTranscription(
      {
        source: 'remote',
        url: 'https://www.asmrgay.com/asmr/123',
        maxAudioBytes: 100,
        fetchRemoteAudio,
      },
      buildSettings(),
      events.callbacks,
      { requestFactory: () => xhr as unknown as XMLHttpRequest }
    )

    await Promise.resolve()
    xhr.onload?.()

    await expect(pending).resolves.toMatchObject({
      kind: 'error',
      result: { kind: 'error', message: '错误: 401 - {"error":"bad key"}' },
      status: 'error',
      statusMessage: '转录失败',
    })
    expect(events.logs).toContainEqual({ message: 'API 错误: {"error":"bad key"}', type: 'error' })
  })

  it('passes the run abort signal into remote fetch and maps aborts consistently', async () => {
    const controller = new AbortController()
    const events = collectRunEvents()
    let forwardedSignal: AbortSignal | undefined
    const fetchRemoteAudio: RemoteAudioForAsrFetcher = async (_url, options) => {
      forwardedSignal = options.signal
      return new Promise((_resolve, reject) => {
        options.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true }
        )
      })
    }

    const pending = runTranscription(
      {
        source: 'remote',
        url: 'https://www.asmrgay.com/asmr/123',
        maxAudioBytes: 100,
        fetchRemoteAudio,
      },
      buildSettings(),
      events.callbacks,
      { signal: controller.signal }
    )

    controller.abort()

    await expect(pending).resolves.toMatchObject({
      kind: 'aborted',
      status: 'idle',
      statusMessage: '',
    })
    expect(forwardedSignal).toBe(controller.signal)
    expect(events.logs).toContainEqual({ message: '转录已取消', type: 'info' })
    expect(events.logs.some((entry) => entry.message.startsWith('导入失败'))).toBe(false)
  })

  it('maps Error-shaped AbortError failures consistently', async () => {
    const events = collectRunEvents()
    const fetchRemoteAudio: RemoteAudioForAsrFetcher = async () => {
      const error = new Error('aborted')
      error.name = 'AbortError'
      throw error
    }

    await expect(
      runTranscription(
        {
          source: 'remote',
          url: 'https://www.asmrgay.com/asmr/123',
          maxAudioBytes: 100,
          fetchRemoteAudio,
        },
        buildSettings(),
        events.callbacks
      )
    ).resolves.toMatchObject({
      kind: 'aborted',
      status: 'idle',
      statusMessage: '',
    })
    expect(events.logs).toContainEqual({ message: '转录已取消', type: 'info' })
    expect(events.logs.some((entry) => entry.message.startsWith('导入失败'))).toBe(false)
  })
})
