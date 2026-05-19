import { NextRequest, NextResponse } from 'next/server'
import {
  getSettingsEnvFilePath,
  isSettings,
  loadSettings,
  saveSettings,
} from '@/lib/settings-persistence'

export const runtime = 'nodejs'

const getEnvFilePath = () => {
  // This route intentionally reads/writes a runtime-selected env file.
  // Tell Turbopack not to over-trace the whole project from this dynamic path.
  const configuredEnvFile = /* turbopackIgnore: true */ process.env.APP_SETTINGS_ENV_FILE || '.env'
  return getSettingsEnvFilePath({
    configuredEnvFile,
    cwd: /* turbopackIgnore: true */ process.cwd(),
  })
}

const parseSettingsBody = async (req: NextRequest) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return null
  }
  return isSettings(body) ? body : null
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(await loadSettings(getEnvFilePath()))
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const nextSettings = await parseSettingsBody(req)
  if (!nextSettings) {
    return NextResponse.json({ success: false, error: '无效的设置内容' }, { status: 400 })
  }

  const envFilePath = getEnvFilePath()

  try {
    return NextResponse.json(await saveSettings(nextSettings, envFilePath))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ success: false, error: `写入 .env 失败: ${msg}` }, { status: 500 })
  }
}
