import { NextRequest, NextResponse } from 'next/server'
import path from 'node:path'
import { readEnvFile, writeEnvFile } from '@/lib/env-file'
import { settingsFromEnv, settingsToEnv, type Settings } from '@/lib/app-settings'

export const runtime = 'nodejs'

const getEnvFilePath = () => {
  // This route intentionally reads/writes a runtime-selected env file.
  // Tell Turbopack not to over-trace the whole project from this dynamic path.
  const configuredEnvFile = /* turbopackIgnore: true */ process.env.APP_SETTINGS_ENV_FILE || '.env'
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), configuredEnvFile)
}

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
    settings: settingsFromEnv(fileEnv),
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
  const updates = settingsToEnv(nextSettings)

  try {
    await writeEnvFile(envFilePath, updates)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ success: false, error: `写入 .env 失败: ${msg}` }, { status: 500 })
  }

  for (const [key, value] of Object.entries(updates)) process.env[key] = value

  return NextResponse.json({
    success: true,
    settings: settingsFromEnv(updates),
    envFile: {
      path: envFilePath,
      exists: true,
    },
  })
}
