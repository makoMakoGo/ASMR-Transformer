import path from 'node:path'
import { readEnvFile, writeEnvFile, type EnvMap } from '@/lib/env-file'
import { settingsFromEnv, settingsToEnv, type Settings } from '@/lib/app-settings'

export type SettingsEnvFile = {
  path: string
  exists: boolean
}

export type SettingsPersistenceResult = {
  success: true
  settings: Settings
  envFile: SettingsEnvFile
}

let settingsPersistenceQueue: Promise<void> = Promise.resolve()

const serializeSettingsOperation = async <T>(operation: () => Promise<T>): Promise<T> => {
  const previousOperation = settingsPersistenceQueue
  let releaseCurrentOperation!: () => void
  settingsPersistenceQueue = new Promise<void>((resolve) => {
    releaseCurrentOperation = resolve
  })

  await previousOperation
  try {
    return await operation()
  } finally {
    releaseCurrentOperation()
  }
}

export const getSettingsEnvFilePath = ({
  configuredEnvFile = /* turbopackIgnore: true */ process.env.APP_SETTINGS_ENV_FILE || '.env',
  cwd = /* turbopackIgnore: true */ process.cwd(),
}: {
  configuredEnvFile?: string
  cwd?: string
} = {}): string => {
  return path.resolve(cwd, configuredEnvFile)
}

export const isSettings = (value: unknown): value is Settings => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  const record = value as Record<keyof Settings, unknown>
  return (
    typeof record.apiKey === 'string' &&
    typeof record.apiUrl === 'string' &&
    typeof record.model === 'string' &&
    typeof record.llmApiUrl === 'string' &&
    typeof record.llmModel === 'string' &&
    typeof record.llmApiKey === 'string' &&
    typeof record.customInstructions === 'string' &&
    record.customInstructions.length <= 10_000
  )
}

export const buildSettingsResponse = ({
  envFilePath,
  exists,
  env,
}: {
  envFilePath: string
  exists: boolean
  env: Partial<EnvMap>
}): SettingsPersistenceResult => ({
  success: true,
  settings: settingsFromEnv(env),
  envFile: {
    path: envFilePath,
    exists,
  },
})

export const loadSettings = async (envFilePath = getSettingsEnvFilePath()): Promise<SettingsPersistenceResult> => {
  return serializeSettingsOperation(async () => {
    const { exists, env } = await readEnvFile(envFilePath)
    return buildSettingsResponse({ envFilePath, exists, env })
  })
}

export const saveSettings = async (
  settings: Settings,
  envFilePath = getSettingsEnvFilePath()
): Promise<SettingsPersistenceResult> => {
  return serializeSettingsOperation(async () => {
    const updates = settingsToEnv(settings)
    const { env: writtenEnv } = await writeEnvFile(envFilePath, updates)
    for (const [key, value] of Object.entries(writtenEnv)) process.env[key] = value

    return buildSettingsResponse({
      envFilePath,
      exists: true,
      env: writtenEnv,
    })
  })
}
