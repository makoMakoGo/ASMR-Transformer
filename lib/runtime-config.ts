export const DEFAULT_FETCH_AUDIO_MAX_BYTES = 100 * 1024 * 1024

export const getFetchAudioMaxBytes = (): number => {
  const raw = process.env.FETCH_AUDIO_MAX_BYTES
  if (raw == null) return DEFAULT_FETCH_AUDIO_MAX_BYTES

  const trimmed = raw.trim()
  if (!trimmed || !/^\d+$/.test(trimmed)) {
    throw new Error(`FETCH_AUDIO_MAX_BYTES must be a positive integer, got ${JSON.stringify(raw)}`)
  }

  const value = Number(trimmed)
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`FETCH_AUDIO_MAX_BYTES must be a positive integer, got ${JSON.stringify(raw)}`)
  }

  return value
}

