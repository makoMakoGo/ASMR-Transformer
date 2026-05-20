import type { ReactElement } from 'react'
import { DEFAULT_SETTINGS } from '@/lib/app-settings'
import type { useSettingsState } from '@/hooks/use-settings-state'

type SettingsTabProps = Pick<
  ReturnType<typeof useSettingsState>,
  | 'settings'
  | 'settingsLoaded'
  | 'envFilePath'
  | 'envFileExists'
  | 'savingSettings'
  | 'envSaveError'
  | 'settingsLoadError'
  | 'isDirty'
  | 'updateSetting'
  | 'reloadSettingsFromEnv'
  | 'saveSettingsToEnv'
  | 'discardLocalChanges'
>

export function SettingsTab({
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
}: SettingsTabProps): ReactElement {
  return (
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
  )
}
