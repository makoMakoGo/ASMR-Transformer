import { describe, it, expect } from 'vitest'
import { parseEnv, stringifyEnvValue, upsertEnvContent } from '@/lib/env-file'

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

    expect(next).toContain('ASR_API_KEY=new')
    expect(next).toContain('export LLM_MODEL=DeepSeek-V3.1-Terminus')
    expect(next).toContain('KEEP_ME=1')
    expect(next).toContain('NEW_KEY=\"hello world\"')
    expect(next.endsWith('\n')).toBe(true)
  })
})

