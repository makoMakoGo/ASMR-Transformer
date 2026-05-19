'use client'

import { useEffect, useRef, useState } from 'react'
import { normalizeSettingsForStorage, type Settings } from '@/lib/app-settings'
import { readJsonResponse, readResponseErrorMessage } from '@/lib/http-response'
import { consumePolishStream, getPolishCompletionLog } from '@/lib/polish-stream'
import {
  getPolishText,
  hasPolishText,
  IDLE_POLISH_RESULT,
  type PolishResult,
} from '@/lib/transcription-state'
import type { AddLog } from '@/hooks/use-activity-log'

type PolishErrorResponse = {
  error?: string
}

export const usePolishFlow = ({
  settings,
  addLog,
}: {
  settings: Settings
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

    const effectiveSettings = normalizeSettingsForStorage(settings)
    setCopied(false)
    setResult({ kind: 'streaming', text: '' })

    addLog('开始文本润色...', 'info')
    addLog(`LLM API: ${effectiveSettings.llmApiUrl}`, 'info')
    addLog(`LLM 模型: ${effectiveSettings.llmModel}`, 'info')
    if (!effectiveSettings.llmApiKey) {
      addLog('未填写 LLM API Key，将尝试无鉴权请求（若服务需要 Key 会失败）', 'warning')
    }

    try {
      const res = await fetch('/api/polish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          text,
          apiUrl: effectiveSettings.llmApiUrl,
          apiKey: effectiveSettings.llmApiKey || undefined,
          model: effectiveSettings.llmModel,
          customInstructions: effectiveSettings.customInstructions,
        }),
      })

      const contentType = res.headers.get('content-type') || ''
      if (!res.ok || contentType.includes('application/json')) {
        const { data } = await readJsonResponse<PolishErrorResponse>(res)
        const errorMessage = readResponseErrorMessage(res, data)
        setResult({ kind: 'error', message: errorMessage })
        addLog(`润色失败: ${errorMessage}`, 'error')
        return
      }

      if (!res.body) {
        setResult({ kind: 'error', message: '无响应数据' })
        addLog('润色失败: 无响应数据', 'error')
        return
      }

      const streamResult = await consumePolishStream(res.body, {
        onContent: ({ text: nextText }) => setResult({ kind: 'streaming', text: nextText }),
        onWarning: ({ message, chunk }) => {
          addLog(`润色响应单块解析失败，已跳过: ${message}; chunk=${chunk}`, 'warning')
        },
      })
      const completionLog = getPolishCompletionLog(streamResult)
      setResult({ kind: 'success', text: streamResult.text })
      addLog(completionLog.message, completionLog.type)
    } catch (e) {
      if (controller.signal.aborted) {
        addLog('润色已取消', 'info')
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
