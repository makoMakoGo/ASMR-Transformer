import { NextRequest, NextResponse } from 'next/server'
import { isAlistPageUrl, resolveAlistUrl } from '@/lib/alist-utils'
import { validateAndParseAudioUrl } from '@/lib/url-utils'

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ success: false, error: '请求体必须为 JSON' }, { status: 400 })
  }

  try {
    const url = String(body?.url || '').trim()

    if (!url) {
      return NextResponse.json({ success: false, error: '缺少 URL 参数' }, { status: 400 })
    }

    const isAlistPage = isAlistPageUrl(url)
    const inputUrlResult = validateAndParseAudioUrl(url, { requireAudioExtension: !isAlistPage })
    if (!inputUrlResult.ok) {
      const errorMessage =
        inputUrlResult.error === 'INVALID_URL'
          ? '无效的 URL'
          : inputUrlResult.error === 'UNSUPPORTED_PROTOCOL'
            ? '仅支持 http/https 链接'
            : inputUrlResult.error === 'PRIVATE_HOST'
              ? '不支持访问本机或内网地址'
              : '音频 URL 无效或不受支持'
      return NextResponse.json({ success: false, error: errorMessage }, { status: 400 })
    }

    // 如果是 AList 播放页面，先解析真实音频 URL
    let actualUrl = url
    let actualUrlObj: URL = inputUrlResult.url
    let resolvedFileName: string | undefined
    let resolvedFileSize: number | undefined
    let resolvedContentType: string | undefined

    if (isAlistPage) {
      try {
        const resolved = await resolveAlistUrl(url, (fetchUrl, init) => fetch(fetchUrl, init))
        actualUrl = resolved.rawUrl
        resolvedFileName = resolved.fileName
        resolvedFileSize = resolved.fileSize
        resolvedContentType = resolved.contentType
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e)
        return NextResponse.json(
          { success: false, error: `解析播放页面失败: ${errorMsg}` },
          { status: 400 }
        )
      }

      const resolvedUrlResult = validateAndParseAudioUrl(actualUrl)
      if (!resolvedUrlResult.ok) {
        return NextResponse.json(
          {
            success: false,
            error:
              resolvedUrlResult.error === 'PRIVATE_HOST'
                ? '不支持访问本机或内网地址'
                : '音频 URL 无效或不受支持',
          },
          { status: 400 }
        )
      }
      actualUrlObj = resolvedUrlResult.url
    }

    // Setup fetch options for HEAD request
    const fetchOptions: RequestInit = {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    }

    // Make HEAD request to actual URL
    const response = await fetch(actualUrl, fetchOptions)

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `HTTP ${response.status}: ${response.statusText}` },
        { status: 400 }
      )
    }

    // Extract metadata
    const contentLength = response.headers.get('content-length')
    const contentType = response.headers.get('content-type') || resolvedContentType || 'audio/unknown'
    const contentDisposition = response.headers.get('content-disposition')

    // Extract filename from content-disposition or URL
    let fileName = resolvedFileName || ''
    if (!fileName && contentDisposition) {
      const match = contentDisposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)["']?/i)
      if (match) {
        fileName = decodeURIComponent(match[1])
      }
    }
    if (!fileName) {
      const pathParts = actualUrlObj.pathname.split('/')
      fileName = pathParts[pathParts.length - 1] || '在线音频'
      try {
        fileName = decodeURIComponent(fileName)
      } catch {
        // keep original
      }
    }

    // Determine file size (prefer resolved, then HEAD response)
    const resolvedSize =
      typeof resolvedFileSize === 'number' && resolvedFileSize > 0 ? resolvedFileSize : undefined
    const parsedLength = contentLength ? Number(contentLength) : NaN
    const fileSize = resolvedSize ?? (Number.isFinite(parsedLength) ? Math.trunc(parsedLength) : 0)

    // Validate content type (should be audio)
    const isAudio =
      contentType.startsWith('audio/') ||
      contentType.includes('octet-stream') ||
      /\.(mp3|wav|m4a|flac|ogg|aac|wma)$/i.test(fileName)

    if (!isAudio) {
      return NextResponse.json(
        { success: false, error: `不是音频文件 (${contentType})` },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      name: fileName || '在线音频',
      size: fileSize,
      type: contentType,
      // 如果进行了 AList 解析，返回真实 URL
      resolvedUrl: actualUrl !== url ? actualUrl : undefined,
    })
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ success: false, error: `检查失败: ${errorMsg}` }, { status: 500 })
  }
}
