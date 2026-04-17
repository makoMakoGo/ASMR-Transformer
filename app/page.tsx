'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { DEFAULT_SETTINGS } from '@/lib/app-settings'
import { formatFileSize } from '@/lib/file-size'
import {
  canPolishTranscription,
  getPolishText,
  getTranscriptionDisplayText,
  getTranscriptionText,
  PROCESSING_STATUS_CONFIG,
} from '@/lib/transcription-state'
import { useActivityLog } from '@/hooks/use-activity-log'
import { usePolishFlow } from '@/hooks/use-polish-flow'
import { useSettingsState } from '@/hooks/use-settings-state'
import { useThemePreference } from '@/hooks/use-theme-preference'
import { useTranscriptionFlow } from '@/hooks/use-transcription-flow'

function LogoIcon({ className }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="语音转文字"
      width={48}
      height={48}
      className={className}
    />
  )
}

export default function Home() {
  const { theme, toggleTheme } = useThemePreference()
  const {
    logFilter,
    filteredLogs,
    logsContainerRef,
    setLogFilter,
    addLog,
    clearLogs,
  } = useActivityLog()
  const {
    settings,
    settingsLoaded,
    envFilePath,
    envFileExists,
    savingSettings,
    envSaveError,
    settingsLoadError,
    isDirty,
    updateSetting,
    reloadSettingsFromEnv,
    saveSettingsToEnv,
    discardLocalChanges,
  } = useSettingsState()
  const [currentTab, setCurrentTab] = useState<
    'source' | 'transcription' | 'polish' | 'settings' | 'logs'
  >('source')
  const polishFlow = usePolishFlow({ settings, addLog })
  const transcriptionFlow = useTranscriptionFlow({
    settings,
    addLog,
    clearLogs,
    onRunStarted: polishFlow.resetPolish,
  })

  const transcriptionText = getTranscriptionDisplayText(transcriptionFlow.transcriptionResult)
  const transcribedText = getTranscriptionText(transcriptionFlow.transcriptionResult)
  const polishedText = getPolishText(polishFlow.result)
  const polishedDisplayText = polishFlow.result.kind === 'error' ? polishFlow.result.message : polishedText
  const hasApiKey = settings.apiKey.trim().length > 0
  const canTranscribe = !!transcriptionFlow.audioInfo && hasApiKey && !transcriptionFlow.loading
  const canPolish = canPolishTranscription(transcriptionFlow.transcriptionResult) && !polishFlow.polishing
  const showIndeterminateProgress =
    (transcriptionFlow.status === 'processing' && transcriptionFlow.uploadProgress === 0) ||
    transcriptionFlow.status === 'transcribing'

  useEffect(() => {
    if (polishedText && !polishFlow.polishing) {
      setCurrentTab('polish')
    }
  }, [polishFlow.polishing, polishedText])

  const logColors = {
    info: 'text-muted-foreground',
    success: 'text-emerald-600 dark:text-emerald-400',
    error: 'text-destructive',
    warning: 'text-amber-600 dark:text-amber-400',
  }

  const mainTabs = [
    { id: 'source' as const, label: '音频来源' },
    { id: 'transcription' as const, label: '转录结果' },
    { id: 'polish' as const, label: '润色输出' },
    { id: 'settings' as const, label: '设置' },
    { id: 'logs' as const, label: '日志' },
  ]

  return (
    <main className="min-h-screen bg-background">
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={toggleTheme}
          className="w-9 h-9 rounded-lg bg-card border border-border hover:bg-muted flex items-center justify-center cursor-pointer transition-colors"
          aria-label={theme === 'light' ? '切换到暗色模式' : '切换到亮色模式'}
        >
          {theme === 'light' ? (
            <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          )}
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <div className="mb-4 flex justify-center">
            <LogoIcon className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-1">ASMR Transformer</h1>
          <p className="text-sm text-muted-foreground">语音转文字工具</p>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="border-b border-border">
            <div className="flex" role="tablist" aria-label="主导航">
              {mainTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setCurrentTab(tab.id)}
                  role="tab"
                  aria-selected={currentTab === tab.id}
                  aria-controls={`tabpanel-${tab.id}`}
                  id={`tab-${tab.id}`}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors cursor-pointer relative ${
                    currentTab === tab.id
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                  {currentTab === tab.id && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2/3 h-0.5 bg-primary rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5">
            {currentTab === 'source' && (
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
                    role="button"
                    tabIndex={0}
                    className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
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
            )}

            {currentTab === 'transcription' && (
              <div role="tabpanel" id="tabpanel-transcription" aria-labelledby="tab-transcription" className="space-y-4 animate-fade-in">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void polishFlow.polishText(transcribedText)}
                    disabled={!canPolish}
                    className="px-4 py-2 min-h-[40px] bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium cursor-pointer transition-colors"
                  >
                    {polishFlow.polishing ? '润色中...' : '开始润色'}
                  </button>
                  <button
                    onClick={() => void transcriptionFlow.copyTranscription()}
                    disabled={!transcriptionText}
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
                  {transcriptionText || <span className="text-muted-foreground">暂无转录结果，请先在「来源」页上传或导入音频...</span>}
                </div>

                {transcriptionFlow.transcriptionResult.kind === 'success' && (
                  <p className="text-xs text-muted-foreground">
                    {transcribedText.length} 字符
                  </p>
                )}
              </div>
            )}

            {currentTab === 'polish' && (
              <div role="tabpanel" id="tabpanel-polish" aria-labelledby="tab-polish" className="space-y-4 animate-fade-in">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void polishFlow.polishText(transcribedText)}
                    disabled={!canPolish}
                    className="px-4 py-2 min-h-[40px] bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium cursor-pointer transition-colors"
                  >
                    {polishFlow.polishing ? '润色中...' : '重新润色'}
                  </button>
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
            )}

            {currentTab === 'settings' && (
              <div role="tabpanel" id="tabpanel-settings" aria-labelledby="tab-settings" className="space-y-5 animate-fade-in">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`text-xs font-medium ${
                        savingSettings
                          ? 'text-amber-600 dark:text-amber-400'
                          : envSaveError
                            ? 'text-destructive'
                            : isDirty
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {savingSettings ? '保存中...' : envSaveError ? '保存失败' : isDirty ? '未保存' : '已保存'}
                    </div>
                    <div className="flex-1" />
                    <button
                      onClick={() => void reloadSettingsFromEnv(false)}
                      disabled={savingSettings}
                      className="px-3 py-1 min-h-[32px] bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-xs font-medium cursor-pointer transition-colors"
                    >
                      重新加载
                    </button>
                    <button
                      onClick={discardLocalChanges}
                      disabled={savingSettings || !isDirty}
                      className="px-3 py-1 min-h-[32px] bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-xs font-medium cursor-pointer transition-colors"
                    >
                      放弃改动
                    </button>
                    <button
                      onClick={() => void saveSettingsToEnv()}
                      disabled={!settingsLoaded || savingSettings || !isDirty}
                      className="px-3 py-1 min-h-[32px] bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-xs font-medium cursor-pointer transition-colors"
                    >
                      保存
                    </button>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    配置文件: {envFilePath || '.env'}
                    {!envFileExists && (
                      <span className="ml-2 text-amber-600 dark:text-amber-400">（尚未创建）</span>
                    )}
                  </div>

                  {settingsLoadError && <div className="text-xs text-destructive">{settingsLoadError}</div>}
                  {envSaveError && <div className="text-xs text-destructive">保存失败: {envSaveError}</div>}
                  {isDirty && (
                    <div className="text-xs text-amber-600 dark:text-amber-400">
                      点击「保存」写入.env 或点击「放弃改动」撤销本地修改。
                    </div>
                  )}
                </div>

                <div>
                  <h2 className="text-sm font-medium text-foreground mb-3">
                    语音识别配置 (ASR)
                    <a href="https://siliconflow.cn" target="_blank" rel="noopener noreferrer" className="ml-2 text-xs text-primary hover:underline font-normal">SiliconFlow 官网 ↗</a>
                  </h2>
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <div className="flex-[6]">
                        <label htmlFor="asr-api-url" className="block text-xs font-medium text-muted-foreground mb-1">API URL</label>
                        <input
                          id="asr-api-url"
                          type="text"
                          value={settings.apiUrl}
                          onChange={(e) => updateSetting('apiUrl', e.target.value)}
                          className="w-full px-3 py-2 bg-transparent rounded-lg border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary transition-colors"
                        />
                      </div>
                      <div className="flex-[4]">
                        <label htmlFor="asr-model" className="block text-xs font-medium text-muted-foreground mb-1">模型</label>
                        <input
                          id="asr-model"
                          type="text"
                          value={settings.model}
                          onChange={(e) => updateSetting('model', e.target.value)}
                          className="w-full px-3 py-2 bg-transparent rounded-lg border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary transition-colors"
                        />
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="flex-[6]">
                        <label htmlFor="asr-api-key" className="block text-xs font-medium text-muted-foreground mb-1">API Key</label>
                        <input
                          id="asr-api-key"
                          type="password"
                          placeholder="硅基流动 API Key（必填）"
                          value={settings.apiKey}
                          onChange={(e) => updateSetting('apiKey', e.target.value)}
                          className="w-full px-3 py-2 bg-transparent rounded-lg border border-border text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary transition-colors"
                        />
                      </div>
                      <div className="flex-[4]" />
                    </div>
                  </div>
                </div>

                <div>
                  <h2 className="text-sm font-medium text-foreground mb-3">
                    文本润色配置 (LLM · OpenAI 兼容)
                    <a href="https://juya.owl.ci" target="_blank" rel="noopener noreferrer" className="ml-2 text-xs text-primary hover:underline font-normal">juya.owl.ci ↗</a>
                  </h2>
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <div className="flex-[6]">
                        <label htmlFor="llm-api-url" className="block text-xs font-medium text-muted-foreground mb-1">API URL</label>
                        <input
                          id="llm-api-url"
                          type="text"
                          value={settings.llmApiUrl}
                          onChange={(e) => updateSetting('llmApiUrl', e.target.value)}
                          className="w-full px-3 py-2 bg-transparent rounded-lg border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary transition-colors"
                        />
                      </div>
                      <div className="flex-[4]">
                        <label htmlFor="llm-model" className="block text-xs font-medium text-muted-foreground mb-1">模型</label>
                        <input
                          id="llm-model"
                          type="text"
                          value={settings.llmModel}
                          onChange={(e) => updateSetting('llmModel', e.target.value)}
                          className="w-full px-3 py-2 bg-transparent rounded-lg border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary transition-colors"
                        />
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="flex-[6]">
                        <label htmlFor="llm-api-key" className="block text-xs font-medium text-muted-foreground mb-1">API Key</label>
                        <input
                          id="llm-api-key"
                          type="password"
                          placeholder="LLM API Key"
                          value={settings.llmApiKey}
                          onChange={(e) => updateSetting('llmApiKey', e.target.value)}
                          className="w-full px-3 py-2 bg-transparent rounded-lg border border-border text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary transition-colors"
                        />
                      </div>
                      <div className="flex-[4]" />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label htmlFor="custom-instructions" className="block text-xs font-medium text-muted-foreground">润色指令</label>
                        <button
                          onClick={() => updateSetting('customInstructions', DEFAULT_SETTINGS.customInstructions)}
                          className="text-xs text-primary hover:text-primary/80 font-medium cursor-pointer transition-colors"
                          aria-label="恢复默认润色指令"
                        >
                          恢复默认
                        </button>
                      </div>
                      <textarea
                        id="custom-instructions"
                        placeholder="自定义润色指令..."
                        value={settings.customInstructions}
                        onChange={(e) => updateSetting('customInstructions', e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 bg-transparent rounded-lg border border-border text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary transition-colors resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentTab === 'logs' && (
              <div role="tabpanel" id="tabpanel-logs" aria-labelledby="tab-logs" className="space-y-4 animate-fade-in">
                <div className="flex items-center gap-2" role="group" aria-label="日志筛选">
                  {(['all', 'error', 'success', 'info'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setLogFilter(filter)}
                      aria-pressed={logFilter === filter}
                      className={`px-3 py-1 min-h-[32px] rounded-full text-xs font-medium cursor-pointer transition-colors ${
                        logFilter === filter
                          ? 'bg-foreground text-background'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {filter === 'all' ? '全部' : filter === 'error' ? '错误' : filter === 'success' ? '成功' : '信息'}
                    </button>
                  ))}
                  <div className="flex-1" />
                  <button
                    onClick={clearLogs}
                    className="text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                    aria-label="清空日志"
                  >
                    清空
                  </button>
                </div>

                <div
                  ref={logsContainerRef}
                  className="h-64 overflow-y-auto overflow-x-hidden p-3 bg-muted/30 rounded-lg border border-border font-mono text-xs space-y-1"
                >
                  {filteredLogs.length === 0 ? (
                    <span className="text-muted-foreground">暂无日志...</span>
                  ) : (
                    filteredLogs.map((log, index) => (
                      <div key={index} className={`${logColors[log.type]} animate-slide-in break-all`}>
                        <span className="text-muted-foreground/60">[{log.time}]</span> {log.message}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <footer className="text-center py-6 mt-6">
          <p className="text-xs text-muted-foreground">
            Powered by{' '}
            <a href="https://siliconflow.cn" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">SiliconFlow</a>
            {' & '}
            <a href="https://www.asmrgay.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">ASMR-Gay</a>
          </p>
        </footer>
      </div>
    </main>
  )
}