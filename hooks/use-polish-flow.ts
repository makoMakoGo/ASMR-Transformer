'use client'

import { useEffect, useRef, useState } from 'react'
import type { LlmRunSettings } from '@/lib/app-settings'
import { PolishRunError, runPolishText } from '@/lib/polish-run'
import {
  getPolishText,
  hasPolishText,
  IDLE_POLISH_RESULT,
  type PolishResult,
} from '@/lib/transcription-state'
import type { AddLog } from '@/hooks/use-activity-log'

export const usePolishFlow = ({
  settings,
  addLog,
}: {
  settings: LlmRunSettings
  addLog: AddLog
}) => {
  const [result, setResult] = useState<PolishResult>(IDLE_POLISH_RESULT)
  const [copied, setCopied] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const polishing = result.kind === 'streaming'

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      abortRef.current = null
    }
  }, [])

  const resetPolish = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setResult(IDLE_POLISH_RESULT)
    setCopied(false)
  }

  const polishText = async (text: string) => {
    if (!text) {
      addLog('无法润色: 缺少文本', 'error')
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setCopied(false)
    setResult({ kind: 'streaming', text: '' })

    addLog('开始文本润色...', 'info')

    try {
      const streamResult = await runPolishText(text, settings, {
        onContent: ({ text: nextText }) => setResult({ kind: 'streaming', text: nextText }),
        onLog: ({ message, type }) => addLog(message, type),
      }, { signal: controller.signal })
      setResult({ kind: 'success', text: streamResult.text })
      addLog(streamResult.completionLog.message, streamResult.completionLog.type)
    } catch (e) {
      if (controller.signal.aborted) {
        addLog('润色已取消', 'info')
        return
      }
      if (e instanceof PolishRunError) {
        setResult({ kind: 'error', message: e.message })
        addLog(`润色失败: ${e.message}`, 'error')
        return
      }
      const errorMsg = e instanceof Error ? e.message : String(e)
      setResult({ kind: 'error', message: errorMsg })
      addLog(`润色请求失败: ${errorMsg}`, 'error')
    } finally {
      if (abortRef.current === controller) abortRef.current = null
    }
  }

  const copyPolished = async () => {
    const text = getPolishText(result)
    if (!text) return

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      addLog('润色结果已复制到剪贴板', 'success')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      addLog('复制失败', 'error')
    }
  }

  return {
    result,
    copied,
    polishing,
    hasPolishText: hasPolishText(result),
    polishText,
    copyPolished,
    resetPolish,
  }
}
