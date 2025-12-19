import { NextRequest, NextResponse } from 'next/server'
import { ProxyAgent, fetch as undiciFetch } from 'undici'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { extractFileName, getExtensionFromMime } from '@/lib/url-utils'

export const runtime = 'nodejs'

const FETCH_TIMEOUT_MS = 60_000
const MAX_AUDIO_BYTES = 50 * 1024 * 1024
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (ASMR-Transformer/1.0)'
const AUDIO_DIR = join(process.cwd(), 'audio')

const ALIST_SITES = [
  'asmrgay.com', 'www.asmrgay.com',
  'asmr.pw', 'www.asmr.pw',
  'asmr.loan', 'www.asmr.loan',
  'asmr.party', 'www.asmr.party',
  'asmr.stream', 'www.asmr.stream',
]

const fetchWithProxy = async (url: string, init?: RequestInit, proxyUrl?: string): Promise<Response> => {
  if (proxyUrl) {
    const agent = new ProxyAgent(proxyUrl)
    return undiciFetch(url, { ...init, dispatcher: agent } as Parameters<typeof undiciFetch>[1]) as unknown as Response
  }
  return fetch(url, init)
}

const isAlistPageUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url)
    const isAlistSite = ALIST_SITES.some(h => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`))
    return isAlistSite && !parsed.pathname.startsWith('/d/')
  } catch {
    return false
  }
}

const resolveAlistUrl = async (pageUrl: string, proxyUrl?: string): Promise<string> => {
  const parsed = new URL(pageUrl)
  const apiUrl = `${parsed.origin}/api/fs/get`
  const path = decodeURIComponent(parsed.pathname)

  const res = await fetchWithProxy(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': DEFAULT_USER_AGENT },
    body: JSON.stringify({ path }),
  }, proxyUrl)

  if (!res.ok) throw new Error(`AList API 错误 (${res.status})`)
  const data = await res.json()
  if (data.code !== 200 || !data.data?.raw_url) throw new Error(data.message || '无法获取音频地址')
  return data.data.raw_url
}

const sanitizeFileName = (name: string, ext?: string | null): string => {
  const base = (name || 'audio').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_')
  if (base.includes('.') || !ext) return base
  return `${base}.${ext}`
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: '请求体必须为 JSON' }, { status: 400 })
  }

  let audioUrl = String(body?.url || '').trim()
  if (!audioUrl) {
    return NextResponse.json({ success: false, error: '缺少音频 URL' }, { status: 400 })
  }

  const proxyUrl = (body?.proxyUrl as string) || ''

  // 解析 AList 播放页面
  if (isAlistPageUrl(audioUrl)) {
    try {
      audioUrl = await resolveAlistUrl(audioUrl, proxyUrl)
    } catch (error) {
      return NextResponse.json({ success: false, error: `解析播放页面失败: ${(error as Error).message}` }, { status: 400 })
    }
  }

  // 下载音频
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  let fetched: Response
  try {
    fetched = await fetchWithProxy(audioUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': DEFAULT_USER_AGENT, Referer: new URL(audioUrl).origin },
    }, proxyUrl)
  } catch (error) {
    clearTimeout(timeoutId)
    if ((error as Error).name === 'AbortError') {
      return NextResponse.json({ success: false, error: '下载超时' }, { status: 504 })
    }
    return NextResponse.json({ success: false, error: `下载失败: ${(error as Error).message}` }, { status: 502 })
  }
  clearTimeout(timeoutId)

  if (!fetched.ok) {
    return NextResponse.json({ success: false, error: `音频源返回错误 (${fetched.status})` }, { status: 400 })
  }

  const contentType = (fetched.headers.get('content-type') || '').split(';')[0].trim()
  const buffer = await fetched.arrayBuffer()

  if (buffer.byteLength > MAX_AUDIO_BYTES) {
    return NextResponse.json({ success: false, error: '文件过大' }, { status: 413 })
  }

  // 确保目录存在
  if (!existsSync(AUDIO_DIR)) {
    await mkdir(AUDIO_DIR, { recursive: true })
  }

  const ext = getExtensionFromMime(contentType)
  const fileName = sanitizeFileName(extractFileName(audioUrl), ext)
  const filePath = join(AUDIO_DIR, fileName)

  await writeFile(filePath, Buffer.from(buffer))

  return NextResponse.json({
    success: true,
    filePath,
    fileName,
    fileSize: buffer.byteLength,
    contentType,
  })
}
