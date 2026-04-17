import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_FETCH_AUDIO_MAX_BYTES, getFetchAudioMaxBytes } from '@/lib/runtime-config'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('runtime-config', () => {
  it('returns the default limit when FETCH_AUDIO_MAX_BYTES is unset', () => {
    const previous = process.env.FETCH_AUDIO_MAX_BYTES
    delete process.env.FETCH_AUDIO_MAX_BYTES

    try {
      expect(getFetchAudioMaxBytes()).toBe(DEFAULT_FETCH_AUDIO_MAX_BYTES)
    } finally {
      if (previous !== undefined) process.env.FETCH_AUDIO_MAX_BYTES = previous
    }
  })

  it('returns the configured limit when FETCH_AUDIO_MAX_BYTES is valid', () => {
    vi.stubEnv('FETCH_AUDIO_MAX_BYTES', '1048576')

    expect(getFetchAudioMaxBytes()).toBe(1048576)
  })

  it('rejects blank or invalid FETCH_AUDIO_MAX_BYTES values', () => {
    for (const value of ['   ', 'abc', '0', '-1']) {
      vi.stubEnv('FETCH_AUDIO_MAX_BYTES', value)
      expect(() => getFetchAudioMaxBytes()).toThrowError(
        `FETCH_AUDIO_MAX_BYTES must be a positive integer, got ${JSON.stringify(value)}`
      )
    }
  })
})
