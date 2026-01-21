import { NextRequest, NextResponse } from 'next/server'
import { HttpsProxyAgent } from 'https-proxy-agent'

export async function POST(request: NextRequest) {
  try {
    const { url, proxyUrl } = await request.json()

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

    // Setup fetch options
    const fetchOptions: RequestInit & { agent?: unknown } = {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    }

    if (proxyUrl) {
      fetchOptions.agent = new HttpsProxyAgent(proxyUrl)
    }

    // Make HEAD request
    const response = await fetch(url, fetchOptions)

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `HTTP ${response.status}: ${response.statusText}` },
        { status: 400 }
      )
    }

    // Extract metadata
    const contentLength = response.headers.get('content-length')
    const contentType = response.headers.get('content-type') || 'audio/unknown'
    const contentDisposition = response.headers.get('content-disposition')

    // Extract filename from content-disposition or URL
    let fileName = ''
    if (contentDisposition) {
      const match = contentDisposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)["']?/i)
      if (match) {
        fileName = decodeURIComponent(match[1])
      }
    }
    if (!fileName) {
      // Extract from URL path
      const pathParts = parsedUrl.pathname.split('/')
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
      size: contentLength ? parseInt(contentLength, 10) : 0,
      type: contentType,
    })
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ success: false, error: `检查失败: ${errorMsg}` }, { status: 500 })
  }
}
