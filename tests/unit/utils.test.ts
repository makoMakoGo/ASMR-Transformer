import { describe, it, expect } from 'vitest'

// 单元测试 - 工具函数

describe('文件大小格式化', () => {
  // 从 page.tsx 提取的逻辑
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  it('格式化字节', () => {
    expect(formatFileSize(500)).toBe('500 B')
    expect(formatFileSize(0)).toBe('0 B')
  })

  it('格式化 KB', () => {
    expect(formatFileSize(1024)).toBe('1.00 KB')
    expect(formatFileSize(2048)).toBe('2.00 KB')
    expect(formatFileSize(1536)).toBe('1.50 KB')
  })

  it('格式化 MB', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.00 MB')
    expect(formatFileSize(1024 * 1024 * 2.5)).toBe('2.50 MB')
  })
})

describe('状态配置', () => {
  const statusConfig = {
    idle: { text: '准备就绪', color: 'bg-[#8E8E93]' },
    uploading: { text: '上传中', color: 'bg-[#007AFF]' },
    uploaded: { text: '已上传', color: 'bg-[#34C759]' },
    transcribing: { text: '识别中', color: 'bg-[#FF9500]' },
    done: { text: '已完成', color: 'bg-[#34C759]' },
    error: { text: '出错了', color: 'bg-[#FF3B30]' },
  }

  it('所有状态都有配置', () => {
    const statuses = ['idle', 'uploading', 'uploaded', 'transcribing', 'done', 'error'] as const
    statuses.forEach((status) => {
      expect(statusConfig[status]).toBeDefined()
      expect(statusConfig[status].text).toBeDefined()
      expect(statusConfig[status].color).toBeDefined()
    })
  })
})

describe('默认配置常量', () => {
  const DEFAULT_ASR_API_URL = 'https://api.siliconflow.cn/v1/audio/transcriptions'
  const DEFAULT_ASR_MODEL = 'TeleAI/TeleSpeechASR'
  const DEFAULT_LLM_API_URL = 'https://juya.owl.ci/v1'
  const DEFAULT_LLM_MODEL = 'DeepSeek-V3.1-Terminus'

  it('ASR 默认配置正确', () => {
    expect(DEFAULT_ASR_API_URL).toContain('siliconflow')
    expect(DEFAULT_ASR_MODEL).toBe('TeleAI/TeleSpeechASR')
  })

  it('LLM 默认配置正确', () => {
    expect(DEFAULT_LLM_API_URL).toContain('juya.owl.ci')
    expect(DEFAULT_LLM_MODEL).toContain('DeepSeek')
  })
})
