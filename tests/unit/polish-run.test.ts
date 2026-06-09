import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type LlmRunSettings } from '@/lib/app-settings'
import {
  PolishRunError,
  runPolishText,
  type PolishRunLogEntry,
} from '@/lib/polish-run'
import type { PolishStreamParseWarning, PolishStreamState } from '@/lib/polish-stream'

const encodeStream = (chunks: string[]): ReadableStream<Uint8Array> => new ReadableStream<Uint8Array>({
  start(controller: ReadableStreamDefaultController<Uint8Array>): void {
    const encoder = new TextEncoder()
    for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
    controller.close()
  },
})

type CapturedRequest = {
  input: RequestInfo | URL
  init: RequestInit | undefined
}

const readCapturedRequest = (request: CapturedRequest | null): CapturedRequest => {
  if (!request) throw new Error('request was not captured')
  return request
}

const readJsonBody = (request: CapturedRequest): Record<string, unknown> => {
  if (typeof request.init?.body !== 'string') throw new Error('request body was not a JSON string')
  return JSON.parse(request.init.body) as Record<string, unknown>
}

const buildSettings = (overrides: Partial<LlmRunSettings> = {}): LlmRunSettings => ({
  llmApiUrl: ' https://llm.example/v1 ',
  llmModel: ' polish-model ',
  llmApiKey: ' llm-key ',
  customInstructions: ' polish this ',
  ...overrides,
})

describe('runPolishText', () => {
  it('posts normalized settings and consumes successful SSE output', async () => {
    const logs: PolishRunLogEntry[] = []
    const updates: string[] = []
    let capturedRequest: CapturedRequest | null = null
    const fetchFn: typeof fetch = async (input, init) => {
      capturedRequest = { input, init }
      return new Response(encodeStream([
        'data: {"choices":[{"delta":{"content":"你"},"finish_reason":null}]}\n',
        'data: {"choices":[{"delta":{"content":"好"},"finish_reason":"stop"}]}\n',
        'data: [DONE]\n',
      ]), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    }

    const result = await runPolishText('raw transcription', buildSettings(), {
      onContent: ({ text }: PolishStreamState) => {
        updates.push(text)
      },
      onLog: (entry) => {
        logs.push(entry)
      },
    }, { fetchFn })

    const request = readCapturedRequest(capturedRequest)
    expect(request.input).toBe('/api/polish')
    expect(request.init?.method).toBe('POST')
    expect(request.init?.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(readJsonBody(request)).toEqual({
      text: 'raw transcription',
      apiUrl: 'https://llm.example/v1',
      apiKey: 'llm-key',
      model: 'polish-model',
      customInstructions: 'polish this',
    })
    expect(updates).toEqual(['你', '你好'])
    expect(result).toMatchObject({
      text: '你好',
      finishReason: 'stop',
      warnings: [],
      completedNormally: true,
      completionLog: { message: '润色完成! 文本长度: 2 字符', type: 'success' },
    })
    expect(logs).toEqual([
      { message: 'LLM API: https://llm.example/v1', type: 'info' },
      { message: 'LLM 模型: polish-model', type: 'info' },
    ])
  })

  it('emits the missing API key warning and omits apiKey from the request body', async () => {
    const logs: PolishRunLogEntry[] = []
    let capturedRequest: CapturedRequest | null = null
    const fetchFn: typeof fetch = async (input, init) => {
      capturedRequest = { input, init }
      return new Response(encodeStream(['data: [DONE]\n']), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    }

    await runPolishText('text', buildSettings({ llmApiKey: '   ' }), {
      onLog: (entry) => {
        logs.push(entry)
      },
    }, { fetchFn })

    expect(readJsonBody(readCapturedRequest(capturedRequest))).not.toHaveProperty('apiKey')
    expect(logs).toContainEqual({
      message: '未填写 LLM API Key，将尝试无鉴权请求（若服务需要 Key 会失败）',
      type: 'warning',
    })
  })

  it('turns JSON error responses into a run error', async () => {
    const fetchFn: typeof fetch = async () => new Response(JSON.stringify({ error: 'bad key' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })

    await expect(runPolishText('text', DEFAULT_SETTINGS, {}, { fetchFn }))
      .rejects
      .toThrow(new PolishRunError('bad key'))
  })

  it('treats JSON responses as errors even when the HTTP status is successful', async () => {
    const fetchFn: typeof fetch = async () => new Response(JSON.stringify({ error: 'provider error' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

    await expect(runPolishText('text', DEFAULT_SETTINGS, {}, { fetchFn }))
      .rejects
      .toThrow(new PolishRunError('provider error'))
  })

  it('rejects successful responses without a stream body', async () => {
    const fetchFn: typeof fetch = async () => new Response(null, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    })

    await expect(runPolishText('text', DEFAULT_SETTINGS, {}, { fetchFn }))
      .rejects
      .toThrow(new PolishRunError('无响应数据'))
  })

  it('reports stream warnings and abnormal stream endings through the run result', async () => {
    const logs: PolishRunLogEntry[] = []
    const warnings: PolishStreamParseWarning[] = []
    const fetchFn: typeof fetch = async () => new Response(encodeStream([
      'data: {"choices":[\n',
      'data: {"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}',
    ]), {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    })

    const result = await runPolishText('text', DEFAULT_SETTINGS, {
      onWarning: (warning) => {
        warnings.push(warning)
      },
      onLog: (entry) => {
        logs.push(entry)
      },
    }, { fetchFn })

    expect(warnings).toHaveLength(1)
    expect(warnings[0].chunk).toBe('{"choices":[')
    expect(result.text).toBe('ok')
    expect(result.completedNormally).toBe(false)
    expect(result.completionLog).toEqual({
      message: '润色流异常结束: 未收到结束标记 (已输出 2 字符)',
      type: 'warning',
    })
    expect(logs).toContainEqual({
      message: `润色响应单块解析失败，已跳过: ${warnings[0].message}; chunk={"choices":[`,
      type: 'warning',
    })
  })
})
