import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

// GET /api/docs - 返回 API 文档（Markdown 格式）
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const format = url.searchParams.get('format') || 'markdown'

  try {
    const docPath = join(process.cwd(), 'docs', 'api.md')
    const content = readFileSync(docPath, 'utf-8')

    if (format === 'json') {
      return NextResponse.json({
        title: 'API 文档 - 语音转文字服务',
        version: '1.0.0',
        content,
        endpoints: [
          {
            method: 'POST',
            path: '/api/transcribe',
            description: '一站式音频转文字（支持润色）',
          },
          {
            method: 'GET',
            path: '/api/transcribe',
            description: '获取 API 信息',
          },
          {
            method: 'POST',
            path: '/api/polish',
            description: '文本润色（SSE 流式）',
          },
          {
            method: 'GET',
            path: '/api/docs',
            description: '获取 API 文档',
          },
        ],
      })
    }

    // 默认返回 Markdown
    return new Response(content, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
      },
    })
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `无法读取文档: ${errorMsg}` }, { status: 500 })
  }
}
