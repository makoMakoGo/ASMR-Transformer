'use client'

import { useCallback, useMemo, useRef, useState } from 'react'

export type LogEntry = {
  id: number
  time: string
  message: string
  type: 'info' | 'success' | 'error' | 'warning'
}

export type AddLog = (message: string, type?: LogEntry['type']) => void
export type LogFilter = 'all' | LogEntry['type']

const MAX_LOG_ENTRIES = 200

export const useActivityLog = () => {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logFilter, setLogFilter] = useState<LogFilter>('all')
  const logsContainerRef = useRef<HTMLDivElement>(null)
  const nextLogId = useRef(0)

  const addLog = useCallback<AddLog>((message, type = 'info') => {
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    const id = nextLogId.current
    nextLogId.current += 1
    setLogs((prev) => {
      const next = [...prev, { id, time, message, type }]
      return next.length > MAX_LOG_ENTRIES ? next.slice(-MAX_LOG_ENTRIES) : next
    })

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
