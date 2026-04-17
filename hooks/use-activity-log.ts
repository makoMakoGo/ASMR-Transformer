'use client'

import { useCallback, useMemo, useRef, useState } from 'react'

export type LogEntry = {
  time: string
  message: string
  type: 'info' | 'success' | 'error' | 'warning'
}

export type AddLog = (message: string, type?: LogEntry['type']) => void

export const useActivityLog = () => {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logFilter, setLogFilter] = useState<'all' | 'error' | 'success' | 'info'>('all')
  const logsContainerRef = useRef<HTMLDivElement>(null)

  const addLog = useCallback<AddLog>((message, type = 'info') => {
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    setLogs((prev) => [...prev, { time, message, type }])

    // The delayed scroll keeps the log view aligned with React's async paint.
    setTimeout(() => {
      if (logsContainerRef.current) {
        logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight
      }
    }, 100)
  }, [])

  const clearLogs = useCallback(() => setLogs([]), [])

  const filteredLogs = useMemo(
    () => (logFilter === 'all' ? logs : logs.filter((log) => log.type === logFilter)),
    [logFilter, logs]
  )

  return {
    logs,
    logFilter,
    filteredLogs,
    logsContainerRef,
    setLogFilter,
    addLog,
    clearLogs,
  }
}
