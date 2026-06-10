import { formatAsrApiErrorMessage, normalizeAsrRunSettings, runAsrTranscription } from '@/lib/asr-transcription'
import type { AsrRunSettings, AsrTranscriptionOptions } from '@/lib/asr-transcription'
import {
  fetchRemoteAudioForAsr,
  type FetchRemoteAudioForAsrOptions,
  type RemoteAudioFetchEvent,
} from '@/lib/browser-remote-audio'
import { formatFileSize } from '@/lib/file-size'
import {
  IDLE_TRANSCRIPTION_RESULT,
  type ProcessingStatus,
  type TranscriptionResult,
} from '@/lib/transcription-state'

export type TranscriptionRunLogEntry = {
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
}

export type TranscriptionRunState = {
  result: TranscriptionResult
  uploadProgress: number
  status: ProcessingStatus
  statusMessage: string
}

export type TranscriptionRunStatePatch = Partial<TranscriptionRunState>

export type TranscriptionRunCallbacks = {
  onState?: (patch: TranscriptionRunStatePatch) => void
  onLog?: (entry: TranscriptionRunLogEntry) => void
}

export type TranscriptionRunResult = TranscriptionRunState & {
  kind: 'success' | 'empty' | 'error' | 'aborted'
}

export type RemoteAudioForAsrFetcher = (
  url: string,
  options: FetchRemoteAudioForAsrOptions
) => Promise<File>

export type TranscriptionRunInput =
  | {
      source: 'local'
      file: File
    }
  | {
      source: 'remote'
      url: string
      maxAudioBytes: number
      fetchRemoteAudio?: RemoteAudioForAsrFetcher
    }

type TranscriptionRunContext = {
  emitState: (patch: TranscriptionRunStatePatch) => void
  emitLog: (entry: TranscriptionRunLogEntry) => void
  finish: (kind: TranscriptionRunResult['kind']) => TranscriptionRunResult
}

const isAbortError = (error: unknown): boolean =>
  (error instanceof Error && error.name === 'AbortError') ||
  (
    typeof DOMException !== 'undefined' &&
    error instanceof DOMException &&
    error.name === 'AbortError'
  )

const createRunContext = (callbacks: TranscriptionRunCallbacks): TranscriptionRunContext => {
  let state: TranscriptionRunState = {
    result: IDLE_TRANSCRIPTION_RESULT,
    uploadProgress: 0,
    status: 'processing',
    statusMessage: '',
  }

  const emitState = (patch: TranscriptionRunStatePatch) => {
    state = { ...state, ...patch }
    callbacks.onState?.(patch)
  }

  return {
    emitState,
    emitLog: (entry) => callbacks.onLog?.(entry),
    finish: (kind) => ({
      ...state,
      kind,
    }),
  }
}

const emitRemoteFetchEvent = (
  event: RemoteAudioFetchEvent,
  { emitState, emitLog }: Pick<TranscriptionRunContext, 'emitState' | 'emitLog'>
) => {
  if (event.type === 'download-start') {
    const totalLabel = event.totalBytes === null ? '未知大小' : formatFileSize(event.totalBytes)
    emitLog({ message: `开始下载: ${event.fileName} (${totalLabel})`, type: 'info' })
    emitState({ statusMessage: `正在下载 ${event.fileName}...` })
    return
  }

  if (event.type === 'download-progress') {
    if (event.totalBytes !== null && event.percent !== null) {
      emitState({
        uploadProgress: event.percent,
        statusMessage: `正在下载 ${formatFileSize(event.receivedBytes)} / ${formatFileSize(event.totalBytes)}`,
      })
      if (event.percent % 25 === 0) {
        emitLog({ message: `下载进度: ${event.percent}%`, type: 'info' })
      }
      return
    }

    emitState({ statusMessage: `已下载 ${formatFileSize(event.receivedBytes)}` })
    return
  }

  emitLog({ message: `下载完成: ${formatFileSize(event.receivedBytes)}`, type: 'success' })
}

const runAsrFileTranscription = async (
  file: File,
  settings: AsrRunSettings,
  { emitState, emitLog, finish }: TranscriptionRunContext,
  options: AsrTranscriptionOptions
): Promise<TranscriptionRunResult> => {
  const effectiveSettings = normalizeAsrRunSettings(settings)
  let lastHeartbeat = 0

  emitState({
    result: IDLE_TRANSCRIPTION_RESULT,
    uploadProgress: 0,
    status: 'processing',
    statusMessage: '正在上传文件...',
  })
  emitLog({ message: `开始处理文件: ${file.name}`, type: 'info' })
  emitLog({ message: `文件大小: ${formatFileSize(file.size)}`, type: 'info' })
  emitLog({ message: `目标 API: ${effectiveSettings.apiUrl}`, type: 'info' })
  emitLog({ message: `使用模型: ${effectiveSettings.model}`, type: 'info' })
  emitLog({ message: '正在上传文件...', type: 'info' })

  const response = await runAsrTranscription(file, effectiveSettings, {
    onUploadProgress: (progress) => {
      emitState({
        uploadProgress: progress.percent,
        statusMessage: `正在上传 ${formatFileSize(progress.loaded)} / ${formatFileSize(progress.total)}`,
      })
      if (progress.percent % 25 === 0 || progress.percent === 100) {
        emitLog({ message: `上传进度: ${progress.percent}%`, type: 'info' })
      }
    },
    onUploadComplete: () => {
      emitState({
        status: 'transcribing',
        statusMessage: '正在识别语音... 已等待 0s',
      })
      emitLog({ message: '上传完成，正在识别语音...', type: 'success' })
    },
    onWaitHeartbeat: (heartbeat) => {
      emitState({ statusMessage: `正在识别语音... 已等待 ${heartbeat.elapsedSeconds}s` })
      const shouldLog =
        heartbeat.elapsedSeconds > 0 &&
        heartbeat.elapsedSeconds % 10 === 0 &&
        heartbeat.elapsedSeconds !== lastHeartbeat
      if (shouldLog) {
        lastHeartbeat = heartbeat.elapsedSeconds
        emitLog({ message: `仍在识别中... 已等待 ${heartbeat.elapsedSeconds}s`, type: 'info' })
      }
    },
  }, options)

  if (!response.ok) {
    const errorMessage = formatAsrApiErrorMessage(response)
    emitState({
      result: { kind: 'error', message: errorMessage },
      status: 'error',
      statusMessage: '转录失败',
    })
    emitLog({ message: `API 错误: ${JSON.stringify(response.data)}`, type: 'error' })
    return finish('error')
  }

  if (response.text.trim()) {
    emitState({
      result: { kind: 'success', text: response.text },
      status: 'done',
      statusMessage: '转录完成',
    })
    emitLog({ message: `转录成功! 文本长度: ${response.text.length} 字符`, type: 'success' })
    return finish('success')
  }

  emitState({
    result: { kind: 'empty' },
    status: 'done',
    statusMessage: '转录完成（无文本）',
  })
  emitLog({ message: '转录完成，但服务未返回文本', type: 'warning' })
  return finish('empty')
}

export const runTranscription = async (
  input: TranscriptionRunInput,
  settings: AsrRunSettings,
  callbacks: TranscriptionRunCallbacks = {},
  options: AsrTranscriptionOptions = {}
): Promise<TranscriptionRunResult> => {
  const context = createRunContext(callbacks)
  let requestFailureStatusMessage = '请求失败'
  let requestFailureLogPrefix = '请求失败'

  try {
    let file: File

    if (input.source === 'remote') {
      requestFailureStatusMessage = '导入失败'
      requestFailureLogPrefix = '导入失败'
      context.emitState({
        result: IDLE_TRANSCRIPTION_RESULT,
        uploadProgress: 0,
        status: 'processing',
        statusMessage: '正在连接音频源...',
      })
      context.emitLog({ message: `开始从链接导入音频: ${input.url}`, type: 'info' })

      const fetcher = input.fetchRemoteAudio ?? fetchRemoteAudioForAsr
      file = await fetcher(input.url, {
        maxAudioBytes: input.maxAudioBytes,
        onProgress: (event) => emitRemoteFetchEvent(event, context),
        signal: options.signal,
      })

      context.emitState({
        uploadProgress: 0,
        statusMessage: '正在上传到识别服务...',
      })
      context.emitLog({ message: '开始上传到 ASR 服务...', type: 'info' })
      requestFailureStatusMessage = '请求失败'
      requestFailureLogPrefix = '请求失败'
    } else {
      file = input.file
    }

    return await runAsrFileTranscription(file, settings, context, options)
  } catch (error) {
    if (isAbortError(error)) {
      context.emitState({
        status: 'idle',
        statusMessage: '',
      })
      context.emitLog({ message: '转录已取消', type: 'info' })
      return context.finish('aborted')
    }

    const errorMessage = error instanceof Error ? error.message : String(error)
    context.emitState({
      result: { kind: 'error', message: `请求失败: ${errorMessage}` },
      status: 'error',
      statusMessage: requestFailureStatusMessage,
    })
    context.emitLog({ message: `${requestFailureLogPrefix}: ${errorMessage}`, type: 'error' })
    return context.finish('error')
  }
}
