import type { ReactElement } from 'react'
import { PolishActionButton } from '@/components/PolishActionButton'
import type { PolishResult } from '@/lib/transcription-state'

type PolishTabPolishFlow = {
  polishText: (text: string) => Promise<void>
  polishing: boolean
  copyPolished: () => Promise<void>
  hasPolishText: boolean
  copied: boolean
  result: PolishResult
}

type PolishTabProps = {
  polishFlow: PolishTabPolishFlow
  transcriptionRawText: string
  polishedText: string
  polishedDisplayText: string
  canPolish: boolean
}

export function PolishTab({
  polishFlow,
  transcriptionRawText,
  polishedText,
  polishedDisplayText,
  canPolish,
}: PolishTabProps): ReactElement {
  return (
    <div role="tabpanel" id="tabpanel-polish" aria-labelledby="tab-polish" className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <PolishActionButton
          label="重新润色"
          polishing={polishFlow.polishing}
          disabled={!canPolish}
          onClick={() => void polishFlow.polishText(transcriptionRawText)}
        />
        <button
          onClick={() => void polishFlow.copyPolished()}
          disabled={!polishFlow.hasPolishText}
          className={`px-4 py-2 min-h-[40px] rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            polishFlow.copied
              ? 'bg-emerald-600 text-white'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          {polishFlow.copied ? '已复制' : '复制'}
        </button>
      </div>

      <div className="min-h-[200px] p-4 bg-muted/30 rounded-lg border border-border text-sm text-foreground whitespace-pre-wrap leading-relaxed">
        {polishFlow.polishing ? (
          <div className="flex items-center gap-2 text-primary">
            <span className="ai-dots">
              <span className="ai-dot" />
              <span className="ai-dot" />
              <span className="ai-dot" />
            </span>
            <span>正在润色...</span>
          </div>
        ) : (
          polishedDisplayText || <span className="text-muted-foreground">暂无润色结果，请先在「转录结果」页点击润色...</span>
        )}
      </div>

      {polishFlow.result.kind === 'success' && polishedText && (
        <p className="text-xs text-muted-foreground">
          {polishedText.length} 字符
        </p>
      )}
    </div>
  )
}
