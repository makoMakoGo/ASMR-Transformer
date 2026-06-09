'use client'

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { DEFAULT_FETCH_AUDIO_MAX_BYTES } from '@/lib/runtime-config'
import { formatFileSize } from '@/lib/file-size'
import { readJsonResponse, readResponseErrorMessage } from '@/lib/http-response'
import type { Settings } from '@/lib/app-settings'
import { fetchRemoteAudioForAsr, type RemoteAudioFetchEvent } from '@/lib/browser-remote-audio'
import {
  formatAsrApiErrorMessage,
  normalizeAsrRunSettings,
  runAsrTranscription,
} from '@/lib/asr-transcription'
import {
  getTranscriptionDisplayText,
  IDLE_TRANSCRIPTION_RESULT,
  type ProcessingStatus,
  type TranscriptionResult,
} from '@/lib/transcription-state'
import type { AddLog } from '@/hooks/use-activity-log'

export type AudioInfo = {
  name: string
  size: number
  type: string
  source: 'local' | 'remote'
  url?: string
}

type CheckAudioResponse = {
  success?: boolean
  name?: string
  size?: number
  type?: string
  error?: string
}

type RuntimeConfigResponse = {
  fetchAudioMaxBytes?: unknown
}

export const useTranscriptionFlow = ({
  settings,
  addLog,
  clearLogs,
  onRunStarted,
}: {
  settings: Settings
  addLog: AddLog
  clearLogs: () => void
  onRunStarted?: () => void
}) => {
  const [transcriptionResult, setTranscriptionResult] = useState<TranscriptionResult>(IDLE_TRANSCRIPTION_RESULT)
  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [status, setStatus] = useState<ProcessingStatus>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [audioInfo, setAudioInfo] = useState<AudioInfo | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [audioUrlInput, setAudioUrlInput] = useState('')
  const [checking, setChecking] = useState(false)
  const [fetchAudioMaxBytes, setFetchAudioMaxBytes] = useState(DEFAULT_FETCH_AUDIO_MAX_BYTES)
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const transcribeAbortRef = useRef<AbortController | null>(null)

  useEffect(() => () => transcribeAbortRef.current?.abort(), [])

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/runtime-config', { method: 'GET' })
        const { data } = await readJsonResponse<RuntimeConfigResponse>(res)
        if (!res.ok) {
          throw new Error(readResponseErrorMessage(res, data))
        }

        const maxBytes = Number(data?.fetchAudioMaxBytes)
        if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
          throw new Error('fetchAudioMaxBytes 无效')
        }

        setFetchAudioMaxBytes(Math.trunc(maxBytes))
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        addLog(
          `加载运行时配置失败，继续使用默认音频大小限制 ${formatFileSize(DEFAULT_FETCH_AUDIO_MAX_BYTES)}: ${msg}`,
          'warning'
        )
      }
    })()
  }, [addLog])

  const beginRun = (nextStatusMessage: string, skipClearLogs = false) => {
    if (!skipClearLogs) clearLogs()
    onRunStarted?.()
    setLoading(true)
    setCopied(false)
    setTranscriptionResult(IDLE_TRANSCRIPTION_RESULT)
    setUploadProgress(0)
    setStatus('processing')
    setStatusMessage(nextStatusMessage)
  }

  const setFlowError = (message: string, nextStatusMessage: string) => {
    setTranscriptionResult({ kind: 'error', message })
    setStatus('error')
    setStatusMessage(nextStatusMessage)
  }

  const finishTranscription = (text: string) => {
    if (text.trim()) {
      setTranscriptionResult({ kind: 'success', text })
      setStatus('done')
      setStatusMessage('转录完成')
      addLog(`转录成功! 文本长度: ${text.length} 字符`, 'success')
      return
    }

    setTranscriptionResult({ kind: 'empty' })
    setStatus('done')
    setStatusMessage('转录完成（无文本）')
    addLog('转录完成，但服务未返回文本', 'warning')
  }

  const transcribe = async (file: File, skipClearLogs = false) => {
    const effectiveSettings = normalizeAsrRunSettings(settings)
    if (!effectiveSettings.apiKey) {
      setFlowError('请先填写 API Key', '转录失败')
      addLog('错误: 未填写 API Key', 'error')
      return
    }

    const previousController = transcribeAbortRef.current
    previousController?.abort()
    const controller = new AbortController()
    transcribeAbortRef.current = controller
    const isCurrentRun = () => transcribeAbortRef.current === controller
    let lastHeartbeat = 0

    beginRun('正在上传到识别服务...', skipClearLogs)
    if (previousController) addLog('已取消上一次转录请求', 'info')
    addLog(`开始处理文件: ${file.name}`, 'info')
    addLog(`文件大小: ${formatFileSize(file.size)}`, 'info')
    addLog(`目标 API: ${effectiveSettings.apiUrl}`, 'info')
    addLog(`使用模型: ${effectiveSettings.model}`, 'info')

    try {
      addLog('正在上传文件...', 'info')
      setStatusMessage('正在上传文件...')

      const response = await runAsrTranscription(file, effectiveSettings, {
        onUploadProgress: (progress) => {
          if (!isCurrentRun()) return
          setUploadProgress(progress.percent)
          setStatusMessage(`正在上传 ${formatFileSize(progress.loaded)} / ${formatFileSize(progress.total)}`)
          if (progress.percent % 25 === 0 || progress.percent === 100) {
            addLog(`上传进度: ${progress.percent}%`, 'info')
          }
        },
        onUploadComplete: () => {
          if (!isCurrentRun()) return
          setStatus('transcribing')
          setStatusMessage('正在识别语音... 已等待 0s')
          addLog('上传完成，正在识别语音...', 'success')
        },
        onWaitHeartbeat: (heartbeat) => {
          if (!isCurrentRun()) return
          setStatusMessage(`正在识别语音... 已等待 ${heartbeat.elapsedSeconds}s`)
          const shouldLog =
            heartbeat.elapsedSeconds > 0 &&
            heartbeat.elapsedSeconds % 10 === 0 &&
            heartbeat.elapsedSeconds !== lastHeartbeat
          if (shouldLog) {
            lastHeartbeat = heartbeat.elapsedSeconds
            addLog(`仍在识别中... 已等待 ${heartbeat.elapsedSeconds}s`, 'info')
          }
        },
      }, { signal: controller.signal })

      if (!isCurrentRun()) return

      if (!response.ok) {
        const errorMessage = formatAsrApiErrorMessage(response)
        setFlowError(errorMessage, '转录失败')
        addLog(`API 错误: ${JSON.stringify(response.data)}`, 'error')
        return
      }

      finishTranscription(response.text)
    } catch (e) {
      if (!isCurrentRun()) return

      if (e instanceof DOMException && e.name === 'AbortError') {
        addLog('转录已取消', 'info')
        setStatus('idle')
        setStatusMessage('')
        return
      }
      const errorMsg = e instanceof Error ? e.message : String(e)
      setFlowError(`请求失败: ${errorMsg}`, '请求失败')
      addLog(`请求失败: ${errorMsg}`, 'error')
    } finally {
      if (isCurrentRun()) {
        transcribeAbortRef.current = null
        setLoading(false)
      }
    }
  }

  const importFromUrl = async (urlOverride?: string) => {
    const url = String(urlOverride ?? audioUrlInput).trim()
    if (!url) {
      addLog('请输入音频链接', 'error')
      return
    }

    try {
      const parsed = new URL(url)
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        addLog('仅支持 http/https 链接', 'error')
        return
      }
    } catch {
      addLog('请输入有效的音频链接', 'error')
      return
    }

    if (!normalizeAsrRunSettings(settings).apiKey) {
      setFlowError('请先填写 API Key', '导入失败')
      addLog('错误: 未填写 API Key', 'error')
      return
    }

    beginRun('正在连接音频源...')
    addLog(`开始从链接导入音频: ${url}`, 'info')

    try {
      const handleRemoteAudioFetchEvent = (event: RemoteAudioFetchEvent) => {
        if (event.type === 'download-start') {
          const totalLabel = event.totalBytes === null ? '未知大小' : formatFileSize(event.totalBytes)
          addLog(`开始下载: ${event.fileName} (${totalLabel})`, 'info')
          setStatusMessage(`正在下载 ${event.fileName}...`)
          return
        }

        if (event.type === 'download-progress') {
          if (event.totalBytes !== null && event.percent !== null) {
            setUploadProgress(event.percent)
            setStatusMessage(
              `正在下载 ${formatFileSize(event.receivedBytes)} / ${formatFileSize(event.totalBytes)}`
            )
            if (event.percent % 25 === 0) {
              addLog(`下载进度: ${event.percent}%`, 'info')
            }
            return
          }

          setStatusMessage(`已下载 ${formatFileSize(event.receivedBytes)}`)
          return
        }

        addLog(`下载完成: ${formatFileSize(event.receivedBytes)}`, 'success')
      }

      const audioFile = await fetchRemoteAudioForAsr(url, {
        maxAudioBytes: fetchAudioMaxBytes,
        onProgress: handleRemoteAudioFetchEvent,
      })

      setUploadProgress(0)
      setStatusMessage('正在上传到识别服务...')
      addLog('开始上传到 ASR 服务...', 'info')
      await transcribe(audioFile, true)
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e)
      setFlowError(`请求失败: ${errorMsg}`, '导入失败')
      addLog(`导入失败: ${errorMsg}`, 'error')
      setLoading(false)
    }
  }

  const handleFileSelect = (file: File): void => {
    setSelectedFile(file)
    setAudioUrlInput('')
    setAudioInfo({
      name: file.name,
      size: file.size,
      type: file.type || 'audio/unknown',
      source: 'local',
    })
    addLog(`已选择文件: ${file.name} (${formatFileSize(file.size)})`, 'info')
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]
    if (!file) return

    handleFileSelect(file)
  }

  const checkAudioUrl = async () => {
    const url = audioUrlInput.trim()
    if (!url) {
      addLog('请输入音频链接', 'error')
      return
    }

    try {
      new URL(url)
    } catch {
      addLog('请输入有效的 URL', 'error')
      return
    }

    setChecking(true)
    addLog(`正在检查链接: ${url}`, 'info')

    try {
      const res = await fetch('/api/check-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const { data } = await readJsonResponse<CheckAudioResponse>(res)

      if (res.ok && data?.success && typeof data.name === 'string' && typeof data.size === 'number' && typeof data.type === 'string') {
        setSelectedFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
        setAudioInfo({
          name: data.name,
          size: data.size,
          type: data.type,
          source: 'remote',
          url,
        })
        addLog(`检查通过: ${data.name} (${formatFileSize(data.size)})`, 'success')
        return
      }

      addLog(`检查失败: ${readResponseErrorMessage(res, data)}`, 'error')
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e)
      addLog(`检查失败: ${errorMsg}`, 'error')
    } finally {
      setChecking(false)
    }
  }

  const clearAudio = () => {
    setSelectedFile(null)
    setAudioInfo(null)
    setAudioUrlInput('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    setStatus('idle')
    setStatusMessage('')
    addLog('已清除所选音频', 'info')
  }

  const startTranscribe = () => {
    if (!audioInfo) return
    if (audioInfo.source === 'local' && selectedFile) {
      void transcribe(selectedFile)
      return
    }
    if (audioInfo.source === 'remote' && audioInfo.url) {
      void importFromUrl(audioInfo.url)
    }
  }

  const cancelTranscription = () => {
    transcribeAbortRef.current?.abort()
  }

  const copyTranscription = async () => {
    const text = getTranscriptionDisplayText(transcriptionResult)
    if (!text) return

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      addLog('原始结果已复制到剪贴板', 'success')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      addLog('复制失败', 'error')
    }
  }

  return {
    transcriptionResult,
    loading,
    uploadProgress,
    status,
    statusMessage,
    audioInfo,
    selectedFile,
    audioUrlInput,
    checking,
    fetchAudioMaxBytes,
    copied,
    fileInputRef,
    setAudioUrlInput,
    handleFileSelect,
    handleFileChange,
    checkAudioUrl,
    clearAudio,
    startTranscribe,
    importFromUrl,
    cancelTranscription,
    copyTranscription,
  }
}
