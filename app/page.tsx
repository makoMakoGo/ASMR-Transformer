'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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
  const [activeTab, setActiveTab] = useState<'original' | 'polished'>('original')
  const [loading, setLoading] = useState(false)
  const [polishing, setPolishing] = useState(false)

  useEffect(() => {
    if (polishedResult && !polishing) setActiveTab('polished')
  }, [polishedResult, polishing])

  const [uploadProgress, setUploadProgress] = useState(0)
  const [status, setStatus] = useState<
    'idle' | 'uploading' | 'uploaded' | 'fetching-url' | 'transcribing' | 'done' | 'error'
  >('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [fileInfo, setFileInfo] = useState<{ name: string; size: string; type: string } | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  // 初始化主题
  useEffect(() => {
    const stored = localStorage.getItem('theme') as 'light' | 'dark' | null
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const initial = stored || (prefersDark ? 'dark' : 'light')
    setTheme(initial)
    document.documentElement.classList.toggle('dark', initial === 'dark')
  }, [])

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    localStorage.setItem('theme', next)
    document.documentElement.classList.toggle('dark', next === 'dark')
  }
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
    setActiveTab('original')
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
    setActiveTab('original')
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
    idle: { text: '准备就绪', color: 'bg-muted-foreground', textColor: 'text-muted-foreground' },
    uploading: { text: '上传中', color: 'bg-primary', textColor: 'text-primary' },
    uploaded: { text: '已上传', color: 'bg-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400' },
    'fetching-url': { text: '拉取链接', color: 'bg-primary', textColor: 'text-primary' },
    transcribing: { text: '识别中', color: 'bg-amber-500', textColor: 'text-amber-600 dark:text-amber-400' },
    done: { text: '已完成', color: 'bg-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400' },
    error: { text: '出错了', color: 'bg-destructive', textColor: 'text-destructive' },
  }

  const logColors = {
    info: 'text-muted-foreground',
    success: 'text-emerald-600 dark:text-emerald-400',
    error: 'text-destructive',
    warning: 'text-amber-600 dark:text-amber-400',
  }


  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-foreground">ASMR Transformer</h1>
            <p className="text-xs text-muted-foreground">语音转文字</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="w-9 h-9 rounded-full border border-border hover:bg-muted flex items-center justify-center cursor-pointer"
              title={theme === 'light' ? '切换到暗色模式' : '切换到亮色模式'}
            >
              {theme === 'light' ? (
                <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              )}
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="w-9 h-9 rounded-full border border-border hover:bg-muted flex items-center justify-center cursor-pointer"
            >
            <svg className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${showSettings ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Settings Panel */}
        {showSettings && (
          <div className="animate-fade-in space-y-4">
            {/* ASR Config */}
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-foreground">语音识别配置</h2>
                <p className="text-xs text-muted-foreground">ASR API Settings</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">API Key</label>
                  <input
                    type="password"
                    placeholder="硅基流动 API Key（必填）"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full px-3 py-2.5 bg-transparent rounded-lg border border-border text-sm text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">API URL</label>
                    <input
                      type="text"
                      value={apiUrl}
                      onChange={(e) => setApiUrl(e.target.value)}
                      className="w-full px-3 py-2.5 bg-transparent rounded-lg border border-border text-xs text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">模型</label>
                    <input
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full px-3 py-2.5 bg-transparent rounded-lg border border-border text-xs text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* LLM Config */}
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-foreground">文本润色配置</h2>
                <p className="text-xs text-muted-foreground">LLM · 内置免费服务</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">API Key（可选）</label>
                  <input
                    type="password"
                    placeholder="留空使用内置免费 Key"
                    value={llmApiKey}
                    onChange={(e) => setLlmApiKey(e.target.value)}
                    className="w-full px-3 py-2.5 bg-transparent rounded-lg border border-border text-sm text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">API URL</label>
                    <input
                      type="text"
                      value={llmApiUrl}
                      onChange={(e) => setLlmApiUrl(e.target.value)}
                      className="w-full px-3 py-2.5 bg-transparent rounded-lg border border-border text-xs text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">模型</label>
                    <input
                      type="text"
                      value={llmModel}
                      onChange={(e) => setLlmModel(e.target.value)}
                      className="w-full px-3 py-2.5 bg-transparent rounded-lg border border-border text-xs text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-muted-foreground">润色指令</label>
                    <button
                      onClick={() => setCustomInstructions(DEFAULT_INSTRUCTIONS)}
                      className="text-xs text-primary hover:underline font-medium cursor-pointer"
                    >
                      恢复默认
                    </button>
                  </div>
                  <textarea
                    placeholder="自定义润色指令..."
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2.5 bg-transparent rounded-lg border border-border text-xs text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Proxy Config */}
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-foreground">网络代理</h2>
                <p className="text-xs text-muted-foreground">留空则直连</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">代理地址</label>
                <input
                  type="text"
                  placeholder="http://127.0.0.1:7890"
                  value={proxyUrl}
                  onChange={(e) => setProxyUrl(e.target.value)}
                  className="w-full px-3 py-2.5 bg-transparent rounded-lg border border-border text-sm text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>
            </div>
          </div>
        )}


        {/* Main Action Area */}
        <div className="bg-card rounded-xl border border-border p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">音频来源</h2>
          <div className="space-y-4">
            {/* 在线链接 */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">在线链接</label>
                <span className="text-xs text-muted-foreground">支持 asmrgay.com</span>
              </div>
              <Input
                type="text"
                value={audioUrlInput}
                onChange={(e) => setAudioUrlInput(e.target.value)}
                placeholder="粘贴音频链接..."
                className="h-10 px-3 bg-transparent border-border rounded-lg text-sm"
              />
              <div className="flex gap-2.5">
                <Button
                  onClick={downloadToLocal}
                  disabled={loading || !audioUrlInput.trim()}
                  className="flex-1 h-10 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg text-sm font-medium"
                >
                  {loading && status === 'fetching-url' ? '下载中...' : '下载到本地'}
                </Button>
                <Button
                  onClick={importFromUrl}
                  disabled={loading || !audioUrlInput.trim() || !apiKey}
                  className="flex-1 h-10 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-sm font-medium"
                >
                  {loading && status === 'transcribing' ? '转录中...' : '直接转录'}
                </Button>
              </div>
            </div>

            {/* 本地文件 */}
            <div className="space-y-2.5">
              <label className="text-xs font-medium text-muted-foreground">本地文件</label>
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                选择音频文件
              </Button>
            </div>

            {/* Selected File Display */}
            {fileInfo && !loading && (
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg animate-fade-in">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{fileInfo.name}</p>
                  <p className="text-xs text-muted-foreground">{fileInfo.size}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 rounded-full hover:bg-destructive/10"
                  onClick={() => {
                    setSelectedFile(null)
                    setFileInfo(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                >
                  <svg className="w-4 h-4 text-muted-foreground hover:text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </Button>
              </div>
            )}

            {/* Start Transcribe Button */}
            <Button
              onClick={handleStartTranscribe}
              disabled={loading || !selectedFile}
              className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-sm font-semibold"
            >
              {loading ? '处理中...' : '开始转录'}
            </Button>

            <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleFileChange} className="hidden" />
          </div>
        </div>

        {/* Status & Progress */}
        {(status !== 'idle' || loading) && (
          <div className="bg-card rounded-xl border border-border p-4 animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className={`w-2 h-2 rounded-full ${statusConfig[status].color} ${status === 'transcribing' || status === 'uploading' || status === 'uploaded' ? 'animate-pulse' : ''}`}></span>
                <span className={`text-sm font-medium ${statusConfig[status].textColor}`}>{statusConfig[status].text}</span>
              </div>
              {status === 'uploading' && <span className="text-xs text-muted-foreground">{uploadProgress}%</span>}
            </div>

            {/* Progress Bar */}
            {status === 'uploading' && (
              <div className="relative w-full h-1 bg-muted rounded-full overflow-hidden mb-2">
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}

            {/* Indeterminate progress */}
            {(status === 'uploaded' || status === 'transcribing' || status === 'fetching-url') && (
              <div className="relative w-full h-1 bg-muted rounded-full overflow-hidden mb-2">
                <div className="absolute inset-0 bg-primary/60 animate-pulse" />
              </div>
            )}

            {statusMessage && (
              <p className="text-xs text-muted-foreground">{statusMessage}</p>
            )}
          </div>
        )}


        {/* Results Section */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-end justify-between gap-4 mb-3">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setActiveTab('original')}
                className={`pb-1 text-sm font-semibold border-b-2 cursor-pointer ${
                  activeTab === 'original'
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                原始文本
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('polished')}
                className={`pb-1 text-sm font-semibold border-b-2 cursor-pointer ${
                  activeTab === 'polished'
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                润色文本
              </button>
            </div>

            <div className="flex gap-1.5">
              {result && !result.startsWith('错误') && !result.startsWith('请求失败') && (
                <button
                  onClick={() => polishText(result)}
                  disabled={polishing}
                  className="px-2.5 py-1 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                >
                  {polishing ? '润色中...' : '润色'}
                </button>
              )}
              {(activeTab === 'original' ? result : polishedResult) && (
                <button
                  onClick={activeTab === 'original' ? handleCopy : handleCopyPolished}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-all ${
                    activeTab === 'original'
                      ? copied
                        ? 'bg-emerald-500 text-white'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      : copiedPolished
                        ? 'bg-emerald-500 text-white'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {activeTab === 'original' ? (copied ? '已复制' : '复制') : copiedPolished ? '已复制' : '复制'}
                </button>
              )}
            </div>
          </div>

          <div className="min-h-[140px] p-3 bg-muted/30 rounded-lg text-foreground whitespace-pre-wrap text-sm leading-relaxed">
            {activeTab === 'original' ? (
              result || <span className="text-muted-foreground">等待输入...</span>
            ) : polishing ? (
              <div className="flex items-center gap-2 text-primary">
                <span className="ai-dots">
                  <span className="ai-dot" />
                  <span className="ai-dot" />
                  <span className="ai-dot" />
                </span>
                <span className="text-sm">正在润色...</span>
              </div>
            ) : (
              polishedResult || <span className="text-muted-foreground">点击&quot;润色&quot;处理文本...</span>
            )}
          </div>

          {activeTab === 'original' ? (
            result && <p className="mt-2 text-xs text-muted-foreground">{result.length} 字符</p>
          ) : (
            polishedResult && <p className="mt-2 text-xs text-muted-foreground">{polishedResult.length} 字符</p>
          )}
        </div>

        {/* Logs Panel */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">运行日志</h2>
            <button
              onClick={clearLogs}
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              清空
            </button>
          </div>
          <div
            ref={logsContainerRef}
            className="h-36 overflow-y-auto bg-muted/30 rounded-lg p-3 font-mono text-xs space-y-0.5"
          >
            {logs.length === 0 ? (
              <span className="text-muted-foreground">暂无日志...</span>
            ) : (
              logs.map((log, i) => (
                <div key={i} className={`${logColors[log.type]} animate-slide-in`}>
                  <span className="text-muted-foreground/50">[{log.time}]</span> {log.message}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center py-6">
          <p className="text-xs text-muted-foreground">
            Powered by SiliconFlow ASR & DeepSeek LLM
          </p>
        </footer>
      </div>
    </main>
  )
}
