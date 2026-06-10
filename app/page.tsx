'use client'

import { useEffect, useState, type ReactElement } from 'react'
import Image from 'next/image'
import {
  canPolishTranscription,
  getPolishText,
  getTranscriptionDisplayText,
  getTranscriptionText,
} from '@/lib/transcription-state'
import { hasAsrApiKey } from '@/lib/asr-transcription'
import { LogsTab } from '@/components/LogsTab'
import { PolishTab } from '@/components/PolishTab'
import { SettingsTab } from '@/components/SettingsTab'
import { SourceTab } from '@/components/SourceTab'
import { TranscriptionTab } from '@/components/TranscriptionTab'
import { useActivityLog } from '@/hooks/use-activity-log'
import { usePolishFlow } from '@/hooks/use-polish-flow'
import { useSettingsState } from '@/hooks/use-settings-state'
import { useThemePreference } from '@/hooks/use-theme-preference'
import { useTranscriptionFlow } from '@/hooks/use-transcription-flow'

type LogoIconProps = {
  className?: string
}

function LogoIcon({ className }: LogoIconProps): ReactElement {
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

const mainTabs = [
  { id: 'source' as const, label: '音频来源' },
  { id: 'transcription' as const, label: '转录结果' },
  { id: 'polish' as const, label: '润色输出' },
  { id: 'settings' as const, label: '设置' },
  { id: 'logs' as const, label: '日志' },
]

export type MainTabId = (typeof mainTabs)[number]['id']

export default function Home(): ReactElement {
  const { theme, toggleTheme } = useThemePreference()
  const activityLog = useActivityLog()
  const settingsState = useSettingsState()
  const [currentTab, setCurrentTab] = useState<MainTabId>('source')
  const polishFlow = usePolishFlow({ settings: settingsState.settings, addLog: activityLog.addLog })
  const transcriptionFlow = useTranscriptionFlow({
    settings: settingsState.settings,
    addLog: activityLog.addLog,
    clearLogs: activityLog.clearLogs,
    onRunStarted: polishFlow.resetPolish,
  })

  const transcriptionDisplayText = getTranscriptionDisplayText(transcriptionFlow.transcriptionResult)
  const transcriptionRawText = getTranscriptionText(transcriptionFlow.transcriptionResult)
  const polishedText = getPolishText(polishFlow.result)
  const polishedDisplayText = polishFlow.result.kind === 'error' ? polishFlow.result.message : polishedText
  const hasApiKey = hasAsrApiKey(settingsState.settings)
  const canPolish = canPolishTranscription(transcriptionFlow.transcriptionResult) && !polishFlow.polishing

  useEffect(() => {
    if (polishedText && !polishFlow.polishing) {
      setCurrentTab('polish')
    }
  }, [polishFlow.polishing, polishedText])

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
              <SourceTab
                fileInputRef={transcriptionFlow.fileInputRef}
                audioUrlInput={transcriptionFlow.audioUrlInput}
                checking={transcriptionFlow.checking}
                audioInfo={transcriptionFlow.audioInfo}
                loading={transcriptionFlow.loading}
                status={transcriptionFlow.status}
                uploadProgress={transcriptionFlow.uploadProgress}
                statusMessage={transcriptionFlow.statusMessage}
                onFileChange={transcriptionFlow.handleFileChange}
                onFileSelect={transcriptionFlow.handleFileSelect}
                onAudioUrlInputChange={transcriptionFlow.setAudioUrlInput}
                onCheckAudioUrl={transcriptionFlow.checkAudioUrl}
                onClearAudio={transcriptionFlow.clearAudio}
                onStartTranscribe={transcriptionFlow.startTranscribe}
                hasApiKey={hasApiKey}
              />
            )}

            {currentTab === 'transcription' && (
              <TranscriptionTab
                polishFlow={polishFlow}
                transcriptionFlow={transcriptionFlow}
                transcriptionDisplayText={transcriptionDisplayText}
                transcriptionRawText={transcriptionRawText}
                canPolish={canPolish}
              />
            )}

            {currentTab === 'polish' && (
              <PolishTab
                polishFlow={polishFlow}
                transcriptionRawText={transcriptionRawText}
                polishedText={polishedText}
                polishedDisplayText={polishedDisplayText}
                canPolish={canPolish}
              />
            )}

            {currentTab === 'settings' && (
              <SettingsTab
                settings={settingsState.settings}
                settingsLoaded={settingsState.settingsLoaded}
                envFilePath={settingsState.envFilePath}
                envFileExists={settingsState.envFileExists}
                savingSettings={settingsState.savingSettings}
                envSaveError={settingsState.envSaveError}
                settingsLoadError={settingsState.settingsLoadError}
                isDirty={settingsState.isDirty}
                updateSetting={settingsState.updateSetting}
                reloadSettingsFromEnv={settingsState.reloadSettingsFromEnv}
                saveSettingsToEnv={settingsState.saveSettingsToEnv}
                discardLocalChanges={settingsState.discardLocalChanges}
              />
            )}

            {currentTab === 'logs' && (
              <LogsTab
                logFilter={activityLog.logFilter}
                filteredLogs={activityLog.filteredLogs}
                logsContainerRef={activityLog.logsContainerRef}
                setLogFilter={activityLog.setLogFilter}
                clearLogs={activityLog.clearLogs}
              />
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
