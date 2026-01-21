'use client'

import { useState, useRef, useEffect } from 'react'

// 默认配置
const DEFAULT_ASR_API_URL = 'https://api.siliconflow.cn/v1/audio/transcriptions'
const DEFAULT_ASR_MODEL = 'TeleAI/TeleSpeechASR'
const DEFAULT_LLM_API_URL = 'https://juya.owl.ci/v1'
const DEFAULT_LLM_MODEL = 'DeepSeek-V3.1-Terminus'
const DEFAULT_LLM_API_KEY = 'sk-kUm2RSHxuRJyjdrzdwprHYFYwvE4NTkIzRoyyaiDoh7YyDIZ'
const DEFAULT_PROXY_URL = 'http://127.0.0.1:7890'
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

type AudioInfo = {
  name: string
  size: number
  type: string
  source: 'local' | 'remote'
  url?: string
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

// Clean microphone + document icon for voice-to-text
function LogoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Document with lines */}
      <rect x="8" y="6" width="24" height="32" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
      <line x1="14" y1="14" x2="26" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="14" y1="20" x2="26" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="14" y1="26" x2="22" y2="26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {/* Pen/Edit tool */}
      <path d="M34 18L40 12L44 16L38 22L34 22V18Z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" />
      <line x1="34" y1="22" x2="38" y2="18" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
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

  useEffect(() => {
    if (!settingsLoaded) return
    saveSettings({ apiKey, apiUrl, model, llmApiUrl, llmModel, llmApiKey, customInstructions, proxyUrl })
  }, [apiKey, apiUrl, model, llmApiUrl, llmModel, llmApiKey, customInstructions, proxyUrl, settingsLoaded])

  const [result, setResult] = useState('')
  const [polishedResult, setPolishedResult] = useState('')
  const [resultTab, setResultTab] = useState<'original' | 'polished'>('original')
  const [loading, setLoading] = useState(false)
  const [polishing, setPolishing] = useState(false)

  useEffect(() => {
    if (polishedResult && !polishing) setResultTab('polished')
  }, [polishedResult, polishing])

  const [uploadProgress, setUploadProgress] = useState(0)
  const [status, setStatus] = useState<
    'idle' | 'uploading' | 'uploaded' | 'fetching-url' | 'transcribing' | 'done' | 'error'
  >('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logFilter, setLogFilter] = useState<'all' | 'error' | 'success' | 'info'>('all')
  const [audioInfo, setAudioInfo] = useState<AudioInfo | null>(null)
  const [checking, setChecking] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

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
  const [currentTab, setCurrentTab] = useState<'source' | 'results' | 'settings' | 'logs'>('source')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const logsContainerRef = useRef<HTMLDivElement>(null)

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    setLogs((prev) => [...prev, { time, message, type }])
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

      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        const data = await res.json()
        addLog(`润色失败: ${data.error || JSON.stringify(data)}`, 'error')
        setPolishing(false)
        return
      }

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

    addLog(`开始处理文件: ${file.name}`, 'info')
    addLog(`文件大小: ${formatFileSize(file.size)}`, 'info')
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

      setStatus('transcribing')
      setStatusMessage('服务器正在进行语音识别...')
      addLog('正在进行语音识别...', 'info')

      if (response.ok) {
        const text = (response.data.text as string) || ''
        setResult(text || '转录完成但无文本返回')
        setStatus('done')
        setStatusMessage('转录完成')
        addLog(`转录成功! 文本长度: ${text.length} 字符`, 'success')
        // Auto switch to results tab
        setCurrentTab('results')
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
        // Auto switch to results tab
        setCurrentTab('results')
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
      setAudioUrlInput('')  // 清空URL输入
      setAudioInfo({
        name: file.name,
        size: file.size,
        type: file.type || 'audio/unknown',
        source: 'local',
      })
      addLog(`已选择文件: ${file.name} (${formatFileSize(file.size)})`, 'info')
    }
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
        body: JSON.stringify({ url, proxyUrl: proxyUrl.trim() || undefined }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setSelectedFile(null)  // 清空本地文件
        if (fileInputRef.current) fileInputRef.current.value = ''
        setAudioInfo({
          name: data.name,
          size: data.size,
          type: data.type,
          source: 'remote',
          url,
        })
        addLog(`检查通过: ${data.name} (${formatFileSize(data.size)})`, 'success')
      } else {
        addLog(`检查失败: ${data.error}`, 'error')
      }
    } catch (e) {
      addLog(`检查失败: ${(e as Error).message}`, 'error')
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

  const handleStartTranscribe = () => {
    if (!audioInfo) return
    if (audioInfo.source === 'local' && selectedFile) {
      transcribe(selectedFile)
    } else if (audioInfo.source === 'remote' && audioInfo.url) {
      importFromUrl()
    }
  }

  const canTranscribe = audioInfo && apiKey && !loading

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
    idle: { text: '准备就绪', color: 'bg-muted-foreground' },
    uploading: { text: '上传中', color: 'bg-primary' },
    uploaded: { text: '已上传', color: 'bg-emerald-600' },
    'fetching-url': { text: '拉取链接', color: 'bg-primary' },
    transcribing: { text: '识别中', color: 'bg-amber-600' },
    done: { text: '已完成', color: 'bg-emerald-600' },
    error: { text: '出错了', color: 'bg-destructive' },
  }

  const logColors = {
    info: 'text-muted-foreground',
    success: 'text-emerald-600 dark:text-emerald-400',
    error: 'text-destructive',
    warning: 'text-amber-600 dark:text-amber-400',
  }

  const filteredLogs = logFilter === 'all' ? logs : logs.filter((log) => log.type === logFilter)

  const mainTabs = [
    { id: 'source' as const, label: '来源' },
    { id: 'results' as const, label: '结果' },
    { id: 'settings' as const, label: '设置' },
    { id: 'logs' as const, label: '日志' },
  ]

  return (
    <main className="min-h-screen bg-background">
      {/* Top bar with theme toggle */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={toggleTheme}
          className="w-9 h-9 rounded-lg bg-card border border-border hover:bg-muted flex items-center justify-center cursor-pointer transition-colors"
          title={theme === 'light' ? '切换到暗色模式' : '切换到亮色模式'}
        >
          {theme === 'light' ? (
            <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          )}
        </button>
      </div>

      <div className="max-w-xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mb-4 flex justify-center">
            <LogoIcon className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-1">ASMR Transformer</h1>
          <p className="text-sm text-muted-foreground">语音转文字工具</p>
        </div>

        {/* Main Card */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          {/* Tab Navigation */}
          <div className="border-b border-border">
            <div className="flex">
              {mainTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setCurrentTab(tab.id)}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors cursor-pointer relative ${
                    currentTab === tab.id
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                  {currentTab === tab.id && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-5">
            {/* Source Tab (来源) */}
            {currentTab === 'source' && (
              <div className="space-y-5 animate-fade-in">
                {/* Upload Zone - Local File */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm text-foreground">点击选择或拖拽音频文件</p>
                    <p className="text-xs text-muted-foreground">支持 mp3, wav, m4a, flac...</p>
                  </div>
                </div>
                <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleFileChange} className="hidden" />

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">或者</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* URL Input Section */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">在线链接</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={audioUrlInput}
                      onChange={(e) => setAudioUrlInput(e.target.value)}
                      placeholder="粘贴音频链接..."
                      className="flex-1 px-3 py-2 bg-transparent rounded-lg border border-border text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary transition-colors"
                    />
                    <button
                      onClick={checkAudioUrl}
                      disabled={checking || !audioUrlInput.trim()}
                      className="px-4 py-2 bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium cursor-pointer transition-colors"
                    >
                      {checking ? '检查中...' : '检查'}
                    </button>
                  </div>
                </div>

                {/* Selected Audio Display (unified) */}
                {audioInfo && !loading && (
                  <div className="p-3 bg-muted/50 rounded-lg border border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <svg className="w-5 h-5 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                        <span className="text-sm text-foreground font-medium truncate">{audioInfo.name}</span>
                      </div>
                      <button
                        onClick={clearAudio}
                        className="p-1 hover:bg-muted rounded cursor-pointer ml-2"
                        title="删除"
                      >
                        <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatFileSize(audioInfo.size)} · 来源: {audioInfo.source === 'local' ? '本地上传' : '在线链接'}
                    </div>
                  </div>
                )}

                {/* Start Transcribe Button (always visible) */}
                <button
                  onClick={handleStartTranscribe}
                  disabled={!canTranscribe}
                  className="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium cursor-pointer transition-colors"
                >
                  {loading ? '处理中...' : '开始转录'}
                </button>

                {/* Hint when no API key */}
                {!apiKey && (
                  <p className="text-xs text-muted-foreground text-center">
                    请先在「设置」中填写 ASR API Key
                  </p>
                )}

                {/* Status Display */}
                {status !== 'idle' && (
                  <div className="p-3 bg-muted/50 rounded-lg border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-2 h-2 rounded-full ${statusConfig[status].color} ${['uploading', 'uploaded', 'transcribing', 'fetching-url'].includes(status) ? 'animate-pulse' : ''}`} />
                      <span className="text-sm font-medium text-foreground">{statusConfig[status].text}</span>
                      {status === 'uploading' && <span className="text-xs text-muted-foreground ml-auto">{uploadProgress}%</span>}
                    </div>
                    {status === 'uploading' && (
                      <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                      </div>
                    )}
                    {['uploaded', 'transcribing', 'fetching-url'].includes(status) && (
                      <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary/60 animate-pulse w-full" />
                      </div>
                    )}
                    {statusMessage && <p className="text-xs text-muted-foreground mt-2">{statusMessage}</p>}
                  </div>
                )}
              </div>
            )}

            {/* Results Tab */}
            {currentTab === 'results' && (
              <div className="space-y-4 animate-fade-in">
                {/* Sub-tabs: Original / Polished */}
                <div className="flex items-center gap-4 border-b border-border pb-2">
                  <button
                    onClick={() => setResultTab('original')}
                    className={`text-sm font-medium pb-1 border-b-2 cursor-pointer transition-colors ${
                      resultTab === 'original'
                        ? 'border-primary text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    原始文本
                  </button>
                  <button
                    onClick={() => setResultTab('polished')}
                    className={`text-sm font-medium pb-1 border-b-2 cursor-pointer transition-colors ${
                      resultTab === 'polished'
                        ? 'border-primary text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    润色文本
                  </button>
                  <div className="flex-1" />
                  {result && !result.startsWith('错误') && !result.startsWith('请求失败') && (
                    <button
                      onClick={() => polishText(result)}
                      disabled={polishing}
                      className="px-3 py-1 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 rounded-md text-xs font-medium cursor-pointer transition-colors"
                    >
                      {polishing ? '润色中...' : '润色'}
                    </button>
                  )}
                  {(resultTab === 'original' ? result : polishedResult) && (
                    <button
                      onClick={resultTab === 'original' ? handleCopy : handleCopyPolished}
                      className={`px-3 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                        (resultTab === 'original' ? copied : copiedPolished)
                          ? 'bg-emerald-600 text-white'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {(resultTab === 'original' ? copied : copiedPolished) ? '已复制' : '复制'}
                    </button>
                  )}
                </div>

                {/* Result Content */}
                <div className="min-h-[200px] p-4 bg-muted/30 rounded-lg border border-border text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {resultTab === 'original' ? (
                    result || <span className="text-muted-foreground">暂无转录结果...</span>
                  ) : polishing ? (
                    <div className="flex items-center gap-2 text-primary">
                      <span className="ai-dots">
                        <span className="ai-dot" />
                        <span className="ai-dot" />
                        <span className="ai-dot" />
                      </span>
                      <span>正在润色...</span>
                    </div>
                  ) : (
                    polishedResult || <span className="text-muted-foreground">点击「润色」处理文本...</span>
                  )}
                </div>

                {/* Character count */}
                {(resultTab === 'original' ? result : polishedResult) && (
                  <p className="text-xs text-muted-foreground">
                    {(resultTab === 'original' ? result : polishedResult).length} 字符
                  </p>
                )}
              </div>
            )}

            {/* Settings Tab */}
            {currentTab === 'settings' && (
              <div className="space-y-5 animate-fade-in">
                {/* ASR Config */}
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-1">语音识别配置</h3>
                  <p className="text-xs text-muted-foreground mb-3">ASR API Settings</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">API Key</label>
                      <input
                        type="password"
                        placeholder="硅基流动 API Key（必填）"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="w-full px-3 py-2 bg-transparent rounded-lg border border-border text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary transition-colors"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">API URL</label>
                        <input
                          type="text"
                          value={apiUrl}
                          onChange={(e) => setApiUrl(e.target.value)}
                          className="w-full px-3 py-2 bg-transparent rounded-lg border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">模型</label>
                        <input
                          type="text"
                          value={model}
                          onChange={(e) => setModel(e.target.value)}
                          className="w-full px-3 py-2 bg-transparent rounded-lg border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* LLM Config */}
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-1">文本润色配置</h3>
                  <p className="text-xs text-muted-foreground mb-3">LLM · 内置免费服务</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">API Key（可选）</label>
                      <input
                        type="password"
                        placeholder="留空使用内置免费 Key"
                        value={llmApiKey}
                        onChange={(e) => setLlmApiKey(e.target.value)}
                        className="w-full px-3 py-2 bg-transparent rounded-lg border border-border text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary transition-colors"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">API URL</label>
                        <input
                          type="text"
                          value={llmApiUrl}
                          onChange={(e) => setLlmApiUrl(e.target.value)}
                          className="w-full px-3 py-2 bg-transparent rounded-lg border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">模型</label>
                        <input
                          type="text"
                          value={llmModel}
                          onChange={(e) => setLlmModel(e.target.value)}
                          className="w-full px-3 py-2 bg-transparent rounded-lg border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary transition-colors"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-medium text-muted-foreground">润色指令</label>
                        <button
                          onClick={() => setCustomInstructions(DEFAULT_INSTRUCTIONS)}
                          className="text-xs text-primary hover:text-primary/80 font-medium cursor-pointer transition-colors"
                        >
                          恢复默认
                        </button>
                      </div>
                      <textarea
                        placeholder="自定义润色指令..."
                        value={customInstructions}
                        onChange={(e) => setCustomInstructions(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 bg-transparent rounded-lg border border-border text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary transition-colors resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Proxy Config */}
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-1">网络代理</h3>
                  <p className="text-xs text-muted-foreground mb-3">留空则直连</p>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">代理地址</label>
                    <input
                      type="text"
                      placeholder="http://127.0.0.1:7890"
                      value={proxyUrl}
                      onChange={(e) => setProxyUrl(e.target.value)}
                      className="w-full px-3 py-2 bg-transparent rounded-lg border border-border text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary transition-colors"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Logs Tab */}
            {currentTab === 'logs' && (
              <div className="space-y-4 animate-fade-in">
                {/* Filter chips */}
                <div className="flex items-center gap-2">
                  {(['all', 'error', 'success', 'info'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setLogFilter(filter)}
                      className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                        logFilter === filter
                          ? 'bg-foreground text-background'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {filter === 'all' ? '全部' : filter === 'error' ? '错误' : filter === 'success' ? '成功' : '信息'}
                    </button>
                  ))}
                  <div className="flex-1" />
                  <button
                    onClick={clearLogs}
                    className="text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  >
                    清空
                  </button>
                </div>

                {/* Logs list */}
                <div
                  ref={logsContainerRef}
                  className="h-64 overflow-y-auto p-3 bg-muted/30 rounded-lg border border-border font-mono text-xs space-y-1"
                >
                  {filteredLogs.length === 0 ? (
                    <span className="text-muted-foreground">暂无日志...</span>
                  ) : (
                    filteredLogs.map((log, i) => (
                      <div key={i} className={`${logColors[log.type]} animate-slide-in`}>
                        <span className="text-muted-foreground/60">[{log.time}]</span> {log.message}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center py-6 mt-6">
          <p className="text-xs text-muted-foreground">
            Powered by SiliconFlow ASR & DeepSeek LLM
          </p>
        </footer>
      </div>
    </main>
  )
}
