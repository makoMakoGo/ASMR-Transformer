import { isAlistPageUrl, resolveAlistUrl, type AlistFetchFn } from '@/lib/alist-utils'
import {
  allowedAudioExtensions,
  getAudioMimeType,
  type AudioUrlValidationError,
  validateAndParseAudioUrl,
} from '@/lib/url-utils'

export const DEFAULT_REMOTE_AUDIO_USER_AGENT = 'Mozilla/5.0 (ASMR-Transformer/1.0)'

export type RemoteAudioErrorCode =
  | AudioUrlValidationError
  | 'ALIST_RESOLVE_FAILED'
  | 'UNSUPPORTED_WMA'
  | 'UNSUPPORTED_AUDIO'

export class RemoteAudioError extends Error {
  readonly code: RemoteAudioErrorCode
  readonly status: number

  constructor(code: RemoteAudioErrorCode, message: string, status: number) {
    super(message)
    this.name = 'RemoteAudioError'
    this.code = code
    this.status = status
  }
}

export type ResolvedRemoteAudioSource = {
  inputUrl: string
  resolvedUrl: string
  resolvedUrlObject: URL
  isAlistPage: boolean
  fileNameHint?: string
  fileSizeHint?: number
  contentTypeHint?: string
}

export type RemoteAudioMetadata = {
  fileName: string
  fileSize: number
  contentType: string
  contentLength?: string
}

const VALIDATION_MESSAGES: Record<AudioUrlValidationError, { message: string; status: number }> = {
  INVALID_URL: { message: '无效的 URL', status: 400 },
  UNSUPPORTED_PROTOCOL: { message: '仅支持 http/https 链接', status: 400 },
  PRIVATE_HOST: { message: '不支持访问本机或内网地址', status: 400 },
  HOST_NOT_ALLOWED: { message: '音频 URL 无效或不受支持', status: 400 },
  MISSING_AUDIO_EXTENSION: { message: '音频 URL 无效或不受支持', status: 400 },
}

const toRemoteAudioValidationError = (error: AudioUrlValidationError): RemoteAudioError => {
  const detail = VALIDATION_MESSAGES[error]
  return new RemoteAudioError(error, detail.message, detail.status)
}

const assertValidRemoteAudioUrl = (
  input: string,
  options: { requireAudioExtension?: boolean } = {}
): URL => {
  const result = validateAndParseAudioUrl(input, options)
  if (!result.ok) throw toRemoteAudioValidationError(result.error)
  return result.url
}

export const resolveRemoteAudioSource = async (
  inputUrl: string,
  fetchFn: AlistFetchFn = fetch,
  userAgent = DEFAULT_REMOTE_AUDIO_USER_AGENT
): Promise<ResolvedRemoteAudioSource> => {
  const isAlistPage = isAlistPageUrl(inputUrl)
  const initialUrl = assertValidRemoteAudioUrl(inputUrl, {
    requireAudioExtension: !isAlistPage,
  })

  if (!isAlistPage) {
    return {
      inputUrl,
      resolvedUrl: inputUrl,
      resolvedUrlObject: initialUrl,
      isAlistPage: false,
    }
  }

  try {
    const resolved = await resolveAlistUrl(inputUrl, fetchFn, userAgent)
    const resolvedUrlObject = assertValidRemoteAudioUrl(resolved.rawUrl)

    return {
      inputUrl,
      resolvedUrl: resolved.rawUrl,
      resolvedUrlObject,
      isAlistPage: true,
      fileNameHint: resolved.fileName,
      fileSizeHint: resolved.fileSize,
      contentTypeHint: resolved.contentType,
    }
  } catch (error) {
    if (error instanceof RemoteAudioError) throw error
    if (error instanceof Error && error.name === 'AbortError') throw error
    if (error instanceof Error) {
      throw new RemoteAudioError('ALIST_RESOLVE_FAILED', `解析播放页面失败: ${error.message}`, 400)
    }
    throw new RemoteAudioError('ALIST_RESOLVE_FAILED', '解析播放页面失败', 400)
  }
}

const CONTENT_DISPOSITION_FILENAME_RE = /filename\*?=(?:UTF-8'')?["']?([^"';\n]+)["']?/i

const decodeFileName = (value: string): string => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export const getRemoteAudioFileName = ({
  url,
  fileNameHint,
  contentDisposition,
  fallbackName = '在线音频',
}: {
  url: URL
  fileNameHint?: string
  contentDisposition?: string | null
  fallbackName?: string
}): string => {
  if (fileNameHint?.trim()) return decodeFileName(fileNameHint.trim())

  const headerValue = contentDisposition?.trim() ?? ''
  if (headerValue) {
    const match = headerValue.match(CONTENT_DISPOSITION_FILENAME_RE)
    const headerFileName = match?.[1]?.trim()
    if (headerFileName) return decodeFileName(headerFileName)
  }

  const lastSegment = url.pathname.split('/').pop() || fallbackName
  const decoded = decodeFileName(lastSegment)
  return decoded || fallbackName
}

export const getAudioFileExtension = (fileName: string): string => {
  const normalized = fileName.trim().toLowerCase()
  const dotIndex = normalized.lastIndexOf('.')
  if (dotIndex === -1 || dotIndex === normalized.length - 1) return ''
  return normalized.slice(dotIndex + 1)
}

const parseContentLength = (contentLength: string | null | undefined): number | undefined => {
  if (!contentLength) return undefined
  const parsed = Number(contentLength)
  if (!Number.isFinite(parsed) || parsed < 0) return undefined
  return Math.trunc(parsed)
}

export const buildRemoteAudioMetadata = ({
  source,
  contentDisposition,
  contentType,
  contentLength,
  fallbackName = '在线音频',
}: {
  source: ResolvedRemoteAudioSource
  contentDisposition?: string | null
  contentType?: string | null
  contentLength?: string | null
  fallbackName?: string
}): RemoteAudioMetadata => {
  const fileName = getRemoteAudioFileName({
    url: source.resolvedUrlObject,
    fileNameHint: source.fileNameHint,
    contentDisposition,
    fallbackName,
  })
  const extension = getAudioFileExtension(fileName)
  const rawContentType = (contentType ?? source.contentTypeHint ?? '').split(';')[0].trim()
  const normalizedContentType = rawContentType.toLowerCase()

  if (extension === 'wma' || normalizedContentType === 'audio/x-ms-wma' || normalizedContentType === 'audio/wma') {
    throw new RemoteAudioError('UNSUPPORTED_WMA', '不支持 WMA 格式，请转换为 mp3/wav/m4a/flac/ogg/webm/aac', 400)
  }

  const mimeFromUrl = getAudioMimeType(source.resolvedUrl)
  const hasAllowedExtension = !!extension && allowedAudioExtensions.includes(extension)
  const isAudio =
    normalizedContentType.startsWith('audio/') ||
    normalizedContentType.includes('octet-stream') ||
    (!!mimeFromUrl && mimeFromUrl.startsWith('audio/')) ||
    hasAllowedExtension

  if (!isAudio) {
    const displayContentType = rawContentType || source.contentTypeHint || 'unknown'
    throw new RemoteAudioError('UNSUPPORTED_AUDIO', `不是音频文件 (${displayContentType})`, 400)
  }

  const parsedLength = parseContentLength(contentLength)
  const hintedSize = typeof source.fileSizeHint === 'number' && source.fileSizeHint > 0 ? source.fileSizeHint : undefined
  const fileSize = parsedLength ?? hintedSize ?? 0
  const finalContentType =
    (normalizedContentType.startsWith('audio/') && rawContentType) ||
    mimeFromUrl ||
    source.contentTypeHint ||
    'application/octet-stream'

  return {
    fileName,
    fileSize,
    contentType: finalContentType,
    contentLength: parsedLength == null ? undefined : String(parsedLength),
  }
}
