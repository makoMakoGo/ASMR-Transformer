'use client'

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { DEFAULT_FETCH_AUDIO_MAX_BYTES } from '@/lib/runtime-config-constants'
import { formatFileSize } from '@/lib/file-size'
import { readJsonResponse, readResponseErrorMessage } from '@/lib/http-response'
import type { Settings } from '@/lib/app-settings'
import { hasAsrApiKey } from '@/lib/asr-transcription'
import {
  runTranscription,
  type TranscriptionRunInput,
  type TranscriptionRunStatePatch,
} from '@/lib/transcription-run'
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

  const prepareRun = (skipClearLogs = false) => {
    if (!skipClearLogs) clearLogs()
    onRunStarted?.()
    setLoading(true)
    setCopied(false)
  }

  const setFlowError = (message: string, nextStatusMessage: string) => {
    setTranscriptionResult({ kind: 'error', message })
    setStatus('error')
    setStatusMessage(nextStatusMessage)
  }

  const applyTranscriptionRunState = (patch: TranscriptionRunStatePatch) => {
    if (patch.result) setTranscriptionResult(patch.result)
    if (typeof patch.uploadProgress === 'number') setUploadProgress(patch.uploadProgress)
    if (patch.status) setStatus(patch.status)
    if (typeof patch.statusMessage === 'string') setStatusMessage(patch.statusMessage)
  }

  const runSelectedTranscription = async (
    input: TranscriptionRunInput,
    missingApiKeyStatusMessage: string,
    skipClearLogs = false
  ) => {
    if (!hasAsrApiKey(settings)) {
      setFlowError('请先填写 API Key', missingApiKeyStatusMessage)
      addLog('错误: 未填写 API Key', 'error')
      return
    }

    const previousController = transcribeAbortRef.current
    previousController?.abort()
    const controller = new AbortController()
    transcribeAbortRef.current = controller
    const isCurrentRun = () => transcribeAbortRef.current === controller

    prepareRun(skipClearLogs)
    if (previousController) addLog('已取消上一次转录请求', 'info')

    try {
      await runTranscription(input, settings, {
        onState: (patch) => {
          if (!isCurrentRun()) return
          applyTranscriptionRunState(patch)
        },
        onLog: ({ message, type }) => {
          if (!isCurrentRun()) return
          addLog(message, type)
        },
      }, { signal: controller.signal })
    } finally {
      if (!isCurrentRun()) return
      transcribeAbortRef.current = null
      setLoading(false)
    }
  }

  const transcribe = async (file: File, skipClearLogs = false) => {
    await runSelectedTranscription({ source: 'local', file }, '转录失败', skipClearLogs)
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

    await runSelectedTranscription(
      {
        source: 'remote',
        url,
        maxAudioBytes: fetchAudioMaxBytes,
      },
      '导入失败'
    )
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
