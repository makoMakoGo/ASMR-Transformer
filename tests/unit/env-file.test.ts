import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { parseEnv, stringifyEnvValue, upsertEnvContent, writeEnvFile } from '@/lib/env-file'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
})

describe('env-file', () => {
  it('parseEnv: supports basic and quoted values', () => {
    const content = [
      '# comment',
      'ASR_API_KEY=sk-123',
      'EMPTY=',
      'SPACED="a b c"',
      "SINGLE='x y'",
      'INLINE=value # trailing comment',
      'export EXPORTED="ok"',
      '',
    ].join('\n')

    expect(parseEnv(content)).toEqual({
      ASR_API_KEY: 'sk-123',
      EMPTY: '',
      SPACED: 'a b c',
      SINGLE: 'x y',
      INLINE: 'value',
      EXPORTED: 'ok',
    })
  })

  it('stringifyEnvValue: quotes when needed', () => {
    expect(stringifyEnvValue('simple-1.2.3')).toBe('simple-1.2.3')
    expect(stringifyEnvValue('a b')).toBe('"a b"')
    expect(stringifyEnvValue('x#y')).toBe('"x#y"')
    expect(stringifyEnvValue('line1\nline2')).toBe('"line1\\nline2"')
  })

  it('upsertEnvContent: updates existing keys and appends missing keys', () => {
    const existing = [
      '# header',
      'ASR_API_KEY=old',
      'export LLM_MODEL=OldModel',
      'KEEP_ME=1',
      '',
    ].join('\n')

    const next = upsertEnvContent(existing, {
      ASR_API_KEY: 'new',
      LLM_MODEL: 'DeepSeek-V3.1-Terminus',
      NEW_KEY: 'hello world',
    })

    expect(next).toBe(
      [
        '# header',
        'ASR_API_KEY=new',
        'export LLM_MODEL=DeepSeek-V3.1-Terminus',
        'KEEP_ME=1',
        '',
        'NEW_KEY="hello world"',
        '',
      ].join('\n')
    )
  })

  it('writeEnvFile: creates parent directories and leaves only the final env file', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asmr-env-file-'))
    tempDirs.push(tempDir)

    const envPath = path.join(tempDir, 'nested', '.env')
    await writeEnvFile(envPath, { ASR_API_KEY: 'created' })

    const written = await fs.readFile(envPath, 'utf8')
    const files = await fs.readdir(path.dirname(envPath))
    expect(written).toBe('ASR_API_KEY=created\n')
    expect(files).toEqual(['.env'])
  })
})

