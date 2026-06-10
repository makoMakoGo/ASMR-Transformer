import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_FETCH_AUDIO_MAX_BYTES, getFetchAudioMaxBytes } from '@/lib/runtime-config'

const tempDirs: string[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
})

describe('runtime-config', () => {
  it('returns the default limit when FETCH_AUDIO_MAX_BYTES is missing from .env', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asmr-runtime-config-missing-'))
    tempDirs.push(tempDir)
    vi.spyOn(process, 'cwd').mockReturnValue(tempDir)
    vi.stubEnv('FETCH_AUDIO_MAX_BYTES', '1048576')

    await expect(getFetchAudioMaxBytes()).resolves.toBe(DEFAULT_FETCH_AUDIO_MAX_BYTES)
  })

  it('returns the configured limit from .env when FETCH_AUDIO_MAX_BYTES is valid', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asmr-runtime-config-valid-'))
    tempDirs.push(tempDir)
    vi.spyOn(process, 'cwd').mockReturnValue(tempDir)
    vi.stubEnv('FETCH_AUDIO_MAX_BYTES', '1048576')
    await fs.writeFile(path.join(tempDir, '.env'), 'FETCH_AUDIO_MAX_BYTES=2097152\n')

    await expect(getFetchAudioMaxBytes()).resolves.toBe(2097152)
  })

  it('rejects blank or invalid FETCH_AUDIO_MAX_BYTES values from .env', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asmr-runtime-config-invalid-'))
    tempDirs.push(tempDir)
    vi.spyOn(process, 'cwd').mockReturnValue(tempDir)
    const envPath = path.join(tempDir, '.env')

    for (const [line, value] of [
      ['FETCH_AUDIO_MAX_BYTES="   "\n', '   '],
      ['FETCH_AUDIO_MAX_BYTES=abc\n', 'abc'],
      ['FETCH_AUDIO_MAX_BYTES=0\n', '0'],
      ['FETCH_AUDIO_MAX_BYTES=-1\n', '-1'],
    ]) {
      await fs.writeFile(envPath, line)
      await expect(getFetchAudioMaxBytes()).rejects.toThrowError(
        `FETCH_AUDIO_MAX_BYTES must be a positive integer, got ${JSON.stringify(value)}`
      )
    }
  })
})
