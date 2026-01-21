import { NextRequest } from 'next/server'

// 固定的系统提示词，确保模型行为一致
const FIXED_SYSTEM_PROMPT =
  '你是一个专业的文字编辑助手。你的任务是对语音转文字的内容进行润色处理。请直接输出处理后的文本，不要有任何解释、前言或后语。'

// 默认的处理指令
const DEFAULT_INSTRUCTIONS =
  '请对以下语音转文字内容进行处理：1. 纠正错别字和语法错误 2. 添加适当的标点符号 3. 分段排版使内容更易读 4. 保持原意不变，不要添加或删除内容'

export async function POST(req: NextRequest) {
  try {
    const { text, apiUrl, apiKey, model, customInstructions } = await req.json()

    if (!text || !apiUrl || !model) {
      return new Response(JSON.stringify({ error: '缺少必要参数' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const instructions = customInstructions?.trim() || DEFAULT_INSTRUCTIONS
    const userMessage = `${instructions}\n\n---\n\n${text}`
    const fullUrl = `${apiUrl}/chat/completions`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    const trimmedApiKey = typeof apiKey === 'string' ? apiKey.trim() : ''
    if (trimmedApiKey) headers.Authorization = `Bearer ${trimmedApiKey}`

    const response = await fetch(fullUrl, {
      method: 'POST',
      headers,
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
    const errorMsg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
