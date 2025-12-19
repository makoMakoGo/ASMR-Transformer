import { NextRequest, NextResponse } from 'next/server'
import { ProxyAgent, fetch as undiciFetch } from 'undici'
import {
  extractFileName,
  getAudioMimeType,
  getExtensionFromMime,
  isValidAudioUrl,
} from '@/lib/url-utils'

export const runtime = 'nodejs'

// 封装 fetch，支持可选代理
const fetchWithProxy = async (url: string, init?: RequestInit, proxyUrl?: string): Promise<Response> => {
  if (proxyUrl) {
    const agent = new ProxyAgent(proxyUrl)
    return undiciFetch(url, { ...init, dispatcher: agent } as Parameters<typeof undiciFetch>[1]) as unknown as Response
  }
  return fetch(url, init)
}

const DEFAULT_ASR_API_URL = 'https://api.siliconflow.cn/v1/audio/transcriptions'
const DEFAULT_ASR_MODEL = 'TeleAI/TeleSpeechASR'
const DEFAULT_LLM_API_URL = 'https://juya.owl.ci/v1'
const DEFAULT_LLM_MODEL = 'DeepSeek-V3.1-Terminus'
const DEFAULT_LLM_API_KEY = 'sk-kUm2RSHxuRJyjdrzdwprHYFYwvE4NTkIzRoyyaiDoh7YyDIZ'
const DEFAULT_INSTRUCTIONS =
  '请对以下语音转文字内容进行处理：1. 纠正错别字和语法错误 2. 添加适当的标点符号 3. 分段排版使内容更易读 4. 保持原意不变，不要添加或删除内容'

const FETCH_TIMEOUT_MS = 60_000
const MAX_AUDIO_BYTES =
  Number(process.env.FETCH_AUDIO_MAX_BYTES || 50 * 1024 * 1024) || 50 * 1024 * 1024
const MAX_AUDIO_LABEL = `${Math.round(MAX_AUDIO_BYTES / (1024 * 1024))}MB`
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (ASMR-Transformer/1.0)'

// AList 站点配置（支持自动解析播放页面）
const ALIST_SITES = [
  'asmrgay.com',
  'www.asmrgay.com',
  'asmr.pw',
  'www.asmr.pw',
  'asmr.loan',
  'www.asmr.loan',
  'asmr.party',
  'www.asmr.party',
  'asmr.stream',
  'www.asmr.stream',
]

// 检测是否为 AList 播放页面 URL（非 /d/ 开头的路径）
const isAlistPageUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url)
    const isAlistSite = ALIST_SITES.some(
      (h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`)
    )
    // 播放页面路径不以 /d/ 开头
    return isAlistSite && !parsed.pathname.startsWith('/d/')
  } catch {
    return false
  }
}

// 调用 AList API 获取真实音频 URL
const resolveAlistUrl = async (pageUrl: string, proxyUrl?: string): Promise<string> => {
  const parsed = new URL(pageUrl)
  const apiUrl = `${parsed.origin}/api/fs/get`
  const path = decodeURIComponent(parsed.pathname)

  const res = await fetchWithProxy(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': DEFAULT_USER_AGENT,
    },
    body: JSON.stringify({ path }),
  }, proxyUrl)

  if (!res.ok) throw new Error(`AList API 错误 (${res.status})`)

  const data = await res.json()
  if (data.code !== 200 || !data.data?.raw_url) {
    throw new Error(data.message || '无法获取音频地址')
  }

  return data.data.raw_url
}

type FetchAudioResponse = {
  success: boolean
  transcription?: string
  polished?: string
  error?: string
  metadata?: {
    processingTime: number
    fileName: string
    fileSize: number
    sourceUrl: string
    contentType: string
  }
}

const sanitizeFileName = (name: string, extensionHint?: string | null): string => {
  const base = (name || 'audio-from-url').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_')
  if (base.includes('.') || !extensionHint) return base
  return `${base}.${extensionHint}`
}

const polishText = async (
  text: string,
  apiUrl: string,
  apiKey: string,
  model: string,
  customInstructions: string
): Promise<string> => {
  const instructions = customInstructions?.trim() || DEFAULT_INSTRUCTIONS
  const userMessage = `${instructions}\n\n---\n\n${text}`
  const fullUrl = `${apiUrl}/chat/completions`

  const response = await fetch(fullUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: '你是一个专业的文字编辑助手。你的任务是对语音转文字的内容进行润色处理。请直接输出处理后的文本，不要有任何解释、前言或后语。' },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
      stream: false,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`LLM API 错误 (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

const readStreamWithLimit = async (response: Response): Promise<Uint8Array> => {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('无法读取音频数据流')

  const chunks: Uint8Array[] = []
  let total = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue

    total += value.length
    if (total > MAX_AUDIO_BYTES) {
      await reader.cancel('Audio too large')
      throw new Error('PAYLOAD_TOO_LARGE')
    }

    chunks.push(value)
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
}

const buildJson = (payload: FetchAudioResponse, status = 200) =>
  NextResponse.json(payload, { status })

export async function POST(req: NextRequest): Promise<NextResponse<FetchAudioResponse>> {
  const startTime = Date.now()

  let body: Record<string, unknown> | null = null
  try {
    body = await req.json()
  } catch {
    return buildJson({ success: false, error: '请求体必须为 JSON' }, 400)
  }

  let audioUrl = String(body?.url || '').trim()
  if (!audioUrl) {
    return buildJson({ success: false, error: '缺少音频 URL' }, 400)
  }

  const proxyUrl = (body?.proxyUrl as string) || ''

  // 如果是 AList 播放页面，先解析真实音频 URL
  if (isAlistPageUrl(audioUrl)) {
    try {
      audioUrl = await resolveAlistUrl(audioUrl, proxyUrl)
    } catch (error) {
      return buildJson({ success: false, error: `解析播放页面失败: ${(error as Error).message}` }, 400)
    }
  }

  if (!isValidAudioUrl(audioUrl)) {
    return buildJson({ success: false, error: '音频 URL 无效或不受支持' }, 400)
  }

  const asrApiKey = (body?.asrApiKey as string) || process.env.ASR_API_KEY
  if (!asrApiKey) {
    return buildJson(
      { success: false, error: '缺少 ASR API Key（请在请求中提供或在服务器 .env 中配置 ASR_API_KEY）' },
      400
    )
  }

  const asrApiUrl = (body?.asrApiUrl as string) || process.env.ASR_API_URL || DEFAULT_ASR_API_URL
  const asrModel = (body?.asrModel as string) || process.env.ASR_MODEL || DEFAULT_ASR_MODEL

  const shouldPolish = body?.polish === true || body?.polish === 'true'
  const llmApiKey = (body?.llmApiKey as string) || process.env.LLM_API_KEY || DEFAULT_LLM_API_KEY
  const llmApiUrl = (body?.llmApiUrl as string) || process.env.LLM_API_URL || DEFAULT_LLM_API_URL
  const llmModel = (body?.llmModel as string) || process.env.LLM_MODEL || DEFAULT_LLM_MODEL
  const customInstructions = (body?.customInstructions as string) || DEFAULT_INSTRUCTIONS

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  let fetched: Response
  try {
    fetched = await fetchWithProxy(audioUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        Referer: new URL(audioUrl).origin,
      },
    }, proxyUrl)
  } catch (error) {
    clearTimeout(timeoutId)
    if ((error as Error).name === 'AbortError') {
      return buildJson({ success: false, error: '下载音频超时，请稍后重试' }, 504)
    }
    return buildJson({ success: false, error: `无法下载音频: ${(error as Error).message}` }, 502)
  }

  clearTimeout(timeoutId)

  if (!fetched.ok) {
    const status = fetched.status === 404 ? 404 : fetched.status >= 500 ? 502 : 400
    return buildJson({ success: false, error: `音频源返回错误 (${fetched.status})` }, status)
  }

  const contentTypeHeader = (fetched.headers.get('content-type') || '').split(';')[0].trim()
  const mimeFromUrl = getAudioMimeType(audioUrl)
  const isAudio =
    (contentTypeHeader && contentTypeHeader.startsWith('audio/')) ||
    (!!mimeFromUrl && mimeFromUrl.startsWith('audio/'))

  if (!isAudio) {
    return buildJson({ success: false, error: '该链接返回的内容不是音频格式' }, 400)
  }

  const contentLengthHeader = fetched.headers.get('content-length')
  if (contentLengthHeader && Number(contentLengthHeader) > MAX_AUDIO_BYTES) {
    return buildJson({ success: false, error: `音频文件过大，超过 ${MAX_AUDIO_LABEL} 限制` }, 413)
  }

  let audioBuffer: Uint8Array
  try {
    audioBuffer = await readStreamWithLimit(fetched)
  } catch (error) {
    if ((error as Error).message === 'PAYLOAD_TOO_LARGE') {
      return buildJson({ success: false, error: `音频文件过大，超过 ${MAX_AUDIO_LABEL} 限制` }, 413)
    }
    return buildJson({ success: false, error: (error as Error).message }, 500)
  }

  if (!audioBuffer || audioBuffer.byteLength === 0) {
    return buildJson({ success: false, error: '无法读取音频内容' }, 400)
  }

  const extensionHint =
    getExtensionFromMime(contentTypeHeader) || getExtensionFromMime(mimeFromUrl || '') || null

  const fileName = sanitizeFileName(extractFileName(audioUrl), extensionHint)
  const mimeType =
    (contentTypeHeader && contentTypeHeader.startsWith('audio/') && contentTypeHeader) ||
    mimeFromUrl ||
    'application/octet-stream'

  const audioBlob = new Blob([audioBuffer], { type: mimeType })

  const asrForm = new FormData()
  asrForm.append('file', audioBlob, fileName)
  asrForm.append('model', asrModel)

  const asrResponse = await fetch(asrApiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${asrApiKey}`,
    },
    body: asrForm,
  })

  if (!asrResponse.ok) {
    const errorText = await asrResponse.text()
    return buildJson(
      { success: false, error: `ASR API 错误 (${asrResponse.status}): ${errorText}` },
      asrResponse.status
    )
  }

  const asrData = await asrResponse.json()
  const transcription = asrData.text || ''

  if (!transcription) {
    return buildJson({ success: false, error: '语音识别未返回文本' }, 500)
  }

  let polished: string | undefined
  if (shouldPolish) {
    try {
      polished = await polishText(transcription, llmApiUrl, llmApiKey, llmModel, customInstructions)
    } catch (error) {
      // Polishing failure should not block transcription result
      console.error('Polish error:', error)
    }
  }

  const processingTime = Date.now() - startTime

  return buildJson({
    success: true,
    transcription,
    polished: polished || undefined,
    metadata: {
      processingTime,
      fileName,
      fileSize: audioBuffer.byteLength,
      sourceUrl: audioUrl,
      contentType: mimeType,
    },
  })
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    name: 'Fetch Audio API',
    version: '1.0.0',
    description: '从远程 URL 获取音频并转录，支持可选文本润色',
    endpoints: {
      'POST /api/fetch-audio': '从 URL 下载音频并调用 ASR 转录，可选润色',
      'GET /api/fetch-audio': '获取接口信息',
    },
    limits: {
      maxFileSize: '50MB',
      timeout: '60s',
    },
  })
}
