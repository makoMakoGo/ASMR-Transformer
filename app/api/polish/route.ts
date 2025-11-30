import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { text, apiUrl, apiKey, model } = await req.json()

    if (!text || !apiUrl || !apiKey || !model) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
    }

    const response = await fetch(`${apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: '你是一个专业的文字编辑。请对用户提供的语音转文字内容进行以下处理：1. 纠正错别字和语法错误 2. 添加适当的标点符号 3. 分段排版使内容更易读 4. 保持原意不变，不要添加或删除内容。直接输出处理后的文本，不要有任何解释。',
          },
          {
            role: 'user',
            content: text,
          },
        ],
        temperature: 0.3,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json({ error: data }, { status: response.status })
    }

    return NextResponse.json(data)
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
