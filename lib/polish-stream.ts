export type PolishStreamFinishReason = 'stop' | 'length' | 'content_filter' | string

export type PolishStreamParseWarning = {
  message: string
  chunk: string
}

export type PolishStreamState = {
  text: string
  finishReason: PolishStreamFinishReason | null
}

export type PolishStreamConsumeResult = PolishStreamState & {
  warnings: PolishStreamParseWarning[]
}

export type PolishStreamCallbacks = {
  onContent?: (state: PolishStreamState) => void
  onWarning?: (warning: PolishStreamParseWarning) => void
}

const truncateChunk = (chunk: string): string =>
  chunk.length > 160 ? `${chunk.slice(0, 160)}...` : chunk

export const parsePolishStreamLine = (
  rawLine: string,
  state: PolishStreamState
): { state: PolishStreamState; warning?: PolishStreamParseWarning; done: boolean; changed: boolean } => {
  const line = rawLine.trimEnd()
  if (!line.startsWith('data:')) {
    return { state, done: false, changed: false }
  }

  let data = line.slice(5)
  if (data.startsWith(' ')) data = data.slice(1)
  if (data === '[DONE]') {
    return { state, done: true, changed: false }
  }

  try {
    const parsed = JSON.parse(data)
    const choice = parsed.choices?.[0]
    const content = typeof choice?.delta?.content === 'string' ? choice.delta.content : ''
    const finishReason = typeof choice?.finish_reason === 'string' ? choice.finish_reason : state.finishReason
    const nextState = {
      text: content ? `${state.text}${content}` : state.text,
      finishReason,
    }

    return {
      state: nextState,
      done: false,
      changed: nextState.text !== state.text || nextState.finishReason !== state.finishReason,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      state,
      done: false,
      changed: false,
      warning: {
        message: msg,
        chunk: truncateChunk(data),
      },
    }
  }
}

export const getPolishCompletionLog = ({ text, finishReason }: PolishStreamState): {
  message: string
  type: 'success' | 'warning' | 'info'
} => {
  if (!text) {
    return { message: '润色完成但无内容返回', type: 'warning' }
  }

  if (finishReason === 'content_filter') {
    return { message: `润色被截断: 内容触发安全过滤 (已输出 ${text.length} 字符)`, type: 'warning' }
  }

  if (finishReason === 'length') {
    return { message: `润色被截断: 达到最大长度限制 (已输出 ${text.length} 字符)`, type: 'warning' }
  }

  if (finishReason === 'stop') {
    return { message: `润色完成! 文本长度: ${text.length} 字符`, type: 'success' }
  }

  return { message: `润色结束 (finish_reason=${finishReason ?? '未知'}), 文本长度: ${text.length} 字符`, type: 'info' }
}

export const consumePolishStream = async (
  stream: ReadableStream<Uint8Array>,
  callbacks: PolishStreamCallbacks = {}
): Promise<PolishStreamConsumeResult> => {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  const warnings: PolishStreamParseWarning[] = []
  let state: PolishStreamState = { text: '', finishReason: null }
  let buffer = ''
  let doneEventReceived = false

  const handleLine = (line: string) => {
    if (doneEventReceived) return

    const parsed = parsePolishStreamLine(line, state)
    state = parsed.state
    if (parsed.warning) {
      warnings.push(parsed.warning)
      callbacks.onWarning?.(parsed.warning)
    }
    if (parsed.changed) callbacks.onContent?.(state)
    if (parsed.done) doneEventReceived = true
  }

  try {
    while (!doneEventReceived) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) handleLine(line)
    }

    if (doneEventReceived) {
      await reader.cancel()
    }
  } finally {
    reader.releaseLock()
  }

  buffer += decoder.decode()
  if (buffer && !doneEventReceived) {
    for (const line of buffer.split('\n')) handleLine(line)
  }
  return { ...state, warnings }
}
