import type { useActivityLog } from '@/hooks/use-activity-log'

type ActivityLog = ReturnType<typeof useActivityLog>

const logColors = {
  info: 'text-muted-foreground',
  success: 'text-emerald-600 dark:text-emerald-400',
  error: 'text-destructive',
  warning: 'text-amber-600 dark:text-amber-400',
}

export function LogsTab({
  logFilter,
  filteredLogs,
  logsContainerRef,
  setLogFilter,
  clearLogs,
}: Pick<ActivityLog, 'logFilter' | 'filteredLogs' | 'logsContainerRef' | 'setLogFilter' | 'clearLogs'>) {
  return (
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
          filteredLogs.map((log) => (
            <div key={log.id} className={`${logColors[log.type]} animate-slide-in break-all`}>
              <span className="text-muted-foreground/60">[{log.time}]</span> {log.message}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
