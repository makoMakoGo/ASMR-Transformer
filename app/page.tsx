'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'

// 默认配置
const DEFAULT_ASR_API_URL = 'https://api.siliconflow.cn/v1/audio/transcriptions'
const DEFAULT_ASR_MODEL = 'TeleAI/TeleSpeechASR'
const DEFAULT_LLM_API_URL = 'https://juya.owl.ci/v1'
const DEFAULT_LLM_MODEL = 'DeepSeek-V3.1-Terminus'
const DEFAULT_PROXY_URL = 'http://127.0.0.1:7890'
const DEFAULT_INSTRUCTIONS =
  '请对以下语音转文字内容进行处理：1. 纠正错别字和语法错误 2. 添加适当的标点符号 3. 分段排版使内容更易读 4. 保持原意不变，不要添加或删除内容'

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

const areSettingsEqual = (a: Settings, b: Settings): boolean =>
  a.apiKey === b.apiKey &&
  a.apiUrl === b.apiUrl &&
  a.model === b.model &&
  a.llmApiUrl === b.llmApiUrl &&
  a.llmModel === b.llmModel &&
  a.llmApiKey === b.llmApiKey &&
  a.customInstructions === b.customInstructions &&
  a.proxyUrl === b.proxyUrl

// Logo component using PNG
function LogoIcon({ className }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="语音转文字"
      width={48}
      height={48}
      className={className}
    />
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
  const [envFilePath, setEnvFilePath] = useState('')
  const [envFileExists, setEnvFileExists] = useState(false)
  const savedSettingsRef = useRef<Settings | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [envSaveError, setEnvSaveError] = useState('')
  const [settingsLoadError, setSettingsLoadError] = useState('')
  const settingsInitRef = useRef(false)

  const currentSettings: Settings = { apiKey, apiUrl, model, llmApiUrl, llmModel, llmApiKey, customInstructions, proxyUrl }
  const isDirty = !!savedSettingsRef.current && !areSettingsEqual(savedSettingsRef.current, currentSettings)

  const applySettings = (s: Settings) => {
    setApiKey(s.apiKey || '')
    setApiUrl(s.apiUrl || DEFAULT_ASR_API_URL)
    setModel(s.model || DEFAULT_ASR_MODEL)
    setLlmApiUrl(s.llmApiUrl || DEFAULT_LLM_API_URL)
    setLlmModel(s.llmModel || DEFAULT_LLM_MODEL)
    setLlmApiKey(s.llmApiKey || '')
    setCustomInstructions(s.customInstructions || DEFAULT_INSTRUCTIONS)
    setProxyUrl(s.proxyUrl ?? DEFAULT_PROXY_URL)
  }

  const reloadSettingsFromEnv = async (force = false) => {
    if (!force && isDirty) {
      const ok = window.confirm('当前修改尚未保存，重新加载会覆盖本地改动。确定要继续吗？')
      if (!ok) return
    }

    setSettingsLoadError('')
    setEnvSaveError('')
    try {
      const res = await fetch('/api/settings', { method: 'GET' })
      const data = await res.json()
      if (!res.ok || !data?.success || !data?.settings) {
        throw new Error(data?.error || `HTTP ${res.status}`)
      }

      const s = data.settings as Settings
      applySettings(s)
      savedSettingsRef.current = s
      if (data.envFile?.path) setEnvFilePath(String(data.envFile.path))
      setEnvFileExists(Boolean(data.envFile?.exists))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setSettingsLoadError(`加载 .env 设置失败: ${msg}`)
    }
  }

  const saveSettingsToEnv = async () => {
    if (!isDirty) return
    setSavingSettings(true)
    setEnvSaveError('')

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentSettings),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.success || !data?.settings) throw new Error(data?.error || `HTTP ${res.status}`)

      const s = data.settings as Settings
      applySettings(s)
      savedSettingsRef.current = s
      if (data.envFile?.path) setEnvFilePath(String(data.envFile.path))
      setEnvFileExists(Boolean(data.envFile?.exists))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setEnvSaveError(msg)
    } finally {
      setSavingSettings(false)
    }
  }

  const discardLocalChanges = () => {
    if (!savedSettingsRef.current || !isDirty) return
    const ok = window.confirm('放弃未保存的修改并恢复到上次保存/加载的值？')
    if (!ok) return
    setSettingsLoadError('')
    setEnvSaveError('')
    applySettings(savedSettingsRef.current)
  }

  useEffect(() => {
    if (settingsInitRef.current) return
    settingsInitRef.current = true
    const loadSettings = async () => {
      await reloadSettingsFromEnv(true)
      if (!savedSettingsRef.current) {
        savedSettingsRef.current = { ...currentSettings }
        setEnvFileExists(false)
      }
      setSettingsLoaded(true)
    }
    loadSettings()
  }, [reloadSettingsFromEnv, currentSettings])

  useEffect(() => {
    if (!envSaveError) return
    setEnvSaveError('')
  }, [apiKey, apiUrl, model, llmApiUrl, llmModel, llmApiKey, customInstructions, proxyUrl])

  const [result, setResult] = useState('')
  const [polishedResult, setPolishedResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [polishing, setPolishing] = useState(false)

  useEffect(() => {
    if (polishedResult && !polishing) setCurrentTab('polish')
  }, [polishedResult, polishing])

  const [uploadProgress, setUploadProgress] = useState(0)
  const [status, setStatus] = useState<
    'idle' | 'processing' | 'transcribing' | 'done' | 'error'
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
  const [currentTab, setCurrentTab] = useState<'source' | 'transcription' | 'polish' | 'settings' | 'logs'>('source')
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

    const effectiveLlmApiKey = llmApiKey.trim()

    setPolishing(true)
    setPolishedResult('')
    const effectiveLlmApiUrl = llmApiUrl.trim() || DEFAULT_LLM_API_URL
    const effectiveLlmModel = llmModel.trim() || DEFAULT_LLM_MODEL

    addLog('开始文本润色...', 'info')
    addLog(`LLM API: ${effectiveLlmApiUrl}`, 'info')
    addLog(`LLM 模型: ${effectiveLlmModel}`, 'info')
    if (!effectiveLlmApiKey) addLog('未填写 LLM API Key，将尝试无鉴权请求（若服务需要 Key 会失败）', 'warning')

    try {
      const res = await fetch('/api/polish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          apiUrl: effectiveLlmApiUrl,
          apiKey: effectiveLlmApiKey || undefined,
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

  const transcribe = async (file: File, skipClearLogs = false) => {
    if (!apiKey) {
      setResult('请先填写 API Key')
      addLog('错误: 未填写 API Key', 'error')
      return
    }

    if (!skipClearLogs) {
      clearLogs()
    }
    setLoading(true)
    setResult('')
    setPolishedResult('')
    setUploadProgress(0)
    setStatus('processing')
    setStatusMessage('正在上传到识别服务...')

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
        setStatus('transcribing')
        setStatusMessage('正在识别语音...')
        addLog('上传完成，正在识别语音...', 'success')
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
      setStatusMessage('正在识别语音...')

      if (response.ok) {
        const text = (response.data.text as string) || ''
        setResult(text || '转录完成但无文本返回')
        setStatus('done')
        setStatusMessage('转录完成')
        addLog(`转录成功! 文本长度: ${text.length} 字符`, 'success')
        // Auto switch to transcription tab
        setCurrentTab('transcription')
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

  // 下载远程音频（带进度）并转录
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
    setStatus('processing')
    setStatusMessage('正在连接音频源...')

    addLog(`开始从链接导入音频: ${url}`, 'info')

    try {
      // 第一步：通过代理 API 下载音频（带进度）
      const proxyRes = await fetch('/api/proxy-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          proxyUrl: proxyUrl.trim() || undefined,
        }),
      })

      // 检查是否返回 JSON 错误
      const contentType = proxyRes.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        const errorData = await proxyRes.json()
        throw new Error(errorData.error || '下载失败')
      }

      if (!proxyRes.ok) {
        throw new Error(`下载失败 (${proxyRes.status})`)
      }

      // 获取文件信息
      const contentLength = proxyRes.headers.get('content-length')
      const totalSize = contentLength ? parseInt(contentLength, 10) : 0
      const fileNameHeader = proxyRes.headers.get('x-file-name')
      const fileName = fileNameHeader ? decodeURIComponent(fileNameHeader) : '在线音频.mp3'
      const mimeType = proxyRes.headers.get('content-type') || 'audio/mpeg'
      const CLIENT_MAX_SIZE_BYTES = 100 * 1024 * 1024

      if (totalSize > 0 && totalSize > CLIENT_MAX_SIZE_BYTES) {
        throw new Error(
          `文件过大 (${formatFileSize(totalSize)})，为避免浏览器崩溃已中止。最大支持 ${formatFileSize(CLIENT_MAX_SIZE_BYTES)}。`
        )
      }

      addLog(`开始下载: ${fileName} (${totalSize ? formatFileSize(totalSize) : '未知大小'})`, 'info')
      setStatusMessage(`正在下载 ${fileName}...`)

      // 流式读取并显示进度
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
        if (receivedLength > CLIENT_MAX_SIZE_BYTES) {
          await reader.cancel()
          throw new Error(
            `文件过大 (${formatFileSize(receivedLength)})，为避免浏览器崩溃已中止。最大支持 ${formatFileSize(CLIENT_MAX_SIZE_BYTES)}。`
          )
        }

        // 更新下载进度
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

      // 构造 File 对象
      const audioBlob = new Blob(chunks, { type: mimeType })
      const audioFile = new File([audioBlob], fileName, { type: mimeType })

      // 第二步：上传到 ASR（复用 transcribe 逻辑）
      setUploadProgress(0)
      setStatusMessage('正在上传到识别服务...')
      addLog('开始上传到 ASR 服务...', 'info')

      // 直接调用 transcribe，它会处理上传进度和识别
      await transcribe(audioFile, true)

    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e)
      setResult(`请求失败: ${errorMsg}`)
      setStatus('error')
      setStatusMessage('导入失败')
      addLog(`导入失败: ${errorMsg}`, 'error')
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
  const showIndeterminateProgress =
    (status === 'processing' && uploadProgress === 0) || status === 'transcribing'

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
    processing: { text: '处理中', color: 'bg-primary' },
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
    { id: 'transcription' as const, label: '转录结果' },
    { id: 'polish' as const, label: '润色输出' },
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
          aria-label={theme === 'light' ? '切换到暗色模式' : '切换到亮色模式'}
        >
          {theme === 'light' ? (
            <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          )}
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-12">
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
            <div className="flex" role="tablist" aria-label="主导航">
              {mainTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setCurrentTab(tab.id)}
                  role="tab"
                  aria-selected={currentTab === tab.id}
                  aria-controls={`tabpanel-${tab.id}`}
                  id={`tab-${tab.id}`}
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
              <div role="tabpanel" id="tabpanel-source" aria-labelledby="tab-source" className="space-y-5 animate-fade-in">
                {/* Upload Zone - Local File */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">本地上传</label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click() } }}
                    role="button"
                    tabIndex={0}
                    className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                    aria-label="选择音频文件"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-sm text-foreground">点击选择或拖拽音频文件</p>
                      <p className="text-xs text-muted-foreground">支持 mp3, wav, m4a, flac...</p>
                    </div>
                  </div>
                </div>
                <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleFileChange} className="hidden" aria-label="选择音频文件" />

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">或者</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* URL Input Section */}
                <div className="space-y-2">
                  <label htmlFor="audio-url-input" className="text-xs font-medium text-muted-foreground">在线链接</label>
                  <div className="flex gap-2">
                    <input
                      id="audio-url-input"
                      type="text"
                      value={audioUrlInput}
                      onChange={(e) => setAudioUrlInput(e.target.value)}
                      placeholder="粘贴音频链接..."
                      className="flex-1 px-3 py-2 bg-transparent rounded-lg border border-border text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary transition-colors"
                    />
                    <button
                      onClick={checkAudioUrl}
                      disabled={checking || !audioUrlInput.trim()}
                      className="px-4 py-2 min-h-[44px] bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium cursor-pointer transition-colors"
                    >
                      {checking ? '检查中...' : '检查'}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">支持 asmrgay.com 及备用站点的播放页面或直链</p>
                </div>

                {/* Selected Audio Display (unified - always visible) */}
                <div className="p-3 bg-muted/50 rounded-lg border border-border">
                  {audioInfo && !loading ? (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <svg className="w-5 h-5 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                          </svg>
                          <span className="text-sm text-foreground font-medium truncate">{audioInfo.name}</span>
                        </div>
                        <button
                          onClick={clearAudio}
                          className="p-1 hover:bg-muted rounded cursor-pointer ml-2"
                          aria-label="删除所选音频"
                        >
                          <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatFileSize(audioInfo.size)} · 来源: {audioInfo.source === 'local' ? '本地上传' : '在线链接'}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                      <span className="text-sm">未选择音频</span>
                    </div>
                  )}
                </div>

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
                  <div className="p-3 bg-muted/50 rounded-lg border border-border" role="status" aria-live="polite">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-2 h-2 rounded-full ${statusConfig[status].color} ${['processing', 'transcribing'].includes(status) ? 'animate-pulse' : ''}`} aria-hidden="true" />
                      <span className="text-sm font-medium text-foreground">{statusConfig[status].text}</span>
                      {status === 'processing' && uploadProgress > 0 && <span className="text-xs text-muted-foreground ml-auto">{uploadProgress}%</span>}
                    </div>
                    {status === 'processing' && uploadProgress > 0 && (
                      <div className="w-full h-1 bg-muted rounded-full overflow-hidden" role="progressbar" aria-valuenow={uploadProgress} aria-valuemin={0} aria-valuemax={100}>
                        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                      </div>
                    )}
                    {showIndeterminateProgress ? (
                      <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary/60 animate-pulse w-full" />
                      </div>
                    ) : null}
                    {statusMessage && <p className="text-xs text-muted-foreground mt-2">{statusMessage}</p>}
                  </div>
                )}
              </div>
            )}

            {/* Transcription Tab (转录结果) */}
            {currentTab === 'transcription' && (
              <div role="tabpanel" id="tabpanel-transcription" aria-labelledby="tab-transcription" className="space-y-4 animate-fade-in">
                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => polishText(result)}
                    disabled={polishing || !result || result.startsWith('错误') || result.startsWith('请求失败')}
                    className="px-4 py-2 min-h-[40px] bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium cursor-pointer transition-colors"
                  >
                    {polishing ? '润色中...' : '开始润色'}
                  </button>
                  <button
                    onClick={handleCopy}
                    disabled={!result}
                    className={`px-4 py-2 min-h-[40px] rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      copied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {copied ? '已复制' : '复制'}
                  </button>
                </div>

                {/* Transcription Content */}
                <div className="min-h-[200px] p-4 bg-muted/30 rounded-lg border border-border text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {result || <span className="text-muted-foreground">暂无转录结果，请先在「来源」页上传或导入音频...</span>}
                </div>

                {/* Character count */}
                {result && (
                  <p className="text-xs text-muted-foreground">
                    {result.length} 字符
                  </p>
                )}
              </div>
            )}

            {/* Polish Tab (润色输出) */}
            {currentTab === 'polish' && (
              <div role="tabpanel" id="tabpanel-polish" aria-labelledby="tab-polish" className="space-y-4 animate-fade-in">
                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => polishText(result)}
                    disabled={polishing || !result || result.startsWith('错误') || result.startsWith('请求失败')}
                    className="px-4 py-2 min-h-[40px] bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium cursor-pointer transition-colors"
                  >
                    {polishing ? '润色中...' : '重新润色'}
                  </button>
                  <button
                    onClick={handleCopyPolished}
                    disabled={!polishedResult}
                    className={`px-4 py-2 min-h-[40px] rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      copiedPolished
                        ? 'bg-emerald-600 text-white'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {copiedPolished ? '已复制' : '复制'}
                  </button>
                </div>

                {/* Polished Content */}
                <div className="min-h-[200px] p-4 bg-muted/30 rounded-lg border border-border text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {polishing ? (
                    <div className="flex items-center gap-2 text-primary">
                      <span className="ai-dots">
                        <span className="ai-dot" />
                        <span className="ai-dot" />
                        <span className="ai-dot" />
                      </span>
                      <span>正在润色...</span>
                    </div>
                  ) : (
                    polishedResult || <span className="text-muted-foreground">暂无润色结果，请先在「转录结果」页点击润色...</span>
                  )}
                </div>

                {/* Character count */}
                {polishedResult && !polishing && (
                  <p className="text-xs text-muted-foreground">
                    {polishedResult.length} 字符
                  </p>
                )}
              </div>
            )}

            {/* Settings Tab */}
            {currentTab === 'settings' && (
              <div role="tabpanel" id="tabpanel-settings" aria-labelledby="tab-settings" className="space-y-5 animate-fade-in">
                <div className="space-y-2">
                  {/* 第一行：状态指示器和操作按钮 */}
                  <div className="flex items-center gap-2">
                    <div
                      className={`text-xs font-medium ${
                        savingSettings
                          ? 'text-amber-600 dark:text-amber-400'
                        : envSaveError
                        ? 'text-destructive'
                        : isDirty
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {savingSettings ? '保存中...' : envSaveError ? '保存失败' : isDirty ? '未保存' : '已保存'}
                    </div>
                    <div className="flex-1" />
                    <button
                      onClick={() => reloadSettingsFromEnv(false)}
                      disabled={savingSettings}
                      className="px-3 py-1 min-h-[32px] bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-xs font-medium cursor-pointer transition-colors"
                    >
                      重新加载
                    </button>
                    <button
                      onClick={discardLocalChanges}
                      disabled={savingSettings || !isDirty}
                      className="px-3 py-1 min-h-[32px] bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-xs font-medium cursor-pointer transition-colors"
                    >
                      放弃改动
                    </button>
                    <button
                      onClick={saveSettingsToEnv}
                      disabled={!settingsLoaded || savingSettings || !isDirty}
                      className="px-3 py-1 min-h-[32px] bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-xs font-medium cursor-pointer transition-colors"
                    >
                      保存
                    </button>
                  </div>

                  {/* 第二行：配置文件路径 */}
                  <div className="text-xs text-muted-foreground">
                    配置文件: {envFilePath || '.env'}
                    {!envFileExists && (
                      <span className="ml-2 text-amber-600 dark:text-amber-400">（尚未创建）</span>
                    )}
                  </div>

                  {/* 条件渲染：错误和警告 */}
                  {settingsLoadError && <div className="text-xs text-destructive">{settingsLoadError}</div>}
                  {envSaveError && <div className="text-xs text-destructive">保存失败: {envSaveError}</div>}
                  {isDirty && (
                    <div className="text-xs text-amber-600 dark:text-amber-400">
                      点击「保存」写入.env 或点击「放弃改动」撤销本地修改。
                    </div>
                  )}
                </div>

                {/* ASR Config */}
                <div>
                  <h2 className="text-sm font-medium text-foreground mb-3">语音识别配置 (ASR)</h2>
                  <div className="space-y-3">
                    {/* 第一行：API URL 和 Model 并排（6:4）*/}
                    <div className="flex gap-3">
                      <div className="flex-[6]">
                        <label htmlFor="asr-api-url" className="block text-xs font-medium text-muted-foreground mb-1">API URL</label>
                        <input
                          id="asr-api-url"
                          type="text"
                          value={apiUrl}
                          onChange={(e) => setApiUrl(e.target.value)}
                          className="w-full px-3 py-2 bg-transparent rounded-lg border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary transition-colors"
                        />
                      </div>
                      <div className="flex-[4]">
                        <label htmlFor="asr-model" className="block text-xs font-medium text-muted-foreground mb-1">模型</label>
                        <input
                          id="asr-model"
                          type="text"
                          value={model}
                          onChange={(e) => setModel(e.target.value)}
                          className="w-full px-3 py-2 bg-transparent rounded-lg border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary transition-colors"
                        />
                      </div>
                    </div>

                    {/* 第二行：API Key（宽度和 URL 一致，占 60%）*/}
                    <div className="flex gap-3">
                      <div className="flex-[6]">
                        <label htmlFor="asr-api-key" className="block text-xs font-medium text-muted-foreground mb-1">API Key</label>
                        <input
                          id="asr-api-key"
                          type="password"
                          placeholder="硅基流动 API Key（必填）"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          className="w-full px-3 py-2 bg-transparent rounded-lg border border-border text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary transition-colors"
                        />
                      </div>
                      <div className="flex-[4]" />
                    </div>
                  </div>
                </div>

                  {/* LLM Config */}
                <div>
                  <h2 className="text-sm font-medium text-foreground mb-3">文本润色配置 (LLM · OpenAI 兼容)</h2>
                  <div className="space-y-3">
                    {/* 第一行：API URL 和模型并排（6:4）*/}
                    <div className="flex gap-3">
                      <div className="flex-[6]">
                        <label htmlFor="llm-api-url" className="block text-xs font-medium text-muted-foreground mb-1">API URL</label>
                        <input
                          id="llm-api-url"
                          type="text"
                          value={llmApiUrl}
                          onChange={(e) => setLlmApiUrl(e.target.value)}
                          className="w-full px-3 py-2 bg-transparent rounded-lg border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary transition-colors"
                        />
                      </div>
                      <div className="flex-[4]">
                        <label htmlFor="llm-model" className="block text-xs font-medium text-muted-foreground mb-1">模型</label>
                        <input
                          id="llm-model"
                          type="text"
                          value={llmModel}
                          onChange={(e) => setLlmModel(e.target.value)}
                          className="w-full px-3 py-2 bg-transparent rounded-lg border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary transition-colors"
                        />
                      </div>
                    </div>

                    {/* 第二行：API Key（宽度和 URL 一致，占 60%）*/}
                    <div className="flex gap-3">
                      <div className="flex-[6]">
                        <label htmlFor="llm-api-key" className="block text-xs font-medium text-muted-foreground mb-1">API Key</label>
                        <input
                          id="llm-api-key"
                          type="password"
                          placeholder="LLM API Key"
                          value={llmApiKey}
                          onChange={(e) => setLlmApiKey(e.target.value)}
                          className="w-full px-3 py-2 bg-transparent rounded-lg border border-border text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary transition-colors"
                        />
                      </div>
                      <div className="flex-[4]" />
                    </div>

                    {/* 第三行：润色指令 */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label htmlFor="custom-instructions" className="block text-xs font-medium text-muted-foreground">润色指令</label>
                        <button
                          onClick={() => setCustomInstructions(DEFAULT_INSTRUCTIONS)}
                          className="text-xs text-primary hover:text-primary/80 font-medium cursor-pointer transition-colors"
                          aria-label="恢复默认润色指令"
                        >
                          恢复默认
                        </button>
                      </div>
                      <textarea
                        id="custom-instructions"
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
                  <h2 className="text-sm font-medium text-foreground mb-1">网络代理</h2>
                  <p className="text-xs text-muted-foreground mb-3">留空则直连</p>
                  <div>
                    <label htmlFor="proxy-url" className="block text-xs font-medium text-muted-foreground mb-1">代理地址</label>
                    <input
                      id="proxy-url"
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
              <div role="tabpanel" id="tabpanel-logs" aria-labelledby="tab-logs" className="space-y-4 animate-fade-in">
                {/* Filter chips */}
                <div className="flex items-center gap-2" role="group" aria-label="日志筛选">
                  {(['all', 'error', 'success', 'info'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setLogFilter(filter)}
                      aria-pressed={logFilter === filter}
                      className={`px-3 py-1 min-h-[32px] rounded-full text-xs font-medium cursor-pointer transition-colors ${
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
                    aria-label="清空日志"
                  >
                    清空
                  </button>
                </div>

                {/* Logs list */}
                <div
                  ref={logsContainerRef}
                  className="h-64 overflow-y-auto overflow-x-hidden p-3 bg-muted/30 rounded-lg border border-border font-mono text-xs space-y-1"
                >
                  {filteredLogs.length === 0 ? (
                    <span className="text-muted-foreground">暂无日志...</span>
                  ) : (
                    filteredLogs.map((log, i) => (
                      <div key={i} className={`${logColors[log.type]} animate-slide-in break-all`}>
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
