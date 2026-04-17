'use client'

import { useEffect, useRef, useState } from 'react'
import { DEFAULT_SETTINGS, areSettingsEqual, type Settings } from '@/lib/app-settings'
import { readJsonResponse, readResponseErrorMessage } from '@/lib/http-response'

type SettingsResponse = {
  success?: boolean
  settings?: Settings
  error?: string
  envFile?: {
    path?: string
    exists?: boolean
  }
}

export const useSettingsState = () => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [envFilePath, setEnvFilePath] = useState('')
  const [envFileExists, setEnvFileExists] = useState(false)
  const savedSettingsRef = useRef<Settings | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const savingSettingsRef = useRef(false)
  const [envSaveError, setEnvSaveError] = useState('')
  const [settingsLoadError, setSettingsLoadError] = useState('')
  const settingsInitRef = useRef(false)

  const isDirty = !!savedSettingsRef.current && !areSettingsEqual(savedSettingsRef.current, settings)

  const applyServerSettings = (payload: SettingsResponse | null): boolean => {
    if (!payload?.success || !payload.settings) return false

    setSettings(payload.settings)
    savedSettingsRef.current = payload.settings
    if (payload.envFile?.path) setEnvFilePath(String(payload.envFile.path))
    setEnvFileExists(Boolean(payload.envFile?.exists))
    return true
  }

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    if (envSaveError) setEnvSaveError('')
  }

  const reloadSettingsFromEnv = async (force = false) => {
    if (!force && isDirty) {
      const ok = window.confirm('当前修改尚未保存，重新加载会覆盖本地改动。确定要继续吗？')
      if (!ok) return false
    }

    setSettingsLoadError('')
    setEnvSaveError('')

    try {
      const res = await fetch('/api/settings', { method: 'GET' })
      const { data } = await readJsonResponse<SettingsResponse>(res)
      if (!res.ok || !applyServerSettings(data)) {
        throw new Error(readResponseErrorMessage(res, data))
      }
      return true
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setSettingsLoadError(`加载 .env 设置失败: ${msg}`)
      return false
    }
  }

  const saveSettingsToEnv = async () => {
    if (!isDirty) return false
    if (savingSettingsRef.current) return false

    savingSettingsRef.current = true
    setSavingSettings(true)
    setEnvSaveError('')

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const { data } = await readJsonResponse<SettingsResponse>(res)
      if (!res.ok || !applyServerSettings(data)) {
        throw new Error(readResponseErrorMessage(res, data))
      }
      return true
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setEnvSaveError(msg)
      return false
    } finally {
      savingSettingsRef.current = false
      setSavingSettings(false)
    }
  }

  const discardLocalChanges = () => {
    if (!savedSettingsRef.current || !isDirty) return

    const ok = window.confirm('放弃未保存的修改并恢复到上次保存/加载的值？')
    if (!ok) return

    setSettings(savedSettingsRef.current)
    setSettingsLoadError('')
    setEnvSaveError('')
  }

  useEffect(() => {
    if (settingsInitRef.current) return
    settingsInitRef.current = true

    void (async () => {
      const loaded = await reloadSettingsFromEnv(true)
      if (!loaded && !savedSettingsRef.current) {
        savedSettingsRef.current = DEFAULT_SETTINGS
        setSettings(DEFAULT_SETTINGS)
        setEnvFileExists(false)
      }
      setSettingsLoaded(true)
    })()
  }, [])

  return {
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
  }
}
