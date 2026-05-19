import { isAlistPageUrl, resolveAlistUrl, type AlistFetchFn } from '@/lib/alist-utils'
import {
  allowedAudioExtensions,
  getAudioMimeType,
  type AudioUrlValidationError,
  validateAndParseAudioUrl,
} from '@/lib/url-utils'

export const DEFAULT_REMOTE_AUDIO_USER_AGENT = 'Mozilla/5.0 (ASMR-Transformer/1.0)'
export const DEFAULT_REMOTE_AUDIO_FETCH_TIMEOUT_MS = 120_000

export type RemoteAudioErrorCode =
  | AudioUrlValidationError
  | 'ALIST_RESOLVE_FAILED'
  | 'UNSUPPORTED_WMA'
  | 'UNSUPPORTED_AUDIO'
  | 'SOURCE_HEAD_FAILED'
  | 'SOURCE_CONNECT_FAILED'
  | 'SOURCE_RESPONSE_FAILED'
  | 'SOURCE_BODY_MISSING'
  | 'AUDIO_TOO_LARGE'
  | 'REQUEST_ABORTED'
  | 'REQUEST_TIMEOUT'

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

export type RemoteAudioCheckResult = {
  source: ResolvedRemoteAudioSource
  metadata: RemoteAudioMetadata
}

export type RemoteAudioProxyResult = {
  source: ResolvedRemoteAudioSource
  metadata: RemoteAudioMetadata
  body: ReadableStream<Uint8Array>
  headers: Headers
}

export type RemoteAudioFetchFn = (url: string, init?: RequestInit) => Promise<Response>

type RemoteAudioRequestOptions = {
  fetchFn?: RemoteAudioFetchFn
  signal?: AbortSignal
  userAgent?: string
}

type ProxyRemoteAudioOptions = RemoteAudioRequestOptions & {
  maxAudioBytes: number
  timeoutMs?: number
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

export const getMaxRemoteAudioSizeMessage = (maxAudioBytes: number): string => {
  const maxMB = Math.round(maxAudioBytes / (1024 * 1024))
  return `音频文件过大，超过 ${maxMB}MB 限制`
}

const getErrorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error)

const isAbortError = (error: unknown): boolean => error instanceof Error && error.name === 'AbortError'

const buildAbortError = (signal: AbortSignal | undefined, timeoutMessage: string): RemoteAudioError => {
  if (signal?.aborted) {
    return new RemoteAudioError('REQUEST_ABORTED', '请求已取消', 499)
  }

  return new RemoteAudioError('REQUEST_TIMEOUT', timeoutMessage, 504)
}

const withUserAgent = (userAgent: string): Record<string, string> => ({
  'User-Agent': userAgent,
})

const createCombinedSignal = (timeoutController: AbortController, signal?: AbortSignal): AbortSignal => {
  if (!signal) return timeoutController.signal
  return AbortSignal.any([signal, timeoutController.signal])
}

export const checkRemoteAudio = async (
  inputUrl: string,
  options: RemoteAudioRequestOptions = {}
): Promise<RemoteAudioCheckResult> => {
  const {
    fetchFn = fetch,
    signal,
    userAgent = DEFAULT_REMOTE_AUDIO_USER_AGENT,
  } = options

  const source = await resolveRemoteAudioSource(
    inputUrl,
    (fetchUrl, init) => fetchFn(fetchUrl, { ...init, signal }),
    userAgent
  )

  let response: Response
  try {
    response = await fetchFn(source.resolvedUrl, {
      method: 'HEAD',
      signal,
      headers: withUserAgent(userAgent),
    })
  } catch (error) {
    if (isAbortError(error)) throw error
    throw new RemoteAudioError('SOURCE_HEAD_FAILED', `检查失败: ${getErrorMessage(error)}`, 500)
  }

  if (!response.ok) {
    throw new RemoteAudioError(
      'SOURCE_RESPONSE_FAILED',
      `HTTP ${response.status}: ${response.statusText}`,
      400
    )
  }

  return {
    source,
    metadata: buildRemoteAudioMetadata({
      source,
      contentLength: response.headers.get('content-length'),
      contentType: response.headers.get('content-type'),
      contentDisposition: response.headers.get('content-disposition'),
    }),
  }
}

const buildRemoteAudioProxyHeaders = (metadata: RemoteAudioMetadata): Headers => {
  const headers = new Headers({
    'Content-Type': metadata.contentType,
    'X-File-Name': encodeURIComponent(metadata.fileName),
    'Cache-Control': 'no-cache',
  })

  if (metadata.contentLength) {
    headers.set('Content-Length', metadata.contentLength)
  }

  return headers
}

const limitRemoteAudioStream = (
  body: ReadableStream<Uint8Array>,
  maxAudioBytes: number,
  signal?: AbortSignal
): ReadableStream<Uint8Array> => {
  let bytesRead = 0

  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        if (signal?.aborted) {
          controller.error(new Error('CLIENT_DISCONNECTED'))
          return
        }

        bytesRead += chunk.byteLength
        if (bytesRead > maxAudioBytes) {
          controller.error(new Error('MAX_AUDIO_BYTES_EXCEEDED'))
          return
        }

        controller.enqueue(chunk)
      },
    })
  )
}

export const proxyRemoteAudio = async (
  inputUrl: string,
  options: ProxyRemoteAudioOptions
): Promise<RemoteAudioProxyResult> => {
  const {
    fetchFn = fetch,
    maxAudioBytes,
    signal,
    timeoutMs = DEFAULT_REMOTE_AUDIO_FETCH_TIMEOUT_MS,
    userAgent = DEFAULT_REMOTE_AUDIO_USER_AGENT,
  } = options
  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs)
  const combinedSignal = createCombinedSignal(timeoutController, signal)

  try {
    let source: ResolvedRemoteAudioSource
    try {
      source = await resolveRemoteAudioSource(
        inputUrl,
        (fetchUrl, init) => fetchFn(fetchUrl, { ...init, signal: combinedSignal }),
        userAgent
      )
    } catch (error) {
      if (isAbortError(error)) {
        throw buildAbortError(signal, '解析播放页面超时')
      }
      throw error
    }

    if (typeof source.fileSizeHint === 'number' && source.fileSizeHint > maxAudioBytes) {
      throw new RemoteAudioError('AUDIO_TOO_LARGE', getMaxRemoteAudioSizeMessage(maxAudioBytes), 413)
    }

    let audioResponse: Response
    try {
      audioResponse = await fetchFn(source.resolvedUrl, {
        method: 'GET',
        redirect: 'follow',
        signal: combinedSignal,
        headers: {
          ...withUserAgent(userAgent),
          Referer: source.resolvedUrlObject.origin,
        },
      })
    } catch (error) {
      if (isAbortError(error)) {
        throw buildAbortError(signal, '连接超时，请稍后重试')
      }
      throw new RemoteAudioError('SOURCE_CONNECT_FAILED', `无法连接音频源: ${getErrorMessage(error)}`, 502)
    }

    if (!audioResponse.ok) {
      throw new RemoteAudioError(
        'SOURCE_RESPONSE_FAILED',
        `音频源返回错误 (${audioResponse.status})`,
        audioResponse.status >= 500 ? 502 : 400
      )
    }

    const metadata = buildRemoteAudioMetadata({
      source,
      contentType: audioResponse.headers.get('content-type'),
      contentDisposition: audioResponse.headers.get('content-disposition'),
      contentLength: audioResponse.headers.get('content-length'),
      fallbackName: 'audio',
    })

    if (metadata.fileSize > maxAudioBytes) {
      throw new RemoteAudioError('AUDIO_TOO_LARGE', getMaxRemoteAudioSizeMessage(maxAudioBytes), 413)
    }

    if (!audioResponse.body) {
      throw new RemoteAudioError('SOURCE_BODY_MISSING', '无法读取音频数据流', 500)
    }

    return {
      source,
      metadata,
      headers: buildRemoteAudioProxyHeaders(metadata),
      body: limitRemoteAudioStream(audioResponse.body, maxAudioBytes, signal),
    }
  } finally {
    clearTimeout(timeoutId)
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
