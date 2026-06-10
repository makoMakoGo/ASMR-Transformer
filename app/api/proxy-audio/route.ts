import { NextRequest, NextResponse } from 'next/server'
import { getFetchAudioMaxBytes } from '@/lib/runtime-config'
import {
  DEFAULT_REMOTE_AUDIO_USER_AGENT,
  RemoteAudioError,
  proxyRemoteAudio,
  type RemoteAudioProxyResult,
} from '@/lib/remote-audio'

export const runtime = 'nodejs'

/**
 * POST /api/proxy-audio
 *
 * 流式代理音频文件，返回二进制流（源站提供时附带 Content-Length）
 * 前端可以显示下载进度
 */
export async function POST(req: NextRequest): Promise<Response> {
  const maxAudioBytes = await getFetchAudioMaxBytes()

  let body: Record<string, unknown> | null = null
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 })
  }

  const requestedUrl = String(body?.url || '').trim()
  if (!requestedUrl) {
    return NextResponse.json({ error: '缺少音频 URL' }, { status: 400 })
  }

  let result: RemoteAudioProxyResult
  try {
    result = await proxyRemoteAudio(
      requestedUrl,
      {
        fetchFn: (fetchUrl, init) => fetch(fetchUrl, init),
        maxAudioBytes,
        signal: req.signal,
        userAgent: DEFAULT_REMOTE_AUDIO_USER_AGENT,
      }
    )
  } catch (error) {
    if (error instanceof RemoteAudioError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    const errorMsg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: `代理音频失败: ${errorMsg}` }, { status: 500 })
  }

  return new Response(result.body, {
    status: 200,
    headers: result.headers,
  })
}
