import { NextRequest, NextResponse } from 'next/server'
import { isAlistPageUrl, resolveAlistUrl } from '@/lib/alist-utils'
import { isAllowedAudioHost, isPrivateHost, isValidAudioUrl } from '@/lib/url-utils'

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const url = String(body?.url || '').trim()

    if (!url) {
      return NextResponse.json({ success: false, error: '缺少 URL 参数' }, { status: 400 })
    }

    // Validate URL
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return NextResponse.json({ success: false, error: '仅支持 http/https 链接' }, { status: 400 })
      }
    } catch {
      return NextResponse.json({ success: false, error: '无效的 URL' }, { status: 400 })
    }

    if (isPrivateHost(parsedUrl.hostname)) {
      return NextResponse.json({ success: false, error: '不支持访问本机或内网地址' }, { status: 400 })
    }

    if (!isAllowedAudioHost(parsedUrl.hostname)) {
      return NextResponse.json({ success: false, error: '音频 URL 无效或不受支持' }, { status: 400 })
    }

    // 如果是 AList 播放页面，先解析真实音频 URL
    let actualUrl = url
    let resolvedFileName: string | undefined
    let resolvedFileSize: number | undefined
    let resolvedContentType: string | undefined

    const isAlistPage = isAlistPageUrl(url)

    if (!isAlistPage && !isValidAudioUrl(url)) {
      return NextResponse.json({ success: false, error: '音频 URL 无效或不受支持' }, { status: 400 })
    }

    if (isAlistPage) {
      try {
        const resolved = await resolveAlistUrl(url, (fetchUrl, init) => fetch(fetchUrl, init))
        actualUrl = resolved.rawUrl
        resolvedFileName = resolved.fileName
        resolvedFileSize = resolved.fileSize
        resolvedContentType = resolved.contentType
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e)
        return NextResponse.json({ success: false, error: `解析播放页面失败: ${errorMsg}` }, { status: 400 })
      }
    }

    // Setup fetch options for HEAD request
    const fetchOptions: RequestInit = {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    }

    const actualUrlObj = new URL(actualUrl)
    if (isPrivateHost(actualUrlObj.hostname)) {
      return NextResponse.json({ success: false, error: '不支持访问本机或内网地址' }, { status: 400 })
    }

    if (!isValidAudioUrl(actualUrl)) {
      return NextResponse.json({ success: false, error: '音频 URL 无效或不受支持' }, { status: 400 })
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
      // Extract from URL path
      const urlForParsing = new URL(actualUrl)
      const pathParts = urlForParsing.pathname.split('/')
      fileName = pathParts[pathParts.length - 1] || '在线音频'
      // Remove query string if present
      fileName = fileName.split('?')[0]
      // Decode URL encoding
      try {
        fileName = decodeURIComponent(fileName)
      } catch {
        // Keep as is if decoding fails
      }
    }

    // Determine file size (prefer resolved, then HEAD response)
    const resolvedSize =
      typeof resolvedFileSize === 'number' && resolvedFileSize > 0 ? resolvedFileSize : undefined
    const parsedLength = contentLength ? Number(contentLength) : NaN
    const fileSize = resolvedSize ?? (Number.isFinite(parsedLength) ? Math.trunc(parsedLength) : 0)

    // Validate content type (should be audio)
    const isAudio = contentType.startsWith('audio/') ||
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
