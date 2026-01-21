/**
 * AList 站点检测和 URL 解析工具
 * 供 check-audio 和 proxy-audio API 共享使用
 */

// AList 站点配置（支持自动解析播放页面）
export const ALIST_SITES = [
  'asmrgay.com',
  'www.asmrgay.com',
  'asmr.pw',
  'www.asmr.pw',
  'asmr.loan',
  'www.asmr.loan',
  'asmr.party',
  'www.asmr.party',
  'asmr.stream',
  'www.asmr.stream',
]

const isAlistHost = (hostname: string): boolean =>
  ALIST_SITES.some((h) => hostname === h || hostname.endsWith(`.${h}`))

/**
 * 检测 URL 是否属于已知的 AList 站点
 */
export const isAlistSite = (url: string): boolean => {
  try {
    const parsed = new URL(url)
    return isAlistHost(parsed.hostname)
  } catch {
    return false
  }
}

/**
 * 检测是否为 AList 播放页面 URL（非 /d/ 开头的路径）
 * 播放页面需要调用 AList API 解析真实音频 URL
 */
export const isAlistPageUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url)
    if (!isAlistHost(parsed.hostname)) return false
    // 播放页面路径不以 /d/ 开头
    return !parsed.pathname.startsWith('/d/')
  } catch {
    return false
  }
}

/**
 * 检测是否为 AList 直链 URL（/d/ 开头的路径）
 */
export const isAlistDirectUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url)
    if (!isAlistHost(parsed.hostname)) return false
    return parsed.pathname.startsWith('/d/')
  } catch {
    return false
  }
}

export type AlistResolveResult = {
  rawUrl: string
  fileName: string
  fileSize: number
  contentType: string
}

export type AlistFetchFn = (url: string, init?: RequestInit) => Promise<Response>

/**
 * 调用 AList API 获取真实音频 URL 和元信息
 * @param pageUrl AList 播放页面 URL
 * @param fetchFn 可选的自定义 fetch 函数（用于支持代理）
 * @param userAgent 可选的 User-Agent
 */
export const resolveAlistUrl = async (
  pageUrl: string,
  fetchFn: AlistFetchFn = fetch,
  userAgent = 'Mozilla/5.0 (ASMR-Transformer/1.0)'
): Promise<AlistResolveResult> => {
  const parsed = new URL(pageUrl)
  const apiUrl = `${parsed.origin}/api/fs/get`
  const path = decodeURIComponent(parsed.pathname)

  const res = await fetchFn(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': userAgent,
    },
    body: JSON.stringify({ path }),
  })

  if (!res.ok) {
    throw new Error(`AList API 错误 (${res.status})`)
  }

  const data = await res.json()
  if (data.code !== 200 || !data.data?.raw_url) {
    throw new Error(data.message || '无法获取音频地址')
  }

  // 从路径提取文件名
  const pathParts = path.split('/')
  const fileName = pathParts[pathParts.length - 1] || '在线音频'

  return {
    rawUrl: data.data.raw_url,
    fileName,
    fileSize: data.data.size || 0,
    contentType: data.data.type || 'audio/mpeg',
  }
}
