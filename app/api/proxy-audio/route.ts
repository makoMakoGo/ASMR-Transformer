import { NextRequest, NextResponse } from 'next/server'
import { isAlistPageUrl, resolveAlistUrl } from '@/lib/alist-utils'
import { fetchWithProxy } from '@/lib/fetch-utils'
import { getAudioMimeType, isPrivateHost, isValidAudioUrl } from '@/lib/url-utils'

export const runtime = 'nodejs'

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (ASMR-Transformer/1.0)'
const FETCH_TIMEOUT_MS = 120_000 // 2 minutes for initial connection
const MAX_AUDIO_BYTES =
  Number(process.env.FETCH_AUDIO_MAX_BYTES || 100 * 1024 * 1024) || 100 * 1024 * 1024

/**
 * POST /api/proxy-audio
 *
 * 流式代理音频文件，返回二进制流 + Content-Length
 * 前端可以显示下载进度
 *
 * Request body:
 * - url: 音频 URL（支持 AList 播放页面）
 * - proxyUrl?: 可选代理
 *
 * Response:
 * - 成功：音频二进制流，带 Content-Length, Content-Type, X-File-Name 头
 * - 失败：JSON 错误信息
 */
export async function POST(req: NextRequest): Promise<Response> {
  let body: Record<string, unknown> | null = null
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 })
  }

  let audioUrl = String(body?.url || '').trim()
  if (!audioUrl) {
    return NextResponse.json({ error: '缺少音频 URL' }, { status: 400 })
  }

  const proxyUrl = String(body?.proxyUrl || '').trim()
  const allowPrivateHosts = process.env.ALLOW_PRIVATE_HOSTS === '1'

  // 如果是 AList 播放页面，先解析真实音频 URL
  let fileName = ''
  if (isAlistPageUrl(audioUrl)) {
    try {
      const fetchFn = (fetchUrl: string, init?: RequestInit) =>
        fetchWithProxy(fetchUrl, init, proxyUrl || undefined)
      const result = await resolveAlistUrl(audioUrl, fetchFn, DEFAULT_USER_AGENT)
      audioUrl = result.rawUrl
      fileName = result.fileName
    } catch (error) {
      return NextResponse.json(
        { error: `解析播放页面失败: ${(error as Error).message}` },
        { status: 400 }
      )
    }
  }

  if (!isValidAudioUrl(audioUrl)) {
    return NextResponse.json({ error: '音频 URL 无效或不受支持' }, { status: 400 })
  }

  const urlObj = new URL(audioUrl)
  if (!allowPrivateHosts && isPrivateHost(urlObj.hostname)) {
    return NextResponse.json({ error: '不支持访问本机或内网地址' }, { status: 400 })
  }

  // 从 URL 提取文件名（如果还没有）
  if (!fileName) {
    try {
      const pathParts = urlObj.pathname.split('/')
      fileName = decodeURIComponent(pathParts[pathParts.length - 1] || 'audio')
    } catch {
      fileName = 'audio'
    }
  }

  const abortController = new AbortController()
  const timeoutId = setTimeout(() => abortController.abort(), FETCH_TIMEOUT_MS)

  let audioResponse: Response
  try {
    audioResponse = await fetchWithProxy(audioUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: abortController.signal,
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        Referer: urlObj.origin,
      },
    }, proxyUrl || undefined)
  } catch (error) {
    clearTimeout(timeoutId)
    if ((error as Error).name === 'AbortError') {
      return NextResponse.json({ error: '连接超时，请稍后重试' }, { status: 504 })
    }
    return NextResponse.json(
      { error: `无法连接音频源: ${(error as Error).message}` },
      { status: 502 }
    )
  }

  clearTimeout(timeoutId)

  if (!audioResponse.ok) {
    return NextResponse.json(
      { error: `音频源返回错误 (${audioResponse.status})` },
      { status: audioResponse.status >= 500 ? 502 : 400 }
    )
  }

  // 验证 Content-Type
  const contentTypeHeader = (audioResponse.headers.get('content-type') || '').split(';')[0].trim()
  const mimeFromUrl = getAudioMimeType(audioUrl)
  const isAudio =
    (contentTypeHeader && contentTypeHeader.startsWith('audio/')) ||
    contentTypeHeader.includes('octet-stream') ||
    (!!mimeFromUrl && mimeFromUrl.startsWith('audio/'))

  if (!isAudio) {
    return NextResponse.json(
      { error: '该链接返回的内容不是音频格式' },
      { status: 400 }
    )
  }

  // 检查文件大小
  const contentLength = audioResponse.headers.get('content-length')
  if (contentLength && Number(contentLength) > MAX_AUDIO_BYTES) {
    const maxMB = Math.round(MAX_AUDIO_BYTES / (1024 * 1024))
    return NextResponse.json(
      { error: `音频文件过大，超过 ${maxMB}MB 限制` },
      { status: 413 }
    )
  }

  if (!audioResponse.body) {
    return NextResponse.json({ error: '无法读取音频数据流' }, { status: 500 })
  }

  // 确定 Content-Type
  const finalContentType =
    (contentTypeHeader && contentTypeHeader.startsWith('audio/') && contentTypeHeader) ||
    mimeFromUrl ||
    'application/octet-stream'

  // 构建响应头
  const headers = new Headers({
    'Content-Type': finalContentType,
    'X-File-Name': encodeURIComponent(fileName),
    'Cache-Control': 'no-cache',
  })

  if (contentLength) {
    headers.set('Content-Length', contentLength)
  }

  let bytesRead = 0
  const limitedStream = audioResponse.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        bytesRead += chunk.byteLength
        if (bytesRead > MAX_AUDIO_BYTES) {
          abortController.abort()
          controller.error(new Error('MAX_AUDIO_BYTES_EXCEEDED'))
          return
        }
        controller.enqueue(chunk)
      },
    })
  )

  return new Response(limitedStream, {
    status: 200,
    headers,
  })
}
