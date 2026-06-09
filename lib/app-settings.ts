import type { EnvMap } from '@/lib/env-file'
import { DEFAULT_POLISH_INSTRUCTIONS } from '@/lib/polish-config'

export type Settings = {
  apiKey: string
  apiUrl: string
  model: string
  llmApiUrl: string
  llmModel: string
  llmApiKey: string
  customInstructions: string
}

export type AsrRunSettings = Pick<Settings, 'apiKey' | 'apiUrl' | 'model'>
export type LlmRunSettings = Pick<Settings, 'llmApiUrl' | 'llmModel' | 'llmApiKey' | 'customInstructions'>

export const DEFAULT_ASR_API_URL = 'https://api.siliconflow.cn/v1/audio/transcriptions'
export const DEFAULT_ASR_MODEL = 'TeleAI/TeleSpeechASR'
export const DEFAULT_LLM_API_URL = 'https://juya.owl.ci/v1'
export const DEFAULT_LLM_MODEL = 'DeepSeek-V3.1-Terminus'

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  apiUrl: DEFAULT_ASR_API_URL,
  model: DEFAULT_ASR_MODEL,
  llmApiUrl: DEFAULT_LLM_API_URL,
  llmModel: DEFAULT_LLM_MODEL,
  llmApiKey: '',
  customInstructions: DEFAULT_POLISH_INSTRUCTIONS,
}

const readSecret = (value: string | undefined): string => value ?? ''

const readConfiguredValue = (value: string | undefined, fallback: string): string => {
  const trimmed = value?.trim() ?? ''
  return trimmed || fallback
}

export const applySettingsDefaults = (input: Partial<Settings>): Settings => ({
  apiKey: readSecret(input.apiKey),
  apiUrl: readConfiguredValue(input.apiUrl, DEFAULT_SETTINGS.apiUrl),
  model: readConfiguredValue(input.model, DEFAULT_SETTINGS.model),
  llmApiUrl: readConfiguredValue(input.llmApiUrl, DEFAULT_SETTINGS.llmApiUrl),
  llmModel: readConfiguredValue(input.llmModel, DEFAULT_SETTINGS.llmModel),
  llmApiKey: readSecret(input.llmApiKey),
  customInstructions: readConfiguredValue(input.customInstructions, DEFAULT_SETTINGS.customInstructions),
})

export const normalizeAsrRunSettings = (input: AsrRunSettings): AsrRunSettings => ({
  apiKey: input.apiKey.trim(),
  apiUrl: input.apiUrl.trim() || DEFAULT_SETTINGS.apiUrl,
  model: input.model.trim() || DEFAULT_SETTINGS.model,
})

export const normalizeLlmRunSettings = (input: LlmRunSettings): LlmRunSettings => ({
  llmApiUrl: input.llmApiUrl.trim() || DEFAULT_SETTINGS.llmApiUrl,
  llmModel: input.llmModel.trim() || DEFAULT_SETTINGS.llmModel,
  llmApiKey: input.llmApiKey.trim(),
  customInstructions: input.customInstructions.trim() || DEFAULT_SETTINGS.customInstructions,
})

export const normalizeSettingsForStorage = (input: Settings): Settings => ({
  ...normalizeAsrRunSettings(input),
  ...normalizeLlmRunSettings(input),
})

export const settingsFromEnv = (env: Partial<EnvMap>): Settings =>
  applySettingsDefaults({
    apiKey: env.ASR_API_KEY,
    apiUrl: env.ASR_API_URL,
    model: env.ASR_MODEL,
    llmApiUrl: env.LLM_API_URL,
    llmModel: env.LLM_MODEL,
    llmApiKey: env.LLM_API_KEY,
    customInstructions: env.CUSTOM_INSTRUCTIONS,
  })

export const settingsToEnv = (settings: Settings): EnvMap => {
  const normalized = normalizeSettingsForStorage(settings)

  return {
    ASR_API_KEY: normalized.apiKey,
    ASR_API_URL: normalized.apiUrl,
    ASR_MODEL: normalized.model,
    LLM_API_KEY: normalized.llmApiKey,
    LLM_API_URL: normalized.llmApiUrl,
    LLM_MODEL: normalized.llmModel,
    CUSTOM_INSTRUCTIONS: normalized.customInstructions,
  }
}

export const areSettingsEqual = (a: Settings, b: Settings): boolean =>
  a.apiKey === b.apiKey &&
  a.apiUrl === b.apiUrl &&
  a.model === b.model &&
  a.llmApiUrl === b.llmApiUrl &&
  a.llmModel === b.llmModel &&
  a.llmApiKey === b.llmApiKey &&
  a.customInstructions === b.customInstructions
