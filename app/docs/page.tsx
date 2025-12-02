'use client'

import { useState, useEffect } from 'react'

// 简单的 Markdown 渲染（支持基本语法）
function renderMarkdown(md: string): string {
  let html = md
    // 代码块
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="code-block"><code>$2</code></pre>')
    // 行内代码
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    // 标题
    .replace(/^### (.+)$/gm, '<h3 class="doc-h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="doc-h2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="doc-h1">$1</h1>')
    // 粗体
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // 分隔线
    .replace(/^---$/gm, '<hr class="doc-hr" />')
    // 引用块
    .replace(/^> (.+)$/gm, '<blockquote class="doc-quote">$1</blockquote>')
    // 表格处理
    .replace(/\|(.+)\|/g, (match) => {
      const cells = match.split('|').filter(c => c.trim())
      if (cells.some(c => /^[-:]+$/.test(c.trim()))) return ''
      const tag = 'td'
      return `<tr>${cells.map(c => `<${tag} class="doc-cell">${c.trim()}</${tag}>`).join('')}</tr>`
    })
    // 链接
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="doc-link" target="_blank">$1</a>')
    // 列表
    .replace(/^\d+\. (.+)$/gm, '<li class="doc-li">$1</li>')
    .replace(/^- (.+)$/gm, '<li class="doc-li">$1</li>')
    // 段落
    .replace(/\n\n/g, '</p><p class="doc-p">')

  return `<p class="doc-p">${html}</p>`
}

export default function DocsPage() {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/docs')
      .then(res => res.text())
      .then(md => {
        setContent(md)
        setLoading(false)
      })
      .catch(() => {
        setContent('# 文档加载失败\n\n请确保服务正常运行。')
        setLoading(false)
      })
  }, [])

  const htmlContent = renderMarkdown(content)

  return (
    <main className="min-h-screen bg-[#F2F2F7]">
      <header className="glass sticky top-0 z-50 border-b border-black/5">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#34C759] to-[#007AFF] flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-[#1D1D1F]">API 文档</h1>
              <p className="text-xs text-[#8E8E93]">Documentation</p>
            </div>
          </div>
          <div className="flex gap-2">
            <a href="/api/docs" className="px-4 py-2 bg-[#34C759] text-white rounded-lg text-sm font-medium hover:bg-[#2DB84E]">
              Raw MD
            </a>
            <a href="/api/docs?format=json" className="px-4 py-2 bg-[#FF9500] text-white rounded-lg text-sm font-medium hover:bg-[#E68600]">
              JSON
            </a>
            <a href="/" className="px-4 py-2 bg-[#007AFF] text-white rounded-lg text-sm font-medium hover:bg-[#0066CC]">
              首页
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {loading ? (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center text-gray-500">加载中...</div>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg p-8 doc-content"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        )}
      </div>

      <style>{`
        .doc-content { line-height: 1.7; color: #1D1D1F; }
        .doc-h1 { font-size: 1.75rem; font-weight: 700; margin: 1.5rem 0 1rem; color: #1D1D1F; }
        .doc-h2 { font-size: 1.35rem; font-weight: 600; margin: 2rem 0 0.75rem; padding-top: 1rem; border-top: 1px solid #E5E5EA; color: #1D1D1F; }
        .doc-h3 { font-size: 1.1rem; font-weight: 600; margin: 1.25rem 0 0.5rem; color: #636366; }
        .doc-p { margin: 0.75rem 0; color: #636366; }
        .doc-hr { border: none; border-top: 1px solid #E5E5EA; margin: 1.5rem 0; }
        .doc-quote { background: #FFF9E6; border-left: 4px solid #FF9500; padding: 0.75rem 1rem; margin: 1rem 0; border-radius: 0 0.5rem 0.5rem 0; color: #8B6914; }
        .doc-link { color: #007AFF; text-decoration: none; }
        .doc-link:hover { text-decoration: underline; }
        .doc-li { margin: 0.25rem 0 0.25rem 1.5rem; list-style: disc; color: #636366; }
        .doc-cell { padding: 0.5rem 0.75rem; border: 1px solid #E5E5EA; text-align: left; font-size: 0.875rem; }
        .code-block { background: #1D1D1F; color: #34C759; padding: 1rem; border-radius: 0.75rem; overflow-x: auto; font-size: 0.8rem; margin: 1rem 0; white-space: pre-wrap; word-break: break-all; }
        .inline-code { background: #F2F2F7; color: #AF52DE; padding: 0.15rem 0.4rem; border-radius: 0.25rem; font-size: 0.85em; }
        table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
      `}</style>
    </main>
  )
}
