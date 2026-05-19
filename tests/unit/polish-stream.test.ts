import { describe, expect, it } from 'vitest'
import {
  consumePolishStream,
  getPolishCompletionLog,
  parsePolishStreamLine,
  type PolishStreamState,
} from '@/lib/polish-stream'

const encodeStream = (chunks: string[]): ReadableStream<Uint8Array> => new ReadableStream({
  start(controller) {
    const encoder = new TextEncoder()
    for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
    controller.close()
  },
})

describe('parsePolishStreamLine', () => {
  it('appends delta content and records finish reasons', () => {
    const initial: PolishStreamState = { text: '', finishReason: null }
    const first = parsePolishStreamLine('data: {"choices":[{"delta":{"content":"你好"},"finish_reason":null}]}', initial)
    const second = parsePolishStreamLine('data: {"choices":[{"delta":{"content":"世界"},"finish_reason":"stop"}]}', first.state)

    expect(second.state).toEqual({ text: '你好世界', finishReason: 'stop' })
    expect(first.changed).toBe(true)
    expect(second.changed).toBe(true)
  })

  it('ignores non-data lines and detects done events', () => {
    const state: PolishStreamState = { text: 'x', finishReason: null }

    expect(parsePolishStreamLine(': keepalive', state)).toMatchObject({
      state,
      done: false,
      changed: false,
    })
    expect(parsePolishStreamLine('data: [DONE]', state)).toMatchObject({
      state,
      done: true,
      changed: false,
    })
  })

  it('supports SSE data lines without a space after the colon', () => {
    const parsed = parsePolishStreamLine(
      'data:{"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}',
      { text: '', finishReason: null }
    )

    expect(parsed.state).toEqual({ text: 'ok', finishReason: 'stop' })
  })

  it('returns a warning for malformed JSON chunks', () => {
    const parsed = parsePolishStreamLine('data: {"choices":[', { text: '', finishReason: null })

    expect(parsed.warning?.message).toBeTruthy()
    expect(parsed.warning?.chunk).toBe('{"choices":[')
    expect(parsed.changed).toBe(false)
  })

  it('returns a warning for whitespace-only data lines', () => {
    const parsed = parsePolishStreamLine('data:   ', { text: '', finishReason: null })

    expect(parsed.warning?.message).toBeTruthy()
    expect(parsed.warning?.chunk).toBe('  ')
    expect(parsed.changed).toBe(false)
  })
})

describe('consumePolishStream', () => {
  it('consumes split SSE chunks and reports streamed content', async () => {
    const updates: string[] = []
    const result = await consumePolishStream(
      encodeStream([
        'data: {"choices":[{"delta":{"content":"你"},"finish_reason":null}]}\n',
        'data: {"choices":[{"delta":{"content":"好"},"finish_reason":"stop"}]}\n',
        'data: [DONE]\n',
      ]),
      {
        onContent: ({ text }) => updates.push(text),
      }
    )

    expect(result.text).toBe('你好')
    expect(result.finishReason).toBe('stop')
    expect(result.warnings).toEqual([])
    expect(updates).toEqual(['你', '你好'])
  })

  it('skips malformed chunks while keeping later content', async () => {
    const warnings: string[] = []
    const result = await consumePolishStream(
      encodeStream([
        'data: {"choices":[\n',
        'data: {"choices":[{"delta":{"content":"ok"},"finish_reason":"length"}]}\n',
      ]),
      {
        onWarning: ({ chunk }) => warnings.push(chunk),
      }
    )

    expect(result.text).toBe('ok')
    expect(result.finishReason).toBe('length')
    expect(warnings).toEqual(['{"choices":['])
  })

  it('processes trailing buffered content when the stream closes without DONE', async () => {
    const updates: string[] = []
    const result = await consumePolishStream(
      encodeStream([
        'data: {"choices":[{"delta":{"content":"尾段"},"finish_reason":"stop"}]}',
      ]),
      {
        onContent: ({ text }) => updates.push(text),
      }
    )

    expect(result.text).toBe('尾段')
    expect(result.finishReason).toBe('stop')
    expect(result.completedNormally).toBe(false)
    expect(updates).toEqual(['尾段'])
  })

  it('propagates read errors and still releases the reader lock', async () => {
    let released = false
    const stream = {
      getReader: () => ({
        read: async () => {
          throw new Error('stream aborted')
        },
        releaseLock: () => {
          released = true
        },
      }),
    } as unknown as ReadableStream<Uint8Array>

    await expect(consumePolishStream(stream)).rejects.toThrow('stream aborted')
    expect(released).toBe(true)
  })

  it('cancels the reader after a DONE event', async () => {
    let canceled = false
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder()
        controller.enqueue(encoder.encode('data: [DONE]\n'))
      },
      cancel() {
        canceled = true
      },
    })

    const result = await consumePolishStream(stream)

    expect(result.text).toBe('')
    expect(canceled).toBe(true)
  })
})

describe('getPolishCompletionLog', () => {
  it('summarizes known finish reasons', () => {
    expect(getPolishCompletionLog({ text: '', finishReason: null })).toEqual({
      message: '润色完成但无内容返回',
      type: 'warning',
    })
    expect(getPolishCompletionLog({ text: '', finishReason: 'content_filter' })).toEqual({
      message: '润色无内容: 内容触发安全过滤',
      type: 'warning',
    })
    expect(getPolishCompletionLog({ text: 'abc', finishReason: 'stop' })).toEqual({
      message: '润色完成! 文本长度: 3 字符',
      type: 'success',
    })
    expect(getPolishCompletionLog({ text: 'abc', finishReason: 'length' })).toEqual({
      message: '润色被截断: 达到最大长度限制 (已输出 3 字符)',
      type: 'warning',
    })
    expect(getPolishCompletionLog({ text: 'abc', finishReason: 'content_filter' })).toEqual({
      message: '润色被截断: 内容触发安全过滤 (已输出 3 字符)',
      type: 'warning',
    })
    expect(getPolishCompletionLog({ text: 'abc', finishReason: null })).toEqual({
      message: '润色结束 (finish_reason=未知), 文本长度: 3 字符',
      type: 'info',
    })
    expect(getPolishCompletionLog({ text: '', finishReason: null, completedNormally: false })).toEqual({
      message: '润色流异常结束: 未收到结束标记',
      type: 'warning',
    })
    expect(getPolishCompletionLog({ text: 'abc', finishReason: 'stop', completedNormally: false })).toEqual({
      message: '润色流异常结束: 未收到结束标记 (已输出 3 字符)',
      type: 'warning',
    })
  })
})
