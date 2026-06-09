import { describe, expect, it } from 'vitest'
import {
  applySettingsDefaults,
  DEFAULT_ASR_MODEL,
  DEFAULT_LLM_MODEL,
  DEFAULT_SETTINGS,
  normalizeAsrRunSettings,
  normalizeLlmRunSettings,
  normalizeSettingsForStorage,
} from '@/lib/app-settings'
import { formatFileSize } from '@/lib/file-size'
import {
  canPolishTranscription,
  PROCESSING_STATUS_CONFIG,
} from '@/lib/transcription-state'

describe('formatFileSize', () => {
  it('formats bytes, KB, and MB from the real shared helper', () => {
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(500)).toBe('500 B')
    expect(formatFileSize(1024)).toBe('1.00 KB')
    expect(formatFileSize(1536)).toBe('1.50 KB')
    expect(formatFileSize(1024 * 1024 * 2.5)).toBe('2.50 MB')
  })
})

describe('PROCESSING_STATUS_CONFIG', () => {
  it('exposes the exact workflow states used by the page', () => {
    expect(Object.keys(PROCESSING_STATUS_CONFIG)).toEqual([
      'idle',
      'processing',
      'transcribing',
      'done',
      'error',
    ])
    expect(PROCESSING_STATUS_CONFIG.processing.text).toBe('处理中')
    expect(PROCESSING_STATUS_CONFIG.transcribing.text).toBe('识别中')
  })
})

describe('app-settings', () => {
  it('exports a single source of truth for defaults', () => {
    expect(DEFAULT_SETTINGS.apiUrl).toContain('siliconflow')
    expect(DEFAULT_SETTINGS.model).toBe(DEFAULT_ASR_MODEL)
    expect(DEFAULT_SETTINGS.llmModel).toBe(DEFAULT_LLM_MODEL)
    expect(DEFAULT_SETTINGS.customInstructions.length).toBeGreaterThan(0)
  })

  it('applies defaults only to configurable blanks', () => {
    expect(
      applySettingsDefaults({
        apiKey: '  raw-key  ',
        apiUrl: ' ',
        model: '',
        llmApiUrl: ' ',
        llmModel: '',
        customInstructions: '   ',
      })
    ).toEqual({
      ...DEFAULT_SETTINGS,
      apiKey: '  raw-key  ',
      llmApiKey: '',
    })
  })

  it('normalizes persisted settings without losing explicit secrets', () => {
    expect(
      normalizeSettingsForStorage({
        ...DEFAULT_SETTINGS,
        apiKey: '  secret  ',
        apiUrl: ' ',
        model: ' ',
        llmApiUrl: ' ',
        llmModel: ' ',
        llmApiKey: '  llm-secret  ',
        customInstructions: ' ',
      })
    ).toEqual({
      ...DEFAULT_SETTINGS,
      apiKey: 'secret',
      llmApiKey: 'llm-secret',
    })
  })

  it('normalizes ASR and LLM runtime slices independently', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      apiKey: '  asr-secret  ',
      apiUrl: ' ',
      model: ' custom-asr ',
      llmApiUrl: ' ',
      llmModel: ' custom-llm ',
      llmApiKey: '  llm-secret  ',
      customInstructions: ' custom instructions ',
    }

    expect(normalizeAsrRunSettings(settings)).toEqual({
      apiKey: 'asr-secret',
      apiUrl: DEFAULT_SETTINGS.apiUrl,
      model: 'custom-asr',
    })
    expect(normalizeLlmRunSettings(settings)).toEqual({
      llmApiUrl: DEFAULT_SETTINGS.llmApiUrl,
      llmModel: 'custom-llm',
      llmApiKey: 'llm-secret',
      customInstructions: 'custom instructions',
    })
  })
})

describe('canPolishTranscription', () => {
  it('allows polish only for successful non-empty transcriptions', () => {
    expect(canPolishTranscription({ kind: 'idle' })).toBe(false)
    expect(canPolishTranscription({ kind: 'empty' })).toBe(false)
    expect(canPolishTranscription({ kind: 'error', message: 'bad' })).toBe(false)
    expect(canPolishTranscription({ kind: 'success', text: '  ' })).toBe(false)
    expect(canPolishTranscription({ kind: 'success', text: 'hello' })).toBe(true)
  })
})
