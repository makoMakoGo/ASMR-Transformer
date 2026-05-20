import { useState, type DragEvent, type ReactElement } from 'react'
import { formatFileSize } from '@/lib/file-size'
import { PROCESSING_STATUS_CONFIG } from '@/lib/transcription-state'
import type { useTranscriptionFlow } from '@/hooks/use-transcription-flow'

type SourceTabTranscriptionFlow = Pick<
  ReturnType<typeof useTranscriptionFlow>,
  | 'fileInputRef'
  | 'handleFileChange'
  | 'handleFileSelect'
  | 'audioUrlInput'
  | 'setAudioUrlInput'
  | 'checkAudioUrl'
  | 'checking'
  | 'audioInfo'
  | 'loading'
  | 'clearAudio'
  | 'startTranscribe'
  | 'status'
  | 'uploadProgress'
  | 'statusMessage'
>

type SourceTabProps = {
  transcriptionFlow: SourceTabTranscriptionFlow
  hasApiKey: boolean
  canTranscribe: boolean
  showIndeterminateProgress: boolean
}

export function SourceTab({
  transcriptionFlow,
  hasApiKey,
  canTranscribe,
  showIndeterminateProgress,
}: SourceTabProps): ReactElement {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (!file) return

    transcriptionFlow.handleFileSelect(file)
  }

  return (
    <div role="tabpanel" id="tabpanel-source" aria-labelledby="tab-source" className="space-y-5 animate-fade-in">
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">本地上传</label>
        <div
          onClick={() => transcriptionFlow.fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              transcriptionFlow.fileInputRef.current?.click()
            }
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary ${
            isDragging
              ? 'border-primary bg-primary/10 scale-[1.01]'
              : 'border-border hover:border-primary/50 hover:bg-muted/30'
          }`}
          aria-label="选择音频文件"
        >
          <div className="flex flex-col items-center gap-2">
            <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm text-foreground">点击选择或拖拽音频文件</p>
            <p className="text-xs text-muted-foreground">支持 mp3, wav, m4a, flac...</p>
          </div>
        </div>
      </div>
      <input
        ref={transcriptionFlow.fileInputRef}
        type="file"
        accept="audio/*"
        onChange={transcriptionFlow.handleFileChange}
        className="hidden"
        aria-label="选择音频文件"
      />

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">或者</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="space-y-2">
        <label htmlFor="audio-url-input" className="text-xs font-medium text-muted-foreground">在线链接</label>
        <div className="flex gap-2">
          <input
            id="audio-url-input"
            type="text"
            value={transcriptionFlow.audioUrlInput}
            onChange={(e) => transcriptionFlow.setAudioUrlInput(e.target.value)}
            placeholder="粘贴音频链接..."
            className="flex-1 px-3 py-2 bg-transparent rounded-lg border border-border text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary transition-colors"
          />
          <button
            onClick={transcriptionFlow.checkAudioUrl}
            disabled={transcriptionFlow.checking || !transcriptionFlow.audioUrlInput.trim()}
            className="px-4 py-2 min-h-[44px] bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium cursor-pointer transition-colors"
          >
            {transcriptionFlow.checking ? '检查中...' : '检查'}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">支持 <a href="https://www.asmrgay.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">asmrgay.com</a> 及备用站点的播放页面或直链</p>
      </div>

      <div className="p-3 bg-muted/50 rounded-lg border border-border">
        {transcriptionFlow.audioInfo && !transcriptionFlow.loading ? (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <svg className="w-5 h-5 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                <span className="text-sm text-foreground font-medium truncate">{transcriptionFlow.audioInfo.name}</span>
              </div>
              <button
                onClick={transcriptionFlow.clearAudio}
                className="p-1 hover:bg-muted rounded cursor-pointer ml-2"
                aria-label="删除所选音频"
              >
                <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {formatFileSize(transcriptionFlow.audioInfo.size)} · 来源: {transcriptionFlow.audioInfo.source === 'local' ? '本地上传' : '在线链接'}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <span className="text-sm">未选择音频</span>
          </div>
        )}
      </div>

      <button
        onClick={transcriptionFlow.startTranscribe}
        disabled={!canTranscribe}
        className="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium cursor-pointer transition-colors"
      >
        {transcriptionFlow.loading ? '处理中...' : '开始转录'}
      </button>

      {!hasApiKey && (
        <p className="text-xs text-muted-foreground text-center">
          请先在「设置」中填写 ASR API Key
        </p>
      )}

      {transcriptionFlow.status !== 'idle' && (
        <div className="p-3 bg-muted/50 rounded-lg border border-border" role="status" aria-live="polite">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`w-2 h-2 rounded-full ${PROCESSING_STATUS_CONFIG[transcriptionFlow.status].color} ${
                ['processing', 'transcribing'].includes(transcriptionFlow.status) ? 'animate-pulse' : ''
              }`}
              aria-hidden="true"
            />
            <span className="text-sm font-medium text-foreground">
              {PROCESSING_STATUS_CONFIG[transcriptionFlow.status].text}
            </span>
            {transcriptionFlow.status === 'processing' && transcriptionFlow.uploadProgress > 0 && (
              <span className="text-xs text-muted-foreground ml-auto">
                {transcriptionFlow.uploadProgress}%
              </span>
            )}
          </div>
          {transcriptionFlow.status === 'processing' && transcriptionFlow.uploadProgress > 0 && (
            <div className="w-full h-1 bg-muted rounded-full overflow-hidden" role="progressbar" aria-valuenow={transcriptionFlow.uploadProgress} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-primary transition-all duration-300" style={{ width: `${transcriptionFlow.uploadProgress}%` }} />
            </div>
          )}
          {showIndeterminateProgress ? (
            <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary/60 animate-pulse w-full" />
            </div>
          ) : null}
          {transcriptionFlow.statusMessage && (
            <p className="text-xs text-muted-foreground mt-2">{transcriptionFlow.statusMessage}</p>
          )}
        </div>
      )}
    </div>
  )
}
