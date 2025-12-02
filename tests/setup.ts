import { config } from 'dotenv'
import { resolve } from 'path'

// 加载环境变量 (.env.local 优先，然后 .env)
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

// 服务器地址 - 使用 3092 端口避免冲突
export const TEST_PORT = 3092
export const BASE_URL = process.env.TEST_BASE_URL || `http://localhost:${TEST_PORT}`

// 测试配置
export const TEST_CONFIG = {
  ASR_API_KEY: process.env.ASR_API_KEY || '',
  ASR_API_URL: process.env.ASR_API_URL || 'https://api.siliconflow.cn/v1/audio/transcriptions',
  ASR_MODEL: process.env.ASR_MODEL || 'TeleAI/TeleSpeechASR',
  LLM_API_KEY: process.env.LLM_API_KEY || '',
  LLM_API_URL: process.env.LLM_API_URL || 'https://juya.owl.ci/v1',
  LLM_MODEL: process.env.LLM_MODEL || 'DeepSeek-V3.1-Terminus',
  TEST_AUDIO_FILE: process.env.TEST_AUDIO_FILE || "tests/fixtures/Juya's Opening.mp3",
}

// 检查必要的环境变量
export function requireAsrApiKey(): string {
  if (!TEST_CONFIG.ASR_API_KEY) {
    throw new Error('ASR_API_KEY is required. Please set it in .env.local file.')
  }
  return TEST_CONFIG.ASR_API_KEY
}
