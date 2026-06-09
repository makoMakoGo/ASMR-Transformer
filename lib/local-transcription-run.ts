import { formatAsrApiErrorMessage, normalizeAsrRunSettings, runAsrTranscription } from '@/lib/asr-transcription'
import type { AsrRunSettings, AsrTranscriptionOptions } from '@/lib/asr-transcription'
import { formatFileSize } from '@/lib/file-size'
import {
  IDLE_TRANSCRIPTION_RESULT,
  type ProcessingStatus,
  type TranscriptionResult,
} from '@/lib/transcription-state'

export type LocalTranscriptionRunLogEntry = {
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
}

export type LocalTranscriptionRunState = {
  result: TranscriptionResult
  uploadProgress: number
  status: ProcessingStatus
  statusMessage: string
}

export type LocalTranscriptionRunStatePatch = Partial<LocalTranscriptionRunState>

export type LocalTranscriptionRunCallbacks = {
  onState?: (patch: LocalTranscriptionRunStatePatch) => void
  onLog?: (entry: LocalTranscriptionRunLogEntry) => void
}

export type LocalTranscriptionRunResult = LocalTranscriptionRunState & {
  kind: 'success' | 'empty' | 'error' | 'aborted'
}

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError'

export const runLocalTranscription = async (
  file: File,
  settings: AsrRunSettings,
  callbacks: LocalTranscriptionRunCallbacks = {},
  options: AsrTranscriptionOptions = {}
): Promise<LocalTranscriptionRunResult> => {
  const effectiveSettings = normalizeAsrRunSettings(settings)
  let state: LocalTranscriptionRunState = {
    result: IDLE_TRANSCRIPTION_RESULT,
    uploadProgress: 0,
    status: 'processing',
    statusMessage: '正在上传到识别服务...',
  }
  let lastHeartbeat = 0

  const emitState = (patch: LocalTranscriptionRunStatePatch) => {
    state = { ...state, ...patch }
    callbacks.onState?.(patch)
  }
  const emitLog = (entry: LocalTranscriptionRunLogEntry) => callbacks.onLog?.(entry)
  const finish = (kind: LocalTranscriptionRunResult['kind']): LocalTranscriptionRunResult => ({
    ...state,
    kind,
  })

  emitState(state)
  emitLog({ message: `开始处理文件: ${file.name}`, type: 'info' })
  emitLog({ message: `文件大小: ${formatFileSize(file.size)}`, type: 'info' })
  emitLog({ message: `目标 API: ${effectiveSettings.apiUrl}`, type: 'info' })
  emitLog({ message: `使用模型: ${effectiveSettings.model}`, type: 'info' })
  emitLog({ message: '正在上传文件...', type: 'info' })
  emitState({ statusMessage: '正在上传文件...' })

  try {
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
  } catch (error) {
    if (isAbortError(error)) {
      emitState({
        status: 'idle',
        statusMessage: '',
      })
      emitLog({ message: '转录已取消', type: 'info' })
      return finish('aborted')
    }

    const errorMessage = error instanceof Error ? error.message : String(error)
    emitState({
      result: { kind: 'error', message: `请求失败: ${errorMessage}` },
      status: 'error',
      statusMessage: '请求失败',
    })
    emitLog({ message: `请求失败: ${errorMessage}`, type: 'error' })
    return finish('error')
  }
}
