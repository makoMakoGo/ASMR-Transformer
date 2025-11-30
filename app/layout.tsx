import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '语音转文字',
  description: '使用 TeleAI/TeleSpeechASR 模型进行语音识别',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  )
}
