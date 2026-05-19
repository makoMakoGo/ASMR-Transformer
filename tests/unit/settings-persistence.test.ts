import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
  vi.restoreAllMocks()
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
    expect(isSettings(null)).toBe(false)
    expect(isSettings(undefined)).toBe(false)
    expect(isSettings([])).toBe(false)
    expect(isSettings('string')).toBe(false)
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

  it('loads defaults when the env file does not exist', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asmr-settings-missing-'))
    tempDirs.push(tempDir)
    const envPath = path.join(tempDir, '.env')

    await expect(loadSettings(envPath)).resolves.toEqual({
      success: true,
      settings: DEFAULT_SETTINGS,
      envFile: {
        path: envPath,
        exists: false,
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

  it('returns the settings parsed from the written env file', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asmr-settings-written-env-'))
    tempDirs.push(tempDir)
    const envPath = path.join(tempDir, '.env')

    const result = await saveSettings(buildSettings({
      apiKey: 'asr key with spaces',
      customInstructions: 'line one\nline two',
    }), envPath)

    expect(result.settings).toEqual({
      ...DEFAULT_SETTINGS,
      apiKey: 'asr key with spaces',
      llmApiKey: 'llm-key',
      customInstructions: 'line one\nline two',
    })
    expect(process.env.ASR_API_KEY).toBe('asr key with spaces')
    expect(process.env.CUSTOM_INSTRUCTIONS).toBe('line one\nline two')
  })

  it('preserves unrelated env lines when saving settings', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asmr-settings-preserve-'))
    tempDirs.push(tempDir)
    const envPath = path.join(tempDir, '.env')
    await fs.writeFile(envPath, '# header\nMY_OTHER_VAR=keep\nASR_API_KEY=old\n')

    await saveSettings(buildSettings({ apiKey: 'new-key' }), envPath)

    const content = await fs.readFile(envPath, 'utf8')
    expect(content).toContain('# header')
    expect(content).toContain('MY_OTHER_VAR=keep')
    expect(content).toContain('ASR_API_KEY=new-key')
  })

  it('loads the same settings after saving them', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asmr-settings-roundtrip-'))
    tempDirs.push(tempDir)
    const envPath = path.join(tempDir, '.env')
    const settings = buildSettings({
      apiKey: 'roundtrip-asr',
      apiUrl: 'https://asr.example/v1',
      model: 'roundtrip-model',
      llmApiKey: 'roundtrip-llm',
      llmApiUrl: 'https://llm.example/v1',
      llmModel: 'roundtrip-llm-model',
      customInstructions: 'roundtrip prompt',
    })

    const saved = await saveSettings(settings, envPath)
    const loaded = await loadSettings(envPath)

    expect(loaded.settings).toEqual(saved.settings)
  })

  it('serializes load and save operations', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asmr-settings-queue-'))
    tempDirs.push(tempDir)
    const envPath = path.join(tempDir, '.env')
    const readSpy = vi.spyOn(fs, 'readFile')
    let releaseRead: (() => void) | null = null
    readSpy.mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => {
        releaseRead = resolve
      })
      return 'ASR_API_KEY=queued\n'
    })

    const loadPromise = loadSettings(envPath)
    const savePromise = saveSettings(buildSettings({ apiKey: 'saved-after-load' }), envPath)
    await Promise.resolve()
    await Promise.resolve()

    await expect(fs.access(envPath)).rejects.toMatchObject({ code: 'ENOENT' })
    releaseRead?.()

    await expect(loadPromise).resolves.toMatchObject({
      settings: {
        ...DEFAULT_SETTINGS,
        apiKey: 'queued',
      },
    })
    await expect(savePromise).resolves.toMatchObject({
      settings: {
        ...DEFAULT_SETTINGS,
        apiKey: 'saved-after-load',
        llmApiKey: 'llm-key',
      },
    })
  })
})
