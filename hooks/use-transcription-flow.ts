'use client'

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { DEFAULT_FETCH_AUDIO_MAX_BYTES } from '@/lib/runtime-config'
import { formatFileSize } from '@/lib/file-size'
import { readJsonResponse, readResponseErrorMessage } from '@/lib/http-response'
import { normalizeSettingsForStorage, type Settings } from '@/lib/app-settings'
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
  resolvedUrl?: string
  error?: string
}

type RuntimeConfigResponse = {
  fetchAudioMaxBytes?: unknown
}

type ProxyErrorResponse = {
  error?: string
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
    const effectiveSettings = normalizeSettingsForStorage(settings)
    if (!effectiveSettings.apiKey) {
      setFlowError('请先填写 API Key', '转录失败')
      addLog('错误: 未填写 API Key', 'error')
      return
    }

    beginRun('正在上传到识别服务...', skipClearLogs)
    addLog(`开始处理文件: ${file.name}`, 'info')
    addLog(`文件大小: ${formatFileSize(file.size)}`, 'info')
    addLog(`目标 API: ${effectiveSettings.apiUrl}`, 'info')
    addLog(`使用模型: ${effectiveSettings.model}`, 'info')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('model', effectiveSettings.model)

    try {
      addLog('正在上传文件...', 'info')
      setStatusMessage('正在上传文件...')

      const xhr = new XMLHttpRequest()
      const response = await new Promise<{ ok: boolean; status: number; data: Record<string, unknown> }>((resolve, reject) => {
        let waitTimer: ReturnType<typeof setInterval> | null = null
        const stopWaitTimer = () => {
          if (waitTimer !== null) {
            clearInterval(waitTimer)
            waitTimer = null
          }
        }

        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return

          const percent = Math.round((event.loaded / event.total) * 100)
          setUploadProgress(percent)
          setStatusMessage(`正在上传 ${formatFileSize(event.loaded)} / ${formatFileSize(event.total)}`)
          if (percent % 25 === 0 || percent === 100) {
            addLog(`上传进度: ${percent}%`, 'info')
          }
        }

        xhr.upload.onload = () => {
          setStatus('transcribing')
          setStatusMessage('正在识别语音... 已等待 0s')
          addLog('上传完成，正在识别语音...', 'success')
          const startedAt = Date.now()
          let lastHeartbeat = 0
          waitTimer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startedAt) / 1000)
            setStatusMessage(`正在识别语音... 已等待 ${elapsed}s`)
            if (elapsed > 0 && elapsed % 10 === 0 && elapsed !== lastHeartbeat) {
              lastHeartbeat = elapsed
              addLog(`仍在识别中... 已等待 ${elapsed}s`, 'info')
            }
          }, 1000)
        }

        xhr.onload = () => {
          stopWaitTimer()
          try {
            const data = JSON.parse(xhr.responseText) as Record<string, unknown>
            resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data })
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

        xhr.open('POST', effectiveSettings.apiUrl)
        xhr.setRequestHeader('Authorization', `Bearer ${effectiveSettings.apiKey}`)
        xhr.timeout = 300000
        xhr.send(formData)
      })

      setStatus('transcribing')
      setStatusMessage('正在识别语音...')

      if (!response.ok) {
        const errorMessage = `错误: ${response.status} - ${JSON.stringify(response.data)}`
        setFlowError(errorMessage, '转录失败')
        addLog(`API 错误: ${JSON.stringify(response.data)}`, 'error')
        return
      }

      const text = typeof response.data.text === 'string' ? response.data.text : ''
      finishTranscription(text)
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e)
      setFlowError(`请求失败: ${errorMsg}`, '请求失败')
      addLog(`请求失败: ${errorMsg}`, 'error')
    } finally {
      setLoading(false)
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

    const effectiveSettings = normalizeSettingsForStorage(settings)
    if (!effectiveSettings.apiKey) {
      setFlowError('请先填写 API Key', '导入失败')
      addLog('错误: 未填写 API Key', 'error')
      return
    }

    beginRun('正在连接音频源...')
    addLog(`开始从链接导入音频: ${url}`, 'info')

    try {
      const proxyRes = await fetch('/api/proxy-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      const contentType = proxyRes.headers.get('content-type') || ''
      if (!proxyRes.ok || contentType.includes('application/json')) {
        const { data } = await readJsonResponse<ProxyErrorResponse>(proxyRes)
        throw new Error(readResponseErrorMessage(proxyRes, data))
      }

      const contentLength = proxyRes.headers.get('content-length')
      const totalSize = contentLength ? parseInt(contentLength, 10) : 0
      const fileNameHeader = proxyRes.headers.get('x-file-name')
      const fileName = (() => {
        if (!fileNameHeader) return '在线音频.mp3'
        try {
          return decodeURIComponent(fileNameHeader)
        } catch {
          return fileNameHeader
        }
      })()
      const mimeType = proxyRes.headers.get('content-type') || 'audio/mpeg'
      const clientMaxSizeBytes = fetchAudioMaxBytes

      if (totalSize > 0 && totalSize > clientMaxSizeBytes) {
        throw new Error(
          `文件过大 (${formatFileSize(totalSize)})，为避免浏览器崩溃已中止。最大支持 ${formatFileSize(clientMaxSizeBytes)}。`
        )
      }

      addLog(`开始下载: ${fileName} (${totalSize ? formatFileSize(totalSize) : '未知大小'})`, 'info')
      setStatusMessage(`正在下载 ${fileName}...`)

      const reader = proxyRes.body?.getReader()
      if (!reader) {
        throw new Error('无法读取音频数据流')
      }

      const chunks: ArrayBuffer[] = []
      let receivedLength = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (!value) continue

        chunks.push(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength))
        receivedLength += value.byteLength
        if (receivedLength > clientMaxSizeBytes) {
          await reader.cancel()
          throw new Error(
            `文件过大 (${formatFileSize(receivedLength)})，为避免浏览器崩溃已中止。最大支持 ${formatFileSize(clientMaxSizeBytes)}。`
          )
        }

        if (totalSize > 0) {
          const percent = Math.round((receivedLength / totalSize) * 100)
          setUploadProgress(percent)
          setStatusMessage(`正在下载 ${formatFileSize(receivedLength)} / ${formatFileSize(totalSize)}`)
          if (percent % 25 === 0) {
            addLog(`下载进度: ${percent}%`, 'info')
          }
        } else {
          setStatusMessage(`已下载 ${formatFileSize(receivedLength)}`)
        }
      }

      addLog(`下载完成: ${formatFileSize(receivedLength)}`, 'success')

      const audioBlob = new Blob(chunks, { type: mimeType })
      const audioFile = new File([audioBlob], fileName, { type: mimeType })

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
        const resolvedUrl = typeof data.resolvedUrl === 'string' ? data.resolvedUrl : url
        setSelectedFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
        setAudioInfo({
          name: data.name,
          size: data.size,
          type: data.type,
          source: 'remote',
          url: resolvedUrl,
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
    copyTranscription,
  }
}
