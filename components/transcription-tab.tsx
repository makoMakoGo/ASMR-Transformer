import type { usePolishFlow } from '@/hooks/use-polish-flow'
import type { useTranscriptionFlow } from '@/hooks/use-transcription-flow'

type TranscriptionTabPolishFlow = Pick<ReturnType<typeof usePolishFlow>, 'polishText' | 'polishing'>
type TranscriptionTabTranscriptionFlow = Pick<
  ReturnType<typeof useTranscriptionFlow>,
  'copyTranscription' | 'copied' | 'transcriptionResult'
>

export function TranscriptionTab({
  polishFlow,
  transcriptionFlow,
  transcriptionDisplayText,
  transcriptionRawText,
  canPolish,
}: {
  polishFlow: TranscriptionTabPolishFlow
  transcriptionFlow: TranscriptionTabTranscriptionFlow
  transcriptionDisplayText: string
  transcriptionRawText: string
  canPolish: boolean
}) {
  return (
    <div role="tabpanel" id="tabpanel-transcription" aria-labelledby="tab-transcription" className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <button
          onClick={() => void polishFlow.polishText(transcriptionRawText)}
          disabled={!canPolish}
          className="px-4 py-2 min-h-[40px] bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium cursor-pointer transition-colors"
        >
          {polishFlow.polishing ? '润色中...' : '开始润色'}
        </button>
        <button
          onClick={() => void transcriptionFlow.copyTranscription()}
          disabled={!transcriptionDisplayText}
          className={`px-4 py-2 min-h-[40px] rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            transcriptionFlow.copied
              ? 'bg-emerald-600 text-white'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          {transcriptionFlow.copied ? '已复制' : '复制'}
        </button>
      </div>

      <div className="min-h-[200px] p-4 bg-muted/30 rounded-lg border border-border text-sm text-foreground whitespace-pre-wrap leading-relaxed">
        {transcriptionDisplayText || <span className="text-muted-foreground">暂无转录结果，请先在「来源」页上传或导入音频...</span>}
      </div>

      {transcriptionFlow.transcriptionResult.kind === 'success' && (
        <p className="text-xs text-muted-foreground">
          {transcriptionRawText.length} 字符
        </p>
      )}
    </div>
  )
}
