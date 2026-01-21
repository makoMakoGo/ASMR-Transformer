export const DEFAULT_FETCH_AUDIO_MAX_BYTES = 100 * 1024 * 1024

export const getFetchAudioMaxBytes = (): number => {
  const raw = (process.env.FETCH_AUDIO_MAX_BYTES || '').trim()
  if (!raw) return DEFAULT_FETCH_AUDIO_MAX_BYTES
  if (!/^\d+$/.test(raw)) return DEFAULT_FETCH_AUDIO_MAX_BYTES

  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value <= 0) return DEFAULT_FETCH_AUDIO_MAX_BYTES

  return value
}

