import { normalizeSettingsForStorage, type Settings } from '@/lib/app-settings'

export type AsrRunSettings = Pick<Settings, 'apiKey' | 'apiUrl' | 'model'>

export type AsrUploadProgress = {
  loaded: number
  total: number
  percent: number
  shouldLog: boolean
}

export type AsrWaitHeartbeat = {
  elapsedSeconds: number
  shouldLog: boolean
}

export type AsrTranscriptionResponse = {
  ok: boolean
  status: number
  data: Record<string, unknown>
  text: string
}

export type AsrTranscriptionCallbacks = {
  onUploadProgress?: (progress: AsrUploadProgress) => void
  onUploadComplete?: () => void
  onWaitHeartbeat?: (heartbeat: AsrWaitHeartbeat) => void
}

export type AsrRequestFactory = () => XMLHttpRequest

type TimerId = ReturnType<typeof setInterval>
type SetIntervalFn = (handler: () => void, timeout: number) => TimerId
type ClearIntervalFn = (id: TimerId) => void

export type AsrTranscriptionOptions = {
  requestFactory?: AsrRequestFactory
  setIntervalFn?: SetIntervalFn
  clearIntervalFn?: ClearIntervalFn
  now?: () => number
  timeoutMs?: number
}

export const normalizeAsrRunSettings = (settings: Settings): AsrRunSettings => {
  const normalized = normalizeSettingsForStorage(settings)
  return {
    apiKey: normalized.apiKey,
    apiUrl: normalized.apiUrl,
    model: normalized.model,
  }
}

export const hasAsrApiKey = (settings: Settings): boolean =>
  normalizeAsrRunSettings(settings).apiKey.length > 0

export const formatAsrApiErrorMessage = (response: AsrTranscriptionResponse): string =>
  `错误: ${response.status} - ${JSON.stringify(response.data)}`

export const runAsrTranscription = async (
  file: File,
  settings: AsrRunSettings,
  callbacks: AsrTranscriptionCallbacks = {},
  options: AsrTranscriptionOptions = {}
): Promise<AsrTranscriptionResponse> => {
  const {
    requestFactory = () => new XMLHttpRequest(),
    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval,
    now = Date.now,
    timeoutMs = 300000,
  } = options
  const formData = new FormData()
  formData.append('file', file)
  formData.append('model', settings.model)

  const xhr = requestFactory()
  return new Promise<AsrTranscriptionResponse>((resolve, reject) => {
    let waitTimer: TimerId | null = null
    const stopWaitTimer = () => {
      if (waitTimer !== null) {
        clearIntervalFn(waitTimer)
        waitTimer = null
      }
    }

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return

      const percent = event.total > 0 ? Math.round((event.loaded / event.total) * 100) : 0
      callbacks.onUploadProgress?.({
        loaded: event.loaded,
        total: event.total,
        percent,
        shouldLog: percent % 25 === 0 || percent === 100,
      })
    }

    xhr.upload.onload = () => {
      callbacks.onUploadComplete?.()
      const startedAt = now()
      let lastHeartbeat = 0
      waitTimer = setIntervalFn(() => {
        const elapsedSeconds = Math.max(0, Math.floor((now() - startedAt) / 1000))
        const shouldLog = elapsedSeconds > 0 && elapsedSeconds % 10 === 0 && elapsedSeconds !== lastHeartbeat
        if (shouldLog) lastHeartbeat = elapsedSeconds
        callbacks.onWaitHeartbeat?.({ elapsedSeconds, shouldLog })
      }, 1000)
    }

    xhr.onload = () => {
      stopWaitTimer()
      try {
        const parsed = JSON.parse(xhr.responseText)
        const data = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? parsed as Record<string, unknown>
          : {}
        resolve({
          ok: xhr.status >= 200 && xhr.status < 300,
          status: xhr.status,
          data,
          text: typeof data.text === 'string' ? data.text : '',
        })
      } catch {
        reject(new Error('响应解析失败'))
      }
    }

    xhr.onerror = () => {
      stopWaitTimer()
      reject(new Error('网络错误'))
    }
    xhr.ontimeout = () => {
      stopWaitTimer()
      reject(new Error('请求超时'))
    }

    xhr.open('POST', settings.apiUrl)
    xhr.setRequestHeader('Authorization', `Bearer ${settings.apiKey}`)
    xhr.timeout = timeoutMs
    xhr.send(formData)
  })
}
