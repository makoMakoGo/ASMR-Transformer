import { NextRequest, NextResponse } from 'next/server'

// 默认配置
const DEFAULT_ASR_API_URL = 'https://api.siliconflow.cn/v1/audio/transcriptions'
const DEFAULT_ASR_MODEL = 'TeleAI/TeleSpeechASR'
const DEFAULT_LLM_API_URL = 'https://juya.owl.ci/v1'
const DEFAULT_LLM_MODEL = 'DeepSeek-V3.1-Terminus'
const DEFAULT_LLM_API_KEY = 'sk-kUm2RSHxuRJyjdrzdwprHYFYwvE4NTkIzRoyyaiDoh7YyDIZ'
const DEFAULT_INSTRUCTIONS =
  '请对以下语音转文字内容进行处理：1. 纠正错别字和语法错误 2. 添加适当的标点符号 3. 分段排版使内容更易读 4. 保持原意不变，不要添加或删除内容'

const FIXED_SYSTEM_PROMPT =
  '你是一个专业的文字编辑助手。你的任务是对语音转文字的内容进行润色处理。请直接输出处理后的文本，不要有任何解释、前言或后语。'

type TranscribeResponse = {
  success: boolean
  transcription?: string
  polished?: string
  error?: string
  metadata?: {
    processingTime: number
    fileName: string
    fileSize: number
  }
}

async function polishText(
  text: string,
  apiUrl: string,
  apiKey: string,
  model: string,
  customInstructions: string
): Promise<string> {
  const instructions = customInstructions?.trim() || DEFAULT_INSTRUCTIONS
  const userMessage = `${instructions}\n\n---\n\n${text}`
  const fullUrl = `${apiUrl}/chat/completions`

  const response = await fetch(fullUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: FIXED_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
      stream: false, // 非流式，等待完整响应
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`LLM API 错误 (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}


export async function POST(req: NextRequest): Promise<NextResponse<TranscribeResponse>> {
  const startTime = Date.now()

  try {
    const formData = await req.formData()

    // 获取文件
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ success: false, error: '缺少音频文件' }, { status: 400 })
    }

    // 获取 ASR 配置（优先使用请求参数，其次使用环境变量）
    const asrApiKey = (formData.get('asrApiKey') as string) || process.env.ASR_API_KEY
    if (!asrApiKey) {
      return NextResponse.json(
        { success: false, error: '缺少 ASR API Key（请在请求中提供或在服务器 .env 中配置 ASR_API_KEY）' },
        { status: 400 }
      )
    }

    const asrApiUrl = (formData.get('asrApiUrl') as string) || process.env.ASR_API_URL || DEFAULT_ASR_API_URL
    const asrModel = (formData.get('asrModel') as string) || process.env.ASR_MODEL || DEFAULT_ASR_MODEL

    // 获取润色配置（优先使用请求参数，其次使用环境变量，最后使用默认值）
    const shouldPolish = formData.get('polish') === 'true'
    const llmApiKey = (formData.get('llmApiKey') as string) || process.env.LLM_API_KEY || DEFAULT_LLM_API_KEY
    const llmApiUrl = (formData.get('llmApiUrl') as string) || process.env.LLM_API_URL || DEFAULT_LLM_API_URL
    const llmModel = (formData.get('llmModel') as string) || process.env.LLM_MODEL || DEFAULT_LLM_MODEL
    const customInstructions = (formData.get('customInstructions') as string) || DEFAULT_INSTRUCTIONS

    // Step 1: 调用 ASR API 进行语音识别
    const asrFormData = new FormData()
    asrFormData.append('file', file)
    asrFormData.append('model', asrModel)

    const asrResponse = await fetch(asrApiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${asrApiKey}`,
      },
      body: asrFormData,
    })

    if (!asrResponse.ok) {
      const errorText = await asrResponse.text()
      return NextResponse.json(
        { success: false, error: `ASR API 错误 (${asrResponse.status}): ${errorText}` },
        { status: asrResponse.status }
      )
    }

    const asrData = await asrResponse.json()
    const transcription = asrData.text || ''

    if (!transcription) {
      return NextResponse.json(
        { success: false, error: '语音识别未返回文本' },
        { status: 500 }
      )
    }

    // Step 2: 可选的文本润色
    let polished: string | undefined
    if (shouldPolish && transcription) {
      try {
        polished = await polishText(transcription, llmApiUrl, llmApiKey, llmModel, customInstructions)
      } catch (e) {
        // 润色失败不影响返回转录结果
        console.error('Polish error:', e)
      }
    }

    const processingTime = Date.now() - startTime

    return NextResponse.json({
      success: true,
      transcription,
      polished: polished || undefined,
      metadata: {
        processingTime,
        fileName: file.name,
        fileSize: file.size,
      },
    })
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 })
  }
}

// GET 方法返回 API 信息
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    name: 'Transcribe API',
    version: '1.0.0',
    description: '音频转文字一站式 API，支持 ASR 语音识别和 LLM 文本润色',
    endpoints: {
      'POST /api/transcribe': '上传音频文件进行转录和润色',
      'POST /api/polish': '对文本进行润色处理',
    },
    documentation: '/docs',
  })
}
