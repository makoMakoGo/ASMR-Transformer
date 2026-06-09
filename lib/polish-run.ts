import { normalizeLlmRunSettings, type LlmRunSettings } from '@/lib/app-settings'
import { readJsonResponse, readResponseErrorMessage } from '@/lib/http-response'
import {
  consumePolishStream,
  getPolishCompletionLog,
  type PolishStreamConsumeResult,
  type PolishStreamParseWarning,
  type PolishStreamState,
} from '@/lib/polish-stream'

export type PolishRunLogEntry = {
  message: string
  type: 'success' | 'warning' | 'info'
}

export type PolishRunCallbacks = {
  onContent?: (state: PolishStreamState) => void
  onWarning?: (warning: PolishStreamParseWarning) => void
  onLog?: (entry: PolishRunLogEntry) => void
}

export type PolishRunOptions = {
  endpoint?: string
  fetchFn?: typeof fetch
  signal?: AbortSignal
}

export type PolishRunResult = PolishStreamConsumeResult & {
  completionLog: PolishRunLogEntry
}

type PolishErrorResponse = {
  error?: string
}

export class PolishRunError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PolishRunError'
  }
}

export const runPolishText = async (
  text: string,
  settings: LlmRunSettings,
  callbacks: PolishRunCallbacks = {},
  options: PolishRunOptions = {}
): Promise<PolishRunResult> => {
  const {
    endpoint = '/api/polish',
    fetchFn = fetch,
    signal,
  } = options
  const effectiveSettings = normalizeLlmRunSettings(settings)

  callbacks.onLog?.({ message: `LLM API: ${effectiveSettings.llmApiUrl}`, type: 'info' })
  callbacks.onLog?.({ message: `LLM 模型: ${effectiveSettings.llmModel}`, type: 'info' })
  if (!effectiveSettings.llmApiKey) {
    callbacks.onLog?.({ message: '未填写 LLM API Key，将尝试无鉴权请求（若服务需要 Key 会失败）', type: 'warning' })
  }

  const response = await fetchFn(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      text,
      apiUrl: effectiveSettings.llmApiUrl,
      apiKey: effectiveSettings.llmApiKey || undefined,
      model: effectiveSettings.llmModel,
      customInstructions: effectiveSettings.customInstructions,
    }),
  })

  const contentType = response.headers.get('content-type') || ''
  if (!response.ok || contentType.includes('application/json')) {
    const { data } = await readJsonResponse<PolishErrorResponse>(response)
    throw new PolishRunError(readResponseErrorMessage(response, data))
  }

  if (!response.body) {
    throw new PolishRunError('无响应数据')
  }

  const streamResult = await consumePolishStream(response.body, {
    onContent: callbacks.onContent,
    onWarning: (warning) => {
      callbacks.onWarning?.(warning)
      callbacks.onLog?.({
        message: `润色响应单块解析失败，已跳过: ${warning.message}; chunk=${warning.chunk}`,
        type: 'warning',
      })
    },
  })
  return {
    ...streamResult,
    completionLog: getPolishCompletionLog(streamResult),
  }
}
