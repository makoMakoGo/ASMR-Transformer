'use client'

import { useState, useRef } from 'react'

// 默认配置：ASR 使用硅基流动免费模型，LLM 使用内置不限量润色服务
const DEFAULT_ASR_API_URL = 'https://api.siliconflow.cn/v1/audio/transcriptions'
const DEFAULT_ASR_MODEL = 'TeleAI/TeleSpeechASR'
const DEFAULT_LLM_API_URL = 'https://juya.owl.ci/v1'
const DEFAULT_LLM_MODEL = 'DeepSeek-V3.1-Terminus'
// 由仓库作者提供的免费无限制润色 API Key，仅用于演示/默认调用
const DEFAULT_LLM_API_KEY = 'sk-kUm2RSHxuRJyjdrzdwprHYFYwvE4NTkIzRoyyaiDoh7YyDIZ'

type LogEntry = {
  time: string
  message: string
  type: 'info' | 'success' | 'error' | 'warning'
}

export default function Home() {
  const [apiKey, setApiKey] = useState('')
  const [apiUrl, setApiUrl] = useState(DEFAULT_ASR_API_URL)
  const [model, setModel] = useState(DEFAULT_ASR_MODEL)
  const [llmApiUrl, setLlmApiUrl] = useState(DEFAULT_LLM_API_URL)
  const [llmModel, setLlmModel] = useState(DEFAULT_LLM_MODEL)
  // 默认留空，空值时自动回落到内置免费 Key
  const [llmApiKey, setLlmApiKey] = useState('')
  const [result, setResult] = useState('')
  const [polishedResult, setPolishedResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [polishing, setPolishing] = useState(false)
  const [recording, setRecording] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'transcribing' | 'done' | 'error'>('idle')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [fileInfo, setFileInfo] = useState<{ name: string; size: string; type: string } | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [copied, setCopied] = useState(false)
  const [copiedPolished, setCopiedPolished] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const logsEndRef = useRef<HTMLDivElement>(null)

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    setLogs((prev) => [...prev, { time, message, type }])
    setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
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

    // 若用户未填写，回落到仓库作者提供的免费不限量润色 Key
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
      addLog('未填写 LLM Key，已自动使用内置免费无限制 Key', 'warning')
    }
    if (!llmApiUrl.trim()) addLog('未填写 LLM API URL，已使用默认 juya 地址', 'warning')
    if (!llmModel.trim()) addLog('未填写 LLM 模型，已使用默认 DeepSeek-V3.1-Terminus', 'warning')

    try {
      const res = await fetch('/api/polish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          apiUrl: effectiveLlmApiUrl,
          apiKey: effectiveLlmApiKey,
          model: effectiveLlmModel,
        }),
      })

      const data = await res.json()

      if (res.ok && data.choices?.[0]?.message?.content) {
        const polished = data.choices[0].message.content
        setPolishedResult(polished)
        addLog(`润色完成! 文本长度: ${polished.length} 字符`, 'success')
      } else {
        addLog(`润色失败: ${JSON.stringify(data)}`, 'error')
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

    const info = { name: file.name, size: formatFileSize(file.size), type: file.type || 'unknown' }
    setFileInfo(info)

    addLog(`开始处理文件: ${info.name}`, 'info')
    addLog(`文件大小: ${info.size}`, 'info')
    addLog(`文件类型: ${info.type}`, 'info')
    const effectiveApiUrl = apiUrl.trim() || DEFAULT_ASR_API_URL
    const effectiveModel = model.trim() || DEFAULT_ASR_MODEL

    addLog(`目标 API: ${effectiveApiUrl}`, 'info')
    addLog(`使用模型: ${effectiveModel}`, 'info')
    if (!apiUrl.trim()) addLog('未填写 API URL，已使用默认硅基流动地址', 'warning')
    if (!model.trim()) addLog('未填写模型，已使用默认 TeleAI/TeleSpeechASR', 'warning')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('model', effectiveModel)

    try {
      addLog('正在上传文件...', 'info')

      const xhr = new XMLHttpRequest()

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100)
          setUploadProgress(percent)
          if (percent % 20 === 0 || percent === 100) {
            addLog(`上传进度: ${percent}% (${formatFileSize(e.loaded)} / ${formatFileSize(e.total)})`, 'info')
          }
        }
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

        addLog('文件上传完成，等待服务器处理...', 'success')
        setStatus('transcribing')
        addLog('正在进行语音识别...', 'info')
      })

      const elapsed = new Date().toLocaleTimeString('zh-CN', { hour12: false })
      addLog(`收到服务器响应 (${elapsed})`, 'info')
      addLog(`HTTP 状态码: ${response.status}`, response.ok ? 'success' : 'error')

      if (response.ok) {
        const text = (response.data.text as string) || ''
        setResult(text || '转录完成但无文本返回')
        setStatus('done')
        addLog(`转录成功! 文本长度: ${text.length} 字符`, 'success')
        if (response.data.duration) {
          addLog(`音频时长: ${response.data.duration} 秒`, 'info')
        }
      } else {
        setResult(`错误: ${response.status} - ${JSON.stringify(response.data)}`)
        setStatus('error')
        addLog(`API 错误: ${JSON.stringify(response.data)}`, 'error')
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e)
      setResult(`请求失败: ${errorMsg}`)
      setStatus('error')
      addLog(`请求失败: ${errorMsg}`, 'error')
    } finally {
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

  const toggleRecording = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop()
      setRecording(false)
      addLog('录音停止', 'info')
    } else {
      try {
        addLog('请求麦克风权限...', 'info')
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        addLog('麦克风权限已获取', 'success')

        const mediaRecorder = new MediaRecorder(stream)
        mediaRecorderRef.current = mediaRecorder
        chunksRef.current = []

        mediaRecorder.ondataavailable = (e) => {
          chunksRef.current.push(e.data)
          addLog(`录音数据块: ${formatFileSize(e.data.size)}`, 'info')
        }

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
          const file = new File([blob], 'recording.webm', { type: 'audio/webm' })
          setSelectedFile(file)
          const info = { name: file.name, size: formatFileSize(blob.size), type: 'audio/webm' }
          setFileInfo(info)
          addLog(`录音完成，总大小: ${info.size}，点击"开始转录"处理`, 'success')
          stream.getTracks().forEach((t) => t.stop())
        }

        mediaRecorder.start(1000)
        setRecording(true)
        addLog('开始录音...', 'success')
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e)
        setResult('无法访问麦克风')
        addLog(`麦克风访问失败: ${errorMsg}`, 'error')
      }
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

  const statusText = {
    idle: '等待输入',
    uploading: '上传中...',
    transcribing: '转录中...',
    done: '完成',
    error: '出错',
  }

  const statusColor = {
    idle: 'bg-gray-200',
    uploading: 'bg-blue-500',
    transcribing: 'bg-yellow-500',
    done: 'bg-green-500',
    error: 'bg-red-500',
  }

  const logColor = {
    info: 'text-gray-400',
    success: 'text-green-400',
    error: 'text-red-400',
    warning: 'text-yellow-400',
  }

  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-center mb-6">🎙️ 语音转文字</h1>

      {/* API 配置 */}
      <div className="bg-white rounded-lg shadow p-4 mb-4 space-y-3">
        <h2 className="font-semibold text-gray-700">⚙️ 语音识别 API 配置</h2>
        <p className="text-xs text-gray-500 leading-relaxed">
          使用硅基流动中文官网可免费申请 TeleAI/TeleSpeechASR 模型的 API Key。留空模型与 URL 将使用默认官方地址与模型。
        </p>
        <input
          type="password"
          placeholder="硅基流动 API Key（必填，可免费申请）"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="w-full px-3 py-2 border rounded-md"
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500">API URL</label>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">模型</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>
        </div>
      </div>

      {/* LLM 配置 */}
      <div className="bg-white rounded-lg shadow p-4 mb-4 space-y-3">
        <h2 className="font-semibold text-gray-700">🤖 文本润色 LLM 配置</h2>
        <p className="text-xs text-gray-500 leading-relaxed">
          已内置免费不限量的润色服务（DeepSeek-V3.1-Terminus，juya）。不填 Key 时自动使用内置 Key；如需自定义可填写自己的 API。
        </p>
        <input
          type="password"
          placeholder="LLM API Key"
          value={llmApiKey}
          onChange={(e) => setLlmApiKey(e.target.value)}
          className="w-full px-3 py-2 border rounded-md"
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500">LLM API URL</label>
            <input
              type="text"
              value={llmApiUrl}
              onChange={(e) => setLlmApiUrl(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">LLM 模型</label>
            <input
              type="text"
              value={llmModel}
              onChange={(e) => setLlmModel(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex gap-3 mb-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="flex-1 bg-blue-500 text-white py-3 rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            📁 选择文件
          </button>
          <button
            onClick={toggleRecording}
            disabled={loading}
            className={`flex-1 py-3 rounded-md text-white ${recording ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'bg-green-500 hover:bg-green-600'} disabled:opacity-50`}
          >
            {recording ? '⏹️ 停止录音' : '🎤 开始录音'}
          </button>
        </div>

        {/* 已选文件显示 */}
        {fileInfo && !loading && (
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md mb-3">
            <div className="text-sm">
              <span className="font-medium">{fileInfo.name}</span>
              <span className="text-gray-500 ml-2">({fileInfo.size})</span>
            </div>
            <button
              onClick={() => {
                setSelectedFile(null)
                setFileInfo(null)
                if (fileInputRef.current) fileInputRef.current.value = ''
              }}
              className="text-gray-400 hover:text-red-500"
            >
              ✕
            </button>
          </div>
        )}

        {/* 开始转录按钮 */}
        <button
          onClick={handleStartTranscribe}
          disabled={loading || !selectedFile}
          className="w-full bg-purple-600 text-white py-3 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {loading ? '处理中...' : '🚀 开始转录'}
        </button>

        <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleFileChange} className="hidden" />
      </div>

      {/* 状态和进度 */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${statusColor[status]} ${status === 'transcribing' ? 'animate-pulse' : ''}`}></span>
            <span className="font-medium">{statusText[status]}</span>
          </div>
        </div>

        {/* 上传进度条 */}
        {(status === 'uploading' || status === 'transcribing') && (
          <div className="mb-3">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>上传进度</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* 转录进度指示 */}
        {status === 'transcribing' && (
          <div className="flex items-center gap-2 text-yellow-600">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">服务器正在处理音频...</span>
          </div>
        )}
      </div>

      {/* 转录结果 */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-semibold text-gray-700">📝 原始转录结果</h2>
          <div className="flex gap-2">
            {result && !result.startsWith('错误') && !result.startsWith('请求失败') && (
              <button
                onClick={() => polishText(result)}
                disabled={polishing}
                className="px-4 py-1.5 rounded-md text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50"
              >
                {polishing ? '润色中...' : '✨ 润色排版'}
              </button>
            )}
            {result && (
              <button
                onClick={handleCopy}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  copied ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {copied ? '✓ 已复制' : '📋 复制'}
              </button>
            )}
          </div>
        </div>
        <div className="min-h-[100px] p-3 bg-gray-50 rounded-md text-gray-800 whitespace-pre-wrap">
          {result || '等待输入...'}
        </div>
        {result && (
          <div className="mt-2 text-sm text-gray-400">
            共 {result.length} 字符
          </div>
        )}
      </div>

      {/* 润色结果 */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-semibold text-gray-700">✨ 润色后结果</h2>
          {polishedResult && (
            <button
              onClick={handleCopyPolished}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                copiedPolished ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {copiedPolished ? '✓ 已复制' : '📋 一键复制'}
            </button>
          )}
        </div>
        <div className="min-h-[100px] p-3 bg-gradient-to-br from-orange-50 to-yellow-50 rounded-md text-gray-800 whitespace-pre-wrap">
          {polishing ? (
            <div className="flex items-center gap-2 text-orange-600">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>正在润色文本...</span>
            </div>
          ) : (
            polishedResult || '点击"润色排版"按钮处理原始文本...'
          )}
        </div>
        {polishedResult && (
          <div className="mt-2 text-sm text-gray-400">
            共 {polishedResult.length} 字符
          </div>
        )}
      </div>

      {/* 日志面板 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-semibold text-gray-700">📜 运行日志</h2>
          <button onClick={clearLogs} className="text-xs text-gray-400 hover:text-gray-600">
            清空日志
          </button>
        </div>
        <div className="h-48 overflow-y-auto bg-gray-900 rounded-md p-3 font-mono text-xs">
          {logs.length === 0 ? (
            <span className="text-gray-500">暂无日志...</span>
          ) : (
            logs.map((log, i) => (
              <div key={i} className={logColor[log.type]}>
                <span className="text-gray-500">[{log.time}]</span> {log.message}
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </main>
  )
}
