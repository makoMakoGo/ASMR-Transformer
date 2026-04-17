import { NextRequest, NextResponse } from 'next/server'
import {
  buildRemoteAudioMetadata,
  DEFAULT_REMOTE_AUDIO_USER_AGENT,
  RemoteAudioError,
  resolveRemoteAudioSource,
} from '@/lib/remote-audio'

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ success: false, error: '请求体必须为 JSON' }, { status: 400 })
  }

  const url = String(body?.url || '').trim()
  if (!url) {
    return NextResponse.json({ success: false, error: '缺少 URL 参数' }, { status: 400 })
  }

  try {
    const source = await resolveRemoteAudioSource(
      url,
      (fetchUrl, init) => fetch(fetchUrl, init),
      DEFAULT_REMOTE_AUDIO_USER_AGENT
    )
    const response = await fetch(source.resolvedUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent': DEFAULT_REMOTE_AUDIO_USER_AGENT,
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `HTTP ${response.status}: ${response.statusText}` },
        { status: 400 }
      )
    }

    const metadata = buildRemoteAudioMetadata({
      source,
      contentLength: response.headers.get('content-length'),
      contentType: response.headers.get('content-type'),
      contentDisposition: response.headers.get('content-disposition'),
    })

    return NextResponse.json({
      success: true,
      name: metadata.fileName,
      size: metadata.fileSize,
      type: metadata.contentType,
      resolvedUrl: source.isAlistPage ? source.resolvedUrl : undefined,
    })
  } catch (e) {
    if (e instanceof RemoteAudioError) {
      return NextResponse.json({ success: false, error: e.message }, { status: e.status })
    }

    const errorMsg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ success: false, error: `检查失败: ${errorMsg}` }, { status: 500 })
  }
}
