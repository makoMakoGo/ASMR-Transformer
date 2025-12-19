'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// 默认配置
const DEFAULT_ASR_API_URL = 'https://api.siliconflow.cn/v1/audio/transcriptions'
const DEFAULT_ASR_MODEL = 'TeleAI/TeleSpeechASR'
const DEFAULT_LLM_API_URL = 'https://juya.owl.ci/v1'
const DEFAULT_LLM_MODEL = 'DeepSeek-V3.1-Terminus'
const DEFAULT_LLM_API_KEY = 'sk-kUm2RSHxuRJyjdrzdwprHYFYwvE4NTkIzRoyyaiDoh7YyDIZ'
const DEFAULT_PROXY_URL = 'http://127.0.0.1:7890'
// 默认润色指令（用户可自定义）
const DEFAULT_INSTRUCTIONS =
  '请对以下语音转文字内容进行处理：1. 纠正错别字和语法错误 2. 添加适当的标点符号 3. 分段排版使内容更易读 4. 保持原意不变，不要添加或删除内容'

const STORAGE_KEY = 'voice-to-text-settings'

type Settings = {
  apiKey: string
  apiUrl: string
  model: string
  llmApiUrl: string
  llmModel: string
  llmApiKey: string
  customInstructions: string
  proxyUrl: string
}

type LogEntry = {
  time: string
  message: string
  type: 'info' | 'success' | 'error' | 'warning'
}

const getStoredSettings = (): Settings | null => {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

const saveSettings = (settings: Settings) => {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // ignore storage errors
  }
}

export default function Home() {
  const [apiKey, setApiKey] = useState('')
  const [apiUrl, setApiUrl] = useState(DEFAULT_ASR_API_URL)
  const [model, setModel] = useState(DEFAULT_ASR_MODEL)
  const [llmApiUrl, setLlmApiUrl] = useState(DEFAULT_LLM_API_URL)
  const [llmModel, setLlmModel] = useState(DEFAULT_LLM_MODEL)
  const [llmApiKey, setLlmApiKey] = useState('')
  const [customInstructions, setCustomInstructions] = useState(DEFAULT_INSTRUCTIONS)
  const [proxyUrl, setProxyUrl] = useState(DEFAULT_PROXY_URL)
  const [settingsLoaded, setSettingsLoaded] = useState(false)

  // Load settings from localStorage on mount
  useEffect(() => {
    const stored = getStoredSettings()
    if (stored) {
      setApiKey(stored.apiKey || '')
      setApiUrl(stored.apiUrl || DEFAULT_ASR_API_URL)
      setModel(stored.model || DEFAULT_ASR_MODEL)
      setLlmApiUrl(stored.llmApiUrl || DEFAULT_LLM_API_URL)
      setLlmModel(stored.llmModel || DEFAULT_LLM_MODEL)
      setLlmApiKey(stored.llmApiKey || '')
      setCustomInstructions(stored.customInstructions || DEFAULT_INSTRUCTIONS)
      setProxyUrl(stored.proxyUrl ?? DEFAULT_PROXY_URL)
    }
    setSettingsLoaded(true)
  }, [])

  // Save settings to localStorage when they change
  useEffect(() => {
    if (!settingsLoaded) return
    saveSettings({ apiKey, apiUrl, model, llmApiUrl, llmModel, llmApiKey, customInstructions, proxyUrl })
  }, [apiKey, apiUrl, model, llmApiUrl, llmModel, llmApiKey, customInstructions, proxyUrl, settingsLoaded])
  const [result, setResult] = useState('')
  const [polishedResult, setPolishedResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [polishing, setPolishing] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [status, setStatus] = useState<
    'idle' | 'uploading' | 'uploaded' | 'fetching-url' | 'transcribing' | 'done' | 'error'
  >('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [fileInfo, setFileInfo] = useState<{ name: string; size: string; type: string } | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [audioUrlInput, setAudioUrlInput] = useState('')
  const [copied, setCopied] = useState(false)
  const [copiedPolished, setCopiedPolished] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const logsContainerRef = useRef<HTMLDivElement>(null)

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    setLogs((prev) => [...prev, { time, message, type }])
    // 只在日志容器内滚动，不影响页面视口
    setTimeout(() => {
      if (logsContainerRef.current) {
        logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight
      }
    }, 100)
  }

  const clearLogs = () => setLogs([])

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }


  const polishText = async (text: string) => {
    if (!text) {
      addLog('无法润色: 缺少文本', 'error')
      return
    }

    const effectiveLlmApiKey = llmApiKey.trim() || DEFAULT_LLM_API_KEY
    const usingFallbackKey = llmApiKey.trim() === ''

    setPolishing(true)
    setPolishedResult('')
    const effectiveLlmApiUrl = llmApiUrl.trim() || DEFAULT_LLM_API_URL
    const effectiveLlmModel = llmModel.trim() || DEFAULT_LLM_MODEL

    addLog('开始文本润色...', 'info')
    addLog(`LLM API: ${effectiveLlmApiUrl}`, 'info')
    addLog(`LLM 模型: ${effectiveLlmModel}`, 'info')
    if (usingFallbackKey) {
      addLog('未填写 LLM Key，已自动使用内置免费 Key', 'warning')
    }

    try {
      const res = await fetch('/api/polish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          apiUrl: effectiveLlmApiUrl,
          apiKey: effectiveLlmApiKey,
          model: effectiveLlmModel,
          customInstructions: customInstructions.trim() || DEFAULT_INSTRUCTIONS,
        }),
      })

      // 检查是否为错误响应（JSON）
      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        const data = await res.json()
        addLog(`润色失败: ${data.error || JSON.stringify(data)}`, 'error')
        setPolishing(false)
        return
      }

      // 处理 SSE 流式响应
      if (!res.body) {
        addLog('润色失败: 无响应数据', 'error')
        setPolishing(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content || ''
              if (content) {
                fullContent += content
                setPolishedResult(fullContent)
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      if (fullContent) {
        addLog(`润色完成! 文本长度: ${fullContent.length} 字符`, 'success')
      } else {
        addLog('润色完成但无内容返回', 'warning')
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e)
      addLog(`润色请求失败: ${errorMsg}`, 'error')
    } finally {
      setPolishing(false)
    }
  }

  const transcribe = async (file: File) => {
    if (!apiKey) {
      setResult('请先填写 API Key')
      addLog('错误: 未填写 API Key', 'error')
      return
    }

    clearLogs()
    setLoading(true)
    setResult('')
    setPolishedResult('')
    setUploadProgress(0)
    setStatus('uploading')
    setStatusMessage('准备上传文件...')

    const info = { name: file.name, size: formatFileSize(file.size), type: file.type || 'unknown' }
    setFileInfo(info)

    addLog(`开始处理文件: ${info.name}`, 'info')
    addLog(`文件大小: ${info.size}`, 'info')
    const effectiveApiUrl = apiUrl.trim() || DEFAULT_ASR_API_URL
    const effectiveModel = model.trim() || DEFAULT_ASR_MODEL

    addLog(`目标 API: ${effectiveApiUrl}`, 'info')
    addLog(`使用模型: ${effectiveModel}`, 'info')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('model', effectiveModel)

    try {
      addLog('正在上传文件...', 'info')
      setStatusMessage('正在上传文件...')

      const xhr = new XMLHttpRequest()

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100)
          setUploadProgress(percent)
          setStatusMessage(`正在上传 ${formatFileSize(e.loaded)} / ${formatFileSize(e.total)}`)
          if (percent % 25 === 0 || percent === 100) {
            addLog(`上传进度: ${percent}%`, 'info')
          }
        }
      }

      xhr.upload.onload = () => {
        setStatus('uploaded')
        setStatusMessage('上传完成，等待服务器响应...')
        addLog('文件上传完成，等待服务器处理...', 'success')
      }

      const response = await new Promise<{ ok: boolean; status: number; data: Record<string, unknown> }>((resolve, reject) => {
        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText)
            resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data })
          } catch {
            reject(new Error('响应解析失败'))
          }
        }
        xhr.onerror = () => reject(new Error('网络错误'))
        xhr.ontimeout = () => reject(new Error('请求超时'))

        xhr.open('POST', effectiveApiUrl)
        xhr.setRequestHeader('Authorization', `Bearer ${apiKey}`)
        xhr.timeout = 300000
        xhr.send(formData)
      })

      // Server responded - now processing
      setStatus('transcribing')
      setStatusMessage('服务器正在进行语音识别...')
      addLog('正在进行语音识别...', 'info')

      if (response.ok) {
        const text = (response.data.text as string) || ''
        setResult(text || '转录完成但无文本返回')
        setStatus('done')
        setStatusMessage('转录完成')
        addLog(`转录成功! 文本长度: ${text.length} 字符`, 'success')
      } else {
        setResult(`错误: ${response.status} - ${JSON.stringify(response.data)}`)
        setStatus('error')
        setStatusMessage('转录失败')
        addLog(`API 错误: ${JSON.stringify(response.data)}`, 'error')
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e)
      setResult(`请求失败: ${errorMsg}`)
      setStatus('error')
      setStatusMessage('请求失败')
      addLog(`请求失败: ${errorMsg}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const downloadToLocal = async () => {
    const url = audioUrlInput.trim()
    if (!url) {
      addLog('请输入音频链接', 'error')
      return
    }

    clearLogs()
    setLoading(true)
    setStatus('fetching-url')
    setStatusMessage('正在下载音频到本地...')
    setSelectedFile(null)
    setFileInfo(null)

    addLog(`开始下载: ${url}`, 'info')

    try {
      const res = await fetch('/api/download-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, proxyUrl: proxyUrl.trim() || undefined }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setFileInfo({
          name: data.fileName,
          size: formatFileSize(data.fileSize),
          type: data.contentType,
        })
        setStatus('idle')
        setStatusMessage('')
        addLog(`下载完成: ${data.fileName} (${formatFileSize(data.fileSize)})`, 'success')
        addLog(`保存路径: ${data.filePath}`, 'info')
      } else {
        setStatus('error')
        setStatusMessage('下载失败')
        addLog(`下载失败: ${data.error}`, 'error')
      }
    } catch (e) {
      setStatus('error')
      setStatusMessage('下载失败')
      addLog(`下载失败: ${(e as Error).message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const importFromUrl = async () => {
    const url = audioUrlInput.trim()
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

    if (!apiKey) {
      setResult('请先填写 API Key')
      addLog('错误: 未填写 API Key', 'error')
      return
    }

    clearLogs()
    setLoading(true)
    setResult('')
    setPolishedResult('')
    setUploadProgress(0)
    setStatus('fetching-url')
    setStatusMessage('正在从链接获取音频...')
    setSelectedFile(null)
    setFileInfo(null)

    const effectiveApiUrl = apiUrl.trim() || DEFAULT_ASR_API_URL
    const effectiveModel = model.trim() || DEFAULT_ASR_MODEL

    addLog(`开始从链接导入音频: ${url}`, 'info')
    addLog(`目标 API: ${effectiveApiUrl}`, 'info')
    addLog(`使用模型: ${effectiveModel}`, 'info')

    const transcribingTimer = setTimeout(() => {
      setStatus((prev) => (prev === 'fetching-url' ? 'transcribing' : prev))
      setStatusMessage('服务器正在进行语音识别...')
      addLog('服务器正在进行语音识别...', 'info')
    }, 800)

    try {
      const res = await fetch('/api/fetch-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          asrApiKey: apiKey,
          asrApiUrl: effectiveApiUrl,
          asrModel: effectiveModel,
          polish: false,
          proxyUrl: proxyUrl.trim() || undefined,
        }),
      })

      clearTimeout(transcribingTimer)
      let data: Record<string, any> = {}
      try {
        data = await res.json()
      } catch {
        data = {}
      }

      if (res.ok && data.success) {
        const text = (data.transcription as string) || ''
        setResult(text || '转录完成但无文本返回')
        setStatus('done')
        setStatusMessage('转录完成')

        if (data.metadata) {
          setFileInfo({
            name: data.metadata.fileName || '在线音频',
            size: formatFileSize(data.metadata.fileSize || 0),
            type: data.metadata.contentType || 'audio',
          })
          addLog(
            `音频拉取完成: ${data.metadata.fileName || '在线音频'} (${formatFileSize(
              data.metadata.fileSize || 0
            )})`,
            'success'
          )
        } else {
          addLog('音频拉取完成', 'success')
        }

        addLog(`转录成功! 文本长度: ${text.length} 字符`, 'success')
      } else {
        const errorMsg = data.error || '导入失败'
        setResult(`错误: ${errorMsg}`)
        setStatus('error')
        setStatusMessage('导入失败')
        addLog(`导入失败: ${errorMsg}`, 'error')
      }
    } catch (e) {
      clearTimeout(transcribingTimer)
      const errorMsg = e instanceof Error ? e.message : String(e)
      setResult(`请求失败: ${errorMsg}`)
      setStatus('error')
      setStatusMessage('请求失败')
      addLog(`请求失败: ${errorMsg}`, 'error')
    } finally {
      clearTimeout(transcribingTimer)
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      const info = { name: file.name, size: formatFileSize(file.size), type: file.type || 'unknown' }
      setFileInfo(info)
      addLog(`已选择文件: ${file.name} (${info.size})`, 'info')
    }
  }

  const handleStartTranscribe = () => {
    if (selectedFile) {
      transcribe(selectedFile)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result)
      setCopied(true)
      addLog('原始结果已复制到剪贴板', 'success')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      addLog('复制失败', 'error')
    }
  }

  const handleCopyPolished = async () => {
    try {
      await navigator.clipboard.writeText(polishedResult)
      setCopiedPolished(true)
      addLog('润色结果已复制到剪贴板', 'success')
      setTimeout(() => setCopiedPolished(false), 2000)
    } catch {
      addLog('复制失败', 'error')
    }
  }

  const statusConfig = {
    idle: { text: '准备就绪', color: 'bg-[#8E8E93]', textColor: 'text-[#8E8E93]' },
    uploading: { text: '上传中', color: 'bg-[#007AFF]', textColor: 'text-[#007AFF]' },
    uploaded: { text: '已上传', color: 'bg-[#34C759]', textColor: 'text-[#34C759]' },
    'fetching-url': { text: '拉取链接', color: 'bg-[#5E5CE6]', textColor: 'text-[#5E5CE6]' },
    transcribing: { text: '识别中', color: 'bg-[#FF9500]', textColor: 'text-[#FF9500]' },
    done: { text: '已完成', color: 'bg-[#34C759]', textColor: 'text-[#34C759]' },
    error: { text: '出错了', color: 'bg-[#FF3B30]', textColor: 'text-[#FF3B30]' },
  }

  const logColors = {
    info: 'text-[#8E8E93]',
    success: 'text-[#34C759]',
    error: 'text-[#FF3B30]',
    warning: 'text-[#FF9500]',
  }


  return (
    <main className="min-h-screen bg-[#F2F2F7]">
      {/* Header */}
      <header className="glass sticky top-0 z-50 border-b border-black/5">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#007AFF] to-[#AF52DE] flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-[#1D1D1F]">语音转文字</h1>
              <p className="text-xs text-[#8E8E93]">Voice to Text</p>
            </div>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-10 h-10 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow-sm btn-press"
          >
            <svg className={`w-5 h-5 text-[#636366] transition-transform duration-300 ${showSettings ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Settings Panel */}
        {showSettings && (
          <div className="animate-fade-in space-y-4">
            {/* ASR Config */}
            <div className="bg-white rounded-2xl shadow-[var(--apple-shadow)] p-6 card-hover">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-[#007AFF]/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#007AFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-semibold text-[#1D1D1F]">语音识别配置</h2>
                  <p className="text-xs text-[#8E8E93]">ASR API Settings</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#636366] mb-2">API Key</label>
                  <input
                    type="password"
                    placeholder="硅基流动 API Key（必填）"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full px-4 py-3 bg-[#F2F2F7] rounded-xl border-0 text-[#1D1D1F] placeholder-[#8E8E93] focus:ring-2 focus:ring-[#007AFF]/30 focus:bg-white transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#636366] mb-2">API URL</label>
                    <input
                      type="text"
                      value={apiUrl}
                      onChange={(e) => setApiUrl(e.target.value)}
                      className="w-full px-4 py-3 bg-[#F2F2F7] rounded-xl border-0 text-sm text-[#1D1D1F] focus:ring-2 focus:ring-[#007AFF]/30 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#636366] mb-2">模型</label>
                    <input
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full px-4 py-3 bg-[#F2F2F7] rounded-xl border-0 text-sm text-[#1D1D1F] focus:ring-2 focus:ring-[#007AFF]/30 focus:bg-white transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* LLM Config */}
            <div className="bg-white rounded-2xl shadow-[var(--apple-shadow)] p-6 card-hover">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-[#AF52DE]/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#AF52DE]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-semibold text-[#1D1D1F]">文本润色配置</h2>
                  <p className="text-xs text-[#8E8E93]">LLM Polish Settings · 内置免费服务</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#636366] mb-2">API Key（可选）</label>
                  <input
                    type="password"
                    placeholder="留空使用内置免费 Key"
                    value={llmApiKey}
                    onChange={(e) => setLlmApiKey(e.target.value)}
                    className="w-full px-4 py-3 bg-[#F2F2F7] rounded-xl border-0 text-[#1D1D1F] placeholder-[#8E8E93] focus:ring-2 focus:ring-[#AF52DE]/30 focus:bg-white transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#636366] mb-2">API URL</label>
                    <input
                      type="text"
                      value={llmApiUrl}
                      onChange={(e) => setLlmApiUrl(e.target.value)}
                      className="w-full px-4 py-3 bg-[#F2F2F7] rounded-xl border-0 text-sm text-[#1D1D1F] focus:ring-2 focus:ring-[#AF52DE]/30 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#636366] mb-2">模型</label>
                    <input
                      type="text"
                      value={llmModel}
                      onChange={(e) => setLlmModel(e.target.value)}
                      className="w-full px-4 py-3 bg-[#F2F2F7] rounded-xl border-0 text-sm text-[#1D1D1F] focus:ring-2 focus:ring-[#AF52DE]/30 focus:bg-white transition-all"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-[#636366]">润色指令</label>
                    <button
                      onClick={() => setCustomInstructions(DEFAULT_INSTRUCTIONS)}
                      className="text-xs text-[#AF52DE] hover:text-[#9B3DC9]"
                    >
                      恢复默认
                    </button>
                  </div>
                  <textarea
                    placeholder="自定义润色指令..."
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 bg-[#F2F2F7] rounded-xl border-0 text-sm text-[#1D1D1F] placeholder-[#8E8E93] focus:ring-2 focus:ring-[#AF52DE]/30 focus:bg-white transition-all resize-none"
                  />
                  <p className="mt-1 text-xs text-[#8E8E93]">自定义如何处理文本，例如：纠错、分段、翻译等</p>
                </div>
              </div>
            </div>

            {/* Proxy Config */}
            <div className="bg-white rounded-2xl shadow-[var(--apple-shadow)] p-6 card-hover">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-[#FF9500]/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#FF9500]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-semibold text-[#1D1D1F]">网络代理</h2>
                  <p className="text-xs text-[#8E8E93]">Proxy Settings · 留空则直连</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#636366] mb-2">代理地址</label>
                <input
                  type="text"
                  placeholder="http://127.0.0.1:7890"
                  value={proxyUrl}
                  onChange={(e) => setProxyUrl(e.target.value)}
                  className="w-full px-4 py-3 bg-[#F2F2F7] rounded-xl border-0 text-[#1D1D1F] placeholder-[#8E8E93] focus:ring-2 focus:ring-[#FF9500]/30 focus:bg-white transition-all"
                />
                <p className="mt-1 text-xs text-[#8E8E93]">用于服务器端拉取在线音频，留空表示直连（需开启 TUN 模式或无需代理）</p>
              </div>
            </div>
          </div>
        )}


        {/* Main Action Area */}
        <Card className="shadow-[var(--apple-shadow)] border-0 rounded-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-[#1D1D1F]">音频来源</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 在线链接 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-[#636366]">在线链接</label>
                <span className="text-xs text-[#8E8E93]">支持 asmrgay.com 及备用站</span>
              </div>
              <Input
                type="text"
                value={audioUrlInput}
                onChange={(e) => setAudioUrlInput(e.target.value)}
                placeholder="粘贴音频链接..."
                className="h-12 px-4 bg-[#F2F2F7] border border-[#E5E5EA] rounded-xl text-[#1D1D1F] placeholder:text-[#8E8E93] focus-visible:ring-2 focus-visible:ring-[#5E5CE6]/30 focus-visible:border-[#5E5CE6]"
              />
              <div className="flex gap-3">
                <Button
                  onClick={downloadToLocal}
                  disabled={loading || !audioUrlInput.trim()}
                  className="flex-1 h-12 bg-[#FF9500] hover:bg-[#E68600] text-white rounded-xl font-medium shadow-lg shadow-[#FF9500]/25 disabled:opacity-40"
                >
                  {loading && status === 'fetching-url' ? '下载中...' : '下载到本地'}
                </Button>
                <Button
                  onClick={importFromUrl}
                  disabled={loading || !audioUrlInput.trim() || !apiKey}
                  className="flex-1 h-12 bg-[#5E5CE6] hover:bg-[#4B49CC] text-white rounded-xl font-medium shadow-lg shadow-[#5E5CE6]/25 disabled:opacity-40"
                >
                  {loading && status === 'transcribing' ? '转录中...' : '直接转录'}
                </Button>
              </div>
            </div>

            {/* 本地文件 */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-[#636366]">本地文件</label>
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="w-full h-14 bg-[#007AFF] hover:bg-[#0066CC] text-white rounded-xl font-medium shadow-lg shadow-[#007AFF]/25 disabled:opacity-50"
              >
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                选择音频文件
              </Button>
            </div>

            {/* Selected File Display */}
            {fileInfo && !loading && (
              <div className="flex items-center justify-between p-4 bg-[#F2F2F7] rounded-xl animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#007AFF]/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-[#007AFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-[#1D1D1F]">{fileInfo.name}</p>
                    <p className="text-sm text-[#8E8E93]">{fileInfo.size}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 rounded-full hover:bg-[#FF3B30]/10"
                  onClick={() => {
                    setSelectedFile(null)
                    setFileInfo(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                >
                  <svg className="w-4 h-4 text-[#8E8E93] hover:text-[#FF3B30]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </Button>
              </div>
            )}

            {/* Start Transcribe Button */}
            <Button
              onClick={handleStartTranscribe}
              disabled={loading || !selectedFile}
              className="w-full h-14 bg-gradient-to-r from-[#AF52DE] to-[#007AFF] hover:opacity-90 text-white rounded-xl font-semibold shadow-lg shadow-[#AF52DE]/20 disabled:opacity-40"
            >
              {loading ? '处理中...' : '开始转录'}
            </Button>

            <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleFileChange} className="hidden" />
          </CardContent>
        </Card>

        {/* Status & Progress */}
        {(status !== 'idle' || loading) && (
          <div className="bg-white rounded-2xl shadow-[var(--apple-shadow)] p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${statusConfig[status].color} ${status === 'transcribing' || status === 'uploading' || status === 'uploaded' ? 'animate-pulse' : ''}`}></span>
                <span className={`font-medium ${statusConfig[status].textColor}`}>{statusConfig[status].text}</span>
              </div>
              {status === 'uploading' && <span className="text-sm text-[#8E8E93]">{uploadProgress}%</span>}
            </div>

            {/* Progress Bar - only show during upload */}
            {status === 'uploading' && (
              <div className="relative w-full h-2 bg-[#F2F2F7] rounded-full overflow-hidden mb-3">
                <div
                  className={`absolute left-0 top-0 h-full rounded-full transition-all duration-300 ${statusConfig[status].color}`}
                  style={{ width: `${uploadProgress}%` }}
                >
                  <div className="absolute inset-0 progress-shine"></div>
                </div>
              </div>
            )}

            {/* Indeterminate progress for server processing */}
            {(status === 'uploaded' || status === 'transcribing' || status === 'fetching-url') && (
              <div className="relative w-full h-2 bg-[#F2F2F7] rounded-full overflow-hidden mb-3">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#FF9500] to-transparent animate-[progress-shine_1.5s_ease-in-out_infinite]" style={{ backgroundSize: '200% 100%' }}></div>
              </div>
            )}

            {/* Status message */}
            {statusMessage && (
              <p className="text-sm text-[#8E8E93] flex items-center gap-2">
                {(status === 'uploading' || status === 'uploaded' || status === 'transcribing' || status === 'fetching-url') && (
                  <svg className="animate-spin w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {status === 'done' && (
                  <svg className="w-4 h-4 text-[#34C759] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {status === 'error' && (
                  <svg className="w-4 h-4 text-[#FF3B30] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                {statusMessage}
              </p>
            )}
          </div>
        )}


        {/* Results Section */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Original Result */}
          <div className="bg-white rounded-2xl shadow-[var(--apple-shadow)] p-6 card-hover">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#007AFF]/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#007AFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h2 className="font-semibold text-[#1D1D1F]">原始结果</h2>
              </div>
              <div className="flex gap-2">
                {result && !result.startsWith('错误') && !result.startsWith('请求失败') && (
                  <button
                    onClick={() => polishText(result)}
                    disabled={polishing}
                    className="px-4 py-2 bg-[#FF9500] text-white rounded-lg text-sm font-medium hover:bg-[#E68600] disabled:opacity-50 btn-press"
                  >
                    {polishing ? '润色中...' : '✨ 润色'}
                  </button>
                )}
                {result && (
                  <button
                    onClick={handleCopy}
                    className={`px-4 py-2 rounded-lg text-sm font-medium btn-press transition-all ${
                      copied ? 'bg-[#34C759] text-white' : 'bg-[#F2F2F7] text-[#636366] hover:bg-[#E5E5EA]'
                    }`}
                  >
                    {copied ? '✓ 已复制' : '复制'}
                  </button>
                )}
              </div>
            </div>
            <div className="min-h-[160px] p-4 bg-[#F2F2F7] rounded-xl text-[#1D1D1F] whitespace-pre-wrap text-sm leading-relaxed">
              {result || <span className="text-[#8E8E93]">等待输入...</span>}
            </div>
            {result && (
              <p className="mt-3 text-xs text-[#8E8E93]">{result.length} 字符</p>
            )}
          </div>

          {/* Polished Result */}
          <div className="bg-white rounded-2xl shadow-[var(--apple-shadow)] p-6 card-hover">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#AF52DE]/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#AF52DE]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <h2 className="font-semibold text-[#1D1D1F]">润色结果</h2>
              </div>
              {polishedResult && (
                <button
                  onClick={handleCopyPolished}
                  className={`px-4 py-2 rounded-lg text-sm font-medium btn-press transition-all ${
                    copiedPolished ? 'bg-[#34C759] text-white' : 'bg-[#F2F2F7] text-[#636366] hover:bg-[#E5E5EA]'
                  }`}
                >
                  {copiedPolished ? '✓ 已复制' : '复制'}
                </button>
              )}
            </div>
            <div className="min-h-[160px] p-4 bg-gradient-to-br from-[#AF52DE]/5 to-[#007AFF]/5 rounded-xl text-[#1D1D1F] whitespace-pre-wrap text-sm leading-relaxed">
              {polishing ? (
                <div className="flex items-center gap-2 text-[#AF52DE]">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  正在润色文本...
                </div>
              ) : (
                polishedResult || <span className="text-[#8E8E93]">点击"润色"按钮处理原始文本...</span>
              )}
            </div>
            {polishedResult && (
              <p className="mt-3 text-xs text-[#8E8E93]">{polishedResult.length} 字符</p>
            )}
          </div>
        </div>

        {/* Logs Panel */}
        <div className="bg-white rounded-2xl shadow-[var(--apple-shadow)] p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#636366]/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-[#636366]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="font-semibold text-[#1D1D1F]">运行日志</h2>
            </div>
            <button
              onClick={clearLogs}
              className="text-sm text-[#8E8E93] hover:text-[#636366] transition-colors"
            >
              清空
            </button>
          </div>
          <div
            ref={logsContainerRef}
            className="h-48 overflow-y-auto bg-[#1C1C1E] rounded-xl p-4 font-mono text-xs space-y-1"
          >
            {logs.length === 0 ? (
              <span className="text-[#636366]">暂无日志...</span>
            ) : (
              logs.map((log, i) => (
                <div key={i} className={`${logColors[log.type]} animate-slide-in`}>
                  <span className="text-[#48484A]">[{log.time}]</span> {log.message}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center py-6">
          <p className="text-sm text-[#8E8E93]">
            Powered by SiliconFlow ASR & DeepSeek LLM
          </p>
        </footer>
      </div>
    </main>
  )
}
