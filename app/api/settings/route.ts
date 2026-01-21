import { NextRequest, NextResponse } from 'next/server'
import path from 'node:path'
import { EnvMap, readEnvFile, writeEnvFile } from '@/lib/env-file'

export const runtime = 'nodejs'

const DEFAULT_ASR_API_URL = 'https://api.siliconflow.cn/v1/audio/transcriptions'
const DEFAULT_ASR_MODEL = 'TeleAI/TeleSpeechASR'
const DEFAULT_LLM_API_URL = 'https://juya.owl.ci/v1'
const DEFAULT_LLM_MODEL = 'DeepSeek-V3.1-Terminus'
const DEFAULT_INSTRUCTIONS =
  '请对以下语音转文字内容进行处理：1. 纠正错别字和语法错误 2. 添加适当的标点符号 3. 分段排版使内容更易读 4. 保持原意不变，不要添加或删除内容'

type Settings = {
  apiKey: string
  apiUrl: string
  model: string
  llmApiUrl: string
  llmModel: string
  llmApiKey: string
  customInstructions: string
}

const getEnvFilePath = () => path.resolve(process.cwd(), process.env.APP_SETTINGS_ENV_FILE || '.env')

const toSettings = (env: EnvMap): Settings => ({
  apiKey: env.ASR_API_KEY ?? '',
  apiUrl: env.ASR_API_URL ?? DEFAULT_ASR_API_URL,
  model: env.ASR_MODEL ?? DEFAULT_ASR_MODEL,
  llmApiUrl: env.LLM_API_URL ?? DEFAULT_LLM_API_URL,
  llmModel: env.LLM_MODEL ?? DEFAULT_LLM_MODEL,
  llmApiKey: env.LLM_API_KEY ?? '',
  customInstructions: env.CUSTOM_INSTRUCTIONS ?? DEFAULT_INSTRUCTIONS,
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const readString = (value: unknown): string | null => (typeof value === 'string' ? value : null)

const parseSettingsBody = async (req: NextRequest): Promise<Settings | null> => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return null
  }
  if (!isRecord(body)) return null

  const apiKey = readString(body.apiKey)
  const apiUrl = readString(body.apiUrl)
  const model = readString(body.model)
  const llmApiUrl = readString(body.llmApiUrl)
  const llmModel = readString(body.llmModel)
  const llmApiKey = readString(body.llmApiKey)
  const customInstructions = readString(body.customInstructions)

  if (
    apiKey === null ||
    apiUrl === null ||
    model === null ||
    llmApiUrl === null ||
    llmModel === null ||
    llmApiKey === null ||
    customInstructions === null
  ) {
    return null
  }

  if (customInstructions.length > 10_000) return null

  return { apiKey, apiUrl, model, llmApiUrl, llmModel, llmApiKey, customInstructions }
}

export async function GET(): Promise<NextResponse> {
  const envFilePath = getEnvFilePath()
  const { exists, env: fileEnv } = await readEnvFile(envFilePath)

  return NextResponse.json({
    success: true,
    settings: toSettings(fileEnv),
    envFile: {
      path: envFilePath,
      exists,
    },
  })
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const nextSettings = await parseSettingsBody(req)
  if (!nextSettings) {
    return NextResponse.json({ success: false, error: '无效的设置内容' }, { status: 400 })
  }

  const envFilePath = getEnvFilePath()
  const updates: EnvMap = {
    ASR_API_KEY: nextSettings.apiKey.trim(),
    ASR_API_URL: nextSettings.apiUrl.trim() || DEFAULT_ASR_API_URL,
    ASR_MODEL: nextSettings.model.trim() || DEFAULT_ASR_MODEL,
    LLM_API_KEY: nextSettings.llmApiKey.trim(),
    LLM_API_URL: nextSettings.llmApiUrl.trim() || DEFAULT_LLM_API_URL,
    LLM_MODEL: nextSettings.llmModel.trim() || DEFAULT_LLM_MODEL,
    CUSTOM_INSTRUCTIONS: nextSettings.customInstructions.trim() || DEFAULT_INSTRUCTIONS,
  }

  try {
    await writeEnvFile(envFilePath, updates)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ success: false, error: `写入 .env 失败: ${msg}` }, { status: 500 })
  }

  for (const [key, value] of Object.entries(updates)) process.env[key] = value

  return NextResponse.json({
    success: true,
    settings: toSettings(updates),
    envFile: {
      path: envFilePath,
      exists: true,
    },
  })
}
