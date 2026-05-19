import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  buildSettingsResponse,
  getSettingsEnvFilePath,
  isSettings,
  loadSettings,
  saveSettings,
} from '@/lib/settings-persistence'
import { DEFAULT_SETTINGS, type Settings } from '@/lib/app-settings'

const tempDirs: string[] = []
const originalEnv = { ...process.env }

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key]
  }
  Object.assign(process.env, originalEnv)
})

const buildSettings = (overrides: Partial<Settings> = {}): Settings => ({
  ...DEFAULT_SETTINGS,
  apiKey: 'asr-key',
  llmApiKey: 'llm-key',
  ...overrides,
})

describe('settings-persistence', () => {
  it('resolves the settings env file path from cwd and configured path', () => {
    expect(getSettingsEnvFilePath({ cwd: '/tmp/app', configuredEnvFile: '.env.local' })).toBe('/tmp/app/.env.local')
    expect(getSettingsEnvFilePath({ cwd: '/tmp/app', configuredEnvFile: '/tmp/shared/.env' })).toBe('/tmp/shared/.env')
  })

  it('validates complete settings payloads', () => {
    expect(isSettings(buildSettings())).toBe(true)
    expect(isSettings({ ...buildSettings(), apiKey: 123 })).toBe(false)
    expect(isSettings({
      ...buildSettings(),
      customInstructions: 'x'.repeat(10_001),
    })).toBe(false)
  })

  it('builds a stable response shape from env values', () => {
    expect(buildSettingsResponse({
      envFilePath: '/tmp/.env',
      exists: true,
      env: { ASR_API_KEY: 'key', ASR_MODEL: 'CustomModel' },
    })).toEqual({
      success: true,
      settings: {
        ...DEFAULT_SETTINGS,
        apiKey: 'key',
        model: 'CustomModel',
      },
      envFile: {
        path: '/tmp/.env',
        exists: true,
      },
    })
  })

  it('loads settings from an env file with defaults', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asmr-settings-load-'))
    tempDirs.push(tempDir)
    const envPath = path.join(tempDir, '.env')
    await fs.writeFile(envPath, 'ASR_API_KEY=loaded\nLLM_MODEL=LoadedModel\n')

    await expect(loadSettings(envPath)).resolves.toMatchObject({
      success: true,
      settings: {
        ...DEFAULT_SETTINGS,
        apiKey: 'loaded',
        llmModel: 'LoadedModel',
      },
      envFile: {
        path: envPath,
        exists: true,
      },
    })
  })

  it('saves normalized settings and updates process env', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asmr-settings-save-'))
    tempDirs.push(tempDir)
    const envPath = path.join(tempDir, '.env')

    const result = await saveSettings(buildSettings({
      apiKey: ' asr-key ',
      apiUrl: ' ',
      customInstructions: ' custom prompt ',
    }), envPath)

    expect(result.settings).toEqual({
      ...DEFAULT_SETTINGS,
      apiKey: 'asr-key',
      llmApiKey: 'llm-key',
      customInstructions: 'custom prompt',
    })
    expect(process.env.ASR_API_KEY).toBe('asr-key')
    expect(process.env.ASR_API_URL).toBe(DEFAULT_SETTINGS.apiUrl)
    await expect(fs.readFile(envPath, 'utf8')).resolves.toContain('CUSTOM_INSTRUCTIONS="custom prompt"')
  })
})
