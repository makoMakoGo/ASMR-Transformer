import { NextRequest, NextResponse } from 'next/server'
import { getFetchAudioMaxBytes } from '@/lib/runtime-config'
import {
  buildRemoteAudioMetadata,
  DEFAULT_REMOTE_AUDIO_USER_AGENT,
  RemoteAudioError,
  resolveRemoteAudioSource,
  type RemoteAudioMetadata,
  type ResolvedRemoteAudioSource,
} from '@/lib/remote-audio'

export const runtime = 'nodejs'

const FETCH_TIMEOUT_MS = 120_000 // 2 minutes for initial connection

const getMaxAudioSizeMessage = (maxAudioBytes: number): string => {
  const maxMB = Math.round(maxAudioBytes / (1024 * 1024))
  return `音频文件过大，超过 ${maxMB}MB 限制`
}

/**
 * POST /api/proxy-audio
 *
 * 流式代理音频文件，返回二进制流（源站提供时附带 Content-Length）
 * 前端可以显示下载进度
 */
export async function POST(req: NextRequest): Promise<Response> {
  const maxAudioBytes = getFetchAudioMaxBytes()
  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => timeoutController.abort(), FETCH_TIMEOUT_MS)
  const combinedSignal = AbortSignal.any([req.signal, timeoutController.signal])

  // This timer outlives async branches unless every return path clears it.
  const cleanup = () => clearTimeout(timeoutId)

  let body: Record<string, unknown> | null = null
  try {
    body = await req.json()
  } catch {
    cleanup()
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 })
  }

  const requestedUrl = String(body?.url || '').trim()
  if (!requestedUrl) {
    cleanup()
    return NextResponse.json({ error: '缺少音频 URL' }, { status: 400 })
  }

  let source: ResolvedRemoteAudioSource
  try {
    source = await resolveRemoteAudioSource(
      requestedUrl,
      (fetchUrl, init) => fetch(fetchUrl, { ...init, signal: combinedSignal }),
      DEFAULT_REMOTE_AUDIO_USER_AGENT
    )
  } catch (error) {
    cleanup()
    if (error instanceof Error && error.name === 'AbortError') {
      if (req.signal.aborted) {
        return NextResponse.json({ error: '请求已取消' }, { status: 499 })
      }
      return NextResponse.json({ error: '解析播放页面超时' }, { status: 504 })
    }
    if (error instanceof RemoteAudioError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    const errorMsg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: `解析播放页面失败: ${errorMsg}` }, { status: 400 })
  }

  if (typeof source.fileSizeHint === 'number' && source.fileSizeHint > maxAudioBytes) {
    cleanup()
    return NextResponse.json({ error: getMaxAudioSizeMessage(maxAudioBytes) }, { status: 413 })
  }

  let audioResponse: Response
  try {
    audioResponse = await fetch(source.resolvedUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: combinedSignal,
      headers: {
        'User-Agent': DEFAULT_REMOTE_AUDIO_USER_AGENT,
        Referer: source.resolvedUrlObject.origin,
      },
    })
  } catch (error) {
    cleanup()
    if (error instanceof Error && error.name === 'AbortError') {
      if (req.signal.aborted) {
        return NextResponse.json({ error: '请求已取消' }, { status: 499 })
      }
      return NextResponse.json({ error: '连接超时，请稍后重试' }, { status: 504 })
    }
    const errorMsg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: `无法连接音频源: ${errorMsg}` }, { status: 502 })
  }

  cleanup()

  if (!audioResponse.ok) {
    return NextResponse.json(
      { error: `音频源返回错误 (${audioResponse.status})` },
      { status: audioResponse.status >= 500 ? 502 : 400 }
    )
  }

  let metadata: RemoteAudioMetadata
  try {
    metadata = buildRemoteAudioMetadata({
      source,
      contentType: audioResponse.headers.get('content-type'),
      contentDisposition: audioResponse.headers.get('content-disposition'),
      contentLength: audioResponse.headers.get('content-length'),
      fallbackName: 'audio',
    })
  } catch (error) {
    if (error instanceof RemoteAudioError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    const errorMsg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: `校验音频失败: ${errorMsg}` }, { status: 500 })
  }

  if (metadata.fileSize > maxAudioBytes) {
    return NextResponse.json({ error: getMaxAudioSizeMessage(maxAudioBytes) }, { status: 413 })
  }

  if (!audioResponse.body) {
    return NextResponse.json({ error: '无法读取音频数据流' }, { status: 500 })
  }

  const headers = new Headers({
    'Content-Type': metadata.contentType,
    'X-File-Name': encodeURIComponent(metadata.fileName),
    'Cache-Control': 'no-cache',
  })

  if (metadata.contentLength) {
    headers.set('Content-Length', metadata.contentLength)
  }

  let bytesRead = 0
  const limitedStream = audioResponse.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        if (req.signal.aborted) {
          controller.error(new Error('CLIENT_DISCONNECTED'))
          return
        }
        bytesRead += chunk.byteLength
        if (bytesRead > maxAudioBytes) {
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
