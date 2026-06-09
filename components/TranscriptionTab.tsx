import type { ReactElement } from 'react'
import type { useTranscriptionFlow } from '@/hooks/use-transcription-flow'
import { PolishActionButton } from '@/components/PolishActionButton'

type TranscriptionTabPolishFlow = {
  polishText: (text: string) => Promise<void>
  polishing: boolean
}

type TranscriptionTabTranscriptionFlow = Pick<
  ReturnType<typeof useTranscriptionFlow>,
  'copyTranscription' | 'copied' | 'transcriptionResult'
>

type TranscriptionTabProps = {
  polishFlow: TranscriptionTabPolishFlow
  transcriptionFlow: TranscriptionTabTranscriptionFlow
  transcriptionDisplayText: string
  transcriptionRawText: string
  canPolish: boolean
}

export function TranscriptionTab({
  polishFlow,
  transcriptionFlow,
  transcriptionDisplayText,
  transcriptionRawText,
  canPolish,
}: TranscriptionTabProps): ReactElement {
  return (
    <div role="tabpanel" id="tabpanel-transcription" aria-labelledby="tab-transcription" className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <PolishActionButton
          label="开始润色"
          polishing={polishFlow.polishing}
          disabled={!canPolish}
          onClick={() => void polishFlow.polishText(transcriptionRawText)}
        />
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
