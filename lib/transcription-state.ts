export type ProcessingStatus = 'idle' | 'processing' | 'transcribing' | 'done' | 'error'

export const PROCESSING_STATUS_CONFIG: Record<
  ProcessingStatus,
  { text: string; color: string }
> = {
  idle: { text: '准备就绪', color: 'bg-muted-foreground' },
  processing: { text: '处理中', color: 'bg-primary' },
  transcribing: { text: '识别中', color: 'bg-amber-600' },
  done: { text: '已完成', color: 'bg-emerald-600' },
  error: { text: '出错了', color: 'bg-destructive' },
}

export type TranscriptionResult =
  | { kind: 'idle' }
  | { kind: 'empty' }
  | { kind: 'success'; text: string }
  | { kind: 'error'; message: string }

export type PolishResult =
  | { kind: 'idle' }
  | { kind: 'streaming'; text: string }
  | { kind: 'success'; text: string }
  | { kind: 'error'; message: string }

export const IDLE_TRANSCRIPTION_RESULT: TranscriptionResult = { kind: 'idle' }
export const IDLE_POLISH_RESULT: PolishResult = { kind: 'idle' }

export const getTranscriptionText = (result: TranscriptionResult): string =>
  result.kind === 'success' ? result.text : ''

export const getTranscriptionDisplayText = (result: TranscriptionResult): string => {
  if (result.kind === 'success') return result.text
  if (result.kind === 'empty') return '识别完成，但服务未返回文本。'
  if (result.kind === 'error') return result.message
  return ''
}

export const canPolishTranscription = (result: TranscriptionResult): boolean =>
  result.kind === 'success' && result.text.trim().length > 0

export const getPolishText = (result: PolishResult): string =>
  result.kind === 'streaming' || result.kind === 'success' ? result.text : ''

export const hasPolishText = (result: PolishResult): boolean => getPolishText(result).length > 0
