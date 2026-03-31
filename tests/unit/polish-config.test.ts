import { describe, expect, it } from 'vitest'

import {
  buildChatCompletionsUrl,
  DEFAULT_POLISH_INSTRUCTIONS,
  FIXED_SYSTEM_PROMPT,
} from '@/lib/polish-config'

describe('polish-config', () => {
  it('导出稳定的默认润色提示词', () => {
    expect(DEFAULT_POLISH_INSTRUCTIONS).toContain('纠正错别字和语法错误')
    expect(FIXED_SYSTEM_PROMPT).toContain('专业的文字编辑助手')
  })

  it('拼接 chat completions 地址时会去掉多余尾斜杠', () => {
    expect(buildChatCompletionsUrl('https://api.example.com/v1')).toBe(
      'https://api.example.com/v1/chat/completions'
    )
    expect(buildChatCompletionsUrl('https://api.example.com/v1/')).toBe(
      'https://api.example.com/v1/chat/completions'
    )
    expect(buildChatCompletionsUrl(' https://api.example.com/v1/// ')).toBe(
      'https://api.example.com/v1/chat/completions'
    )
  })
})
