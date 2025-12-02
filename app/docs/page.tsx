'use client'

import { useState, useEffect } from 'react'

// 改进的 Markdown 渲染器
function renderMarkdown(md: string): string {
  // 先处理代码块，避免内部内容被其他规则影响
  const codeBlocks: string[] = []
  let processed = md.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const index = codeBlocks.length
    codeBlocks.push(`<pre class="code-block"><code>${escapeHtml(code.trim())}</code></pre>`)
    return `__CODE_BLOCK_${index}__`
  })

  // 处理表格
  processed = processed.replace(/\n(\|.+\|)\n(\|[-:| ]+\|)\n((?:\|.+\|\n?)+)/g, (_, header, separator, body) => {
    const headerCells = header.split('|').filter((c: string) => c.trim()).map((c: string) => 
      `<th class="doc-th">${c.trim()}</th>`
    ).join('')
    const bodyRows = body.trim().split('\n').map((row: string) => {
      const cells = row.split('|').filter((c: string) => c.trim()).map((c: string) => 
        `<td class="doc-td">${c.trim()}</td>`
      ).join('')
      return `<tr>${cells}</tr>`
    }).join('')
    return `\n<table class="doc-table"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>\n`
  })

  // 行内代码
  processed = processed.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')

  // 标题
  processed = processed.replace(/^### (.+)$/gm, '<h3 class="doc-h3">$1</h3>')
  processed = processed.replace(/^## (.+)$/gm, '<h2 class="doc-h2">$1</h2>')
  processed = processed.replace(/^# (.+)$/gm, '<h1 class="doc-h1">$1</h1>')

  // 粗体
  processed = processed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')

  // 分隔线
  processed = processed.replace(/^---$/gm, '<hr class="doc-hr" />')

  // 引用块（支持多行）
  processed = processed.replace(/^> (.+)$/gm, '<blockquote class="doc-quote">$1</blockquote>')

  // 链接
  processed = processed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="doc-link" target="_blank" rel="noopener">$1</a>')

  // 有序列表
  processed = processed.replace(/^\d+\. (.+)$/gm, '<li class="doc-li-num">$1</li>')
  
  // 无序列表
  processed = processed.replace(/^- (.+)$/gm, '<li class="doc-li">$1</li>')

  // 段落处理：连续两个换行分段
  processed = processed.split('\n\n').map(block => {
    block = block.trim()
    if (!block) return ''
    // 跳过已经是 HTML 标签的块
    if (block.startsWith('<h') || block.startsWith('<table') || block.startsWith('<pre') || 
        block.startsWith('<hr') || block.startsWith('<blockquote') || block.startsWith('<li') ||
        block.startsWith('__CODE_BLOCK_')) {
      return block
    }
    // 处理单行换行
    block = block.replace(/\n/g, '<br/>')
    return `<p class="doc-p">${block}</p>`
  }).join('\n')

  // 恢复代码块
  codeBlocks.forEach((code, index) => {
    processed = processed.replace(`__CODE_BLOCK_${index}__`, code)
  })

  return processed
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
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
          <div 
            className="bg-white rounded-2xl shadow-lg p-8 doc-content"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        )}
      </div>

      <style>{`
        .doc-content { line-height: 1.8; color: #1D1D1F; }
        .doc-h1 { font-size: 1.75rem; font-weight: 700; margin: 2rem 0 1rem; color: #1D1D1F; }
        .doc-h2 { font-size: 1.4rem; font-weight: 600; margin: 2.5rem 0 1rem; padding-top: 1.5rem; border-top: 1px solid #E5E5EA; color: #1D1D1F; }
        .doc-h3 { font-size: 1.15rem; font-weight: 600; margin: 1.5rem 0 0.75rem; color: #636366; }
        .doc-p { margin: 1rem 0; color: #636366; }
        .doc-hr { border: none; border-top: 2px solid #E5E5EA; margin: 2rem 0; }
        .doc-quote { background: #FFF9E6; border-left: 4px solid #FF9500; padding: 1rem 1.25rem; margin: 1.25rem 0; border-radius: 0 0.5rem 0.5rem 0; color: #8B6914; font-size: 0.95rem; }
        .doc-link { color: #007AFF; text-decoration: none; }
        .doc-link:hover { text-decoration: underline; }
        .doc-li { margin: 0.5rem 0 0.5rem 1.5rem; list-style: disc; color: #636366; }
        .doc-li-num { margin: 0.5rem 0 0.5rem 1.5rem; list-style: decimal; color: #636366; }
        .doc-table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; font-size: 0.9rem; }
        .doc-th { padding: 0.75rem 1rem; border: 1px solid #E5E5EA; background: #F9F9FB; text-align: left; font-weight: 600; color: #1D1D1F; }
        .doc-td { padding: 0.75rem 1rem; border: 1px solid #E5E5EA; text-align: left; color: #636366; }
        .code-block { background: #1D1D1F; color: #34C759; padding: 1.25rem; border-radius: 0.75rem; overflow-x: auto; font-size: 0.85rem; margin: 1.25rem 0; white-space: pre; font-family: 'SF Mono', Monaco, 'Courier New', monospace; }
        .inline-code { background: #F2F2F7; color: #AF52DE; padding: 0.2rem 0.5rem; border-radius: 0.25rem; font-size: 0.9em; font-family: 'SF Mono', Monaco, 'Courier New', monospace; }
      `}</style>
    </main>
  )
}
