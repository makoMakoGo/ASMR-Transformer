import { NextRequest } from 'next/server'
import {
  buildChatCompletionsUrl,
  DEFAULT_POLISH_INSTRUCTIONS,
  FIXED_SYSTEM_PROMPT,
} from '@/lib/polish-config'

export async function POST(req: NextRequest) {
  try {
    const { text, apiUrl, apiKey, model, customInstructions } = await req.json()

    if (!text || !apiUrl || !model) {
      return new Response(JSON.stringify({ error: '缺少必要参数' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const instructions = customInstructions?.trim() || DEFAULT_POLISH_INSTRUCTIONS
    const userMessage = `${instructions}\n\n---\n\n${text}`
    const fullUrl = buildChatCompletionsUrl(apiUrl)

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    const trimmedApiKey = typeof apiKey === 'string' ? apiKey.trim() : ''
    if (trimmedApiKey) headers.Authorization = `Bearer ${trimmedApiKey}`

    // 使用 req.signal：客户端断开（刷新/关闭页面）时自动中止外部请求
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers,
      signal: req.signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: FIXED_SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3,
        stream: true,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMsg = `API 错误 (${response.status})`
      try {
        const errorJson = JSON.parse(errorText)
        errorMsg = errorJson?.error?.message || errorJson?.error || errorMsg
      } catch {
        if (errorText.startsWith('<')) {
          errorMsg = 'API 返回了错误页面，服务可能不可用'
        }
      }
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 返回 SSE 流
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError' && req.signal.aborted) {
      return new Response(JSON.stringify({ error: '请求已取消' }), {
        status: 499,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const errorMsg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
