import path from 'node:path'
import { readEnvFile } from '@/lib/env-file'
import { DEFAULT_FETCH_AUDIO_MAX_BYTES } from '@/lib/runtime-config-constants'

export { DEFAULT_FETCH_AUDIO_MAX_BYTES } from '@/lib/runtime-config-constants'

const getRuntimeEnvFilePath = (): string => path.resolve(/* turbopackIgnore: true */ process.cwd(), '.env')

const parseFetchAudioMaxBytes = (raw: string | undefined): number => {
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

export const getFetchAudioMaxBytes = async (): Promise<number> => {
  const { env } = await readEnvFile(getRuntimeEnvFilePath())
  return parseFetchAudioMaxBytes(env.FETCH_AUDIO_MAX_BYTES)
}
