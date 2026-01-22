import { NextRequest, NextResponse } from 'next/server'
import { isAlistPageUrl, resolveAlistUrl } from '@/lib/alist-utils'
import { getFetchAudioMaxBytes } from '@/lib/runtime-config'
import {
  allowedAudioExtensions,
  getAudioMimeType,
  getExtensionFromUrl,
  isAllowedAudioHost,
  isPrivateHost,
} from '@/lib/url-utils'

export const runtime = 'nodejs'

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (ASMR-Transformer/1.0)'
const FETCH_TIMEOUT_MS = 120_000 // 2 minutes for initial connection
const MAX_AUDIO_BYTES = getFetchAudioMaxBytes()

type AudioUrlValidationResult =
  | { ok: true; url: URL }
  | { ok: false; error: 'INVALID_URL' | 'PRIVATE_HOST' }

const validateAndParseAudioUrl = (
  input: string,
  options: { requireAudioExtension?: boolean } = {}
): AudioUrlValidationResult => {
  let url: URL
  try {
    url = new URL(input)
  } catch {
    return { ok: false, error: 'INVALID_URL' }
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    return { ok: false, error: 'INVALID_URL' }
  }

  if (isPrivateHost(url.hostname)) {
    return { ok: false, error: 'PRIVATE_HOST' }
  }

  if (!isAllowedAudioHost(url.hostname)) {
    return { ok: false, error: 'INVALID_URL' }
  }

  if (options.requireAudioExtension) {
    const ext = getExtensionFromUrl(input)
    if (!ext || !allowedAudioExtensions.includes(ext)) {
      return { ok: false, error: 'INVALID_URL' }
    }
  }

  return { ok: true, url }
}

/**
 * POST /api/proxy-audio
 *
 * 流式代理音频文件，返回二进制流（源站提供时附带 Content-Length）
 * 前端可以显示下载进度
 *
 * Request body:
 * - url: 音频 URL（支持 AList 播放页面）
 *
 * Response:
 * - 成功：音频二进制流，带 Content-Type、X-File-Name 头；源站提供时包含 Content-Length
 * - 失败：JSON 错误信息
 */
export async function POST(req: NextRequest): Promise<Response> {
  // 创建超时 signal 并与客户端断开 signal 合并
  // 客户端刷新/关闭页面时，req.signal 会 abort，同时中止所有外部请求
  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => timeoutController.abort(), FETCH_TIMEOUT_MS)
  const combinedSignal = AbortSignal.any([req.signal, timeoutController.signal])

  // 清理函数
  const cleanup = () => clearTimeout(timeoutId)

  let body: Record<string, unknown> | null = null
  try {
    body = await req.json()
  } catch {
    cleanup()
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 })
  }

  let audioUrl = String(body?.url || '').trim()
  if (!audioUrl) {
    cleanup()
    return NextResponse.json({ error: '缺少音频 URL' }, { status: 400 })
  }

  const isAlistPage = isAlistPageUrl(audioUrl)
  const inputUrlResult = validateAndParseAudioUrl(audioUrl, {
    requireAudioExtension: !isAlistPage,
  })
  if (!inputUrlResult.ok) {
    cleanup()
    return NextResponse.json(
      {
        error:
          inputUrlResult.error === 'PRIVATE_HOST'
            ? '不支持访问本机或内网地址'
            : '音频 URL 无效或不受支持',
      },
      { status: 400 }
    )
  }

  let urlObj = inputUrlResult.url

  // 如果是 AList 播放页面，先解析真实音频 URL
  let fileName = ''
  let resolvedFileSize: number | undefined

  if (isAlistPage) {
    try {
      const result = await resolveAlistUrl(
        audioUrl,
        (fetchUrl, init) =>
          fetch(fetchUrl, { ...init, signal: combinedSignal }),
        DEFAULT_USER_AGENT
      )
      audioUrl = result.rawUrl
      fileName = result.fileName
      resolvedFileSize = result.fileSize
    } catch (error) {
      cleanup()
      const errMsg = (error as Error).message
      // 区分客户端断开和超时
      if ((error as Error).name === 'AbortError') {
        if (req.signal.aborted) {
          return NextResponse.json({ error: '请求已取消' }, { status: 499 })
        }
        return NextResponse.json({ error: '解析播放页面超时' }, { status: 504 })
      }
      return NextResponse.json(
        { error: `解析播放页面失败: ${errMsg}` },
        { status: 400 }
      )
    }
  }

  if (typeof resolvedFileSize === 'number' && resolvedFileSize > MAX_AUDIO_BYTES) {
    cleanup()
    const maxMB = Math.round(MAX_AUDIO_BYTES / (1024 * 1024))
    return NextResponse.json(
      { error: `音频文件过大，超过 ${maxMB}MB 限制` },
      { status: 413 }
    )
  }

  if (isAlistPage) {
    const resolvedUrlResult = validateAndParseAudioUrl(audioUrl)
    if (!resolvedUrlResult.ok) {
      cleanup()
      return NextResponse.json(
        {
          error:
            resolvedUrlResult.error === 'PRIVATE_HOST'
              ? '不支持访问本机或内网地址'
              : '音频 URL 无效或不受支持',
        },
        { status: 400 }
      )
    }
    urlObj = resolvedUrlResult.url
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

  let audioResponse: Response
  try {
    audioResponse = await fetch(audioUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: combinedSignal,
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        Referer: urlObj.origin,
      },
    })
  } catch (error) {
    cleanup()
    if ((error as Error).name === 'AbortError') {
      // 区分超时和客户端断开
      if (req.signal.aborted) {
        return NextResponse.json({ error: '请求已取消' }, { status: 499 })
      }
      return NextResponse.json({ error: '连接超时，请稍后重试' }, { status: 504 })
    }
    return NextResponse.json(
      { error: `无法连接音频源: ${(error as Error).message}` },
      { status: 502 }
    )
  }

  cleanup()

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

  // 监听客户端断开，中止流传输
  let bytesRead = 0
  const limitedStream = audioResponse.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        // 检查客户端是否已断开
        if (req.signal.aborted) {
          controller.error(new Error('CLIENT_DISCONNECTED'))
          return
        }
        bytesRead += chunk.byteLength
        if (bytesRead > MAX_AUDIO_BYTES) {
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
