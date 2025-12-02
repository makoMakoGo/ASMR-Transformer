'use client'

import { useState, useEffect } from 'react'
import MarkdownPreview from '@uiw/react-markdown-preview'

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
          <div className="bg-white rounded-2xl shadow-lg p-8 overflow-hidden">
            <MarkdownPreview 
              source={content} 
              style={{ 
                backgroundColor: 'transparent',
                padding: 0,
              }}
              wrapperElement={{
                'data-color-mode': 'light'
              }}
            />
          </div>
        )}
      </div>
    </main>
  )
}
