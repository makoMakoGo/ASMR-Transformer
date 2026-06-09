import { NextRequest, NextResponse } from 'next/server'
import {
  checkRemoteAudio,
  DEFAULT_REMOTE_AUDIO_USER_AGENT,
  RemoteAudioError,
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
    const { metadata } = await checkRemoteAudio(
      url,
      {
        fetchFn: (fetchUrl, init) => fetch(fetchUrl, init),
        signal: request.signal,
        userAgent: DEFAULT_REMOTE_AUDIO_USER_AGENT,
      }
    )

    return NextResponse.json({
      success: true,
      name: metadata.fileName,
      size: metadata.fileSize,
      type: metadata.contentType,
    })
  } catch (e) {
    if (e instanceof RemoteAudioError) {
      return NextResponse.json({ success: false, error: e.message }, { status: e.status })
    }

    const errorMsg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ success: false, error: `检查失败: ${errorMsg}` }, { status: 500 })
  }
}
