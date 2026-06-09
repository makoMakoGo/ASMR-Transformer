import { formatFileSize } from '@/lib/file-size'
import { readJsonResponse, readResponseErrorMessage } from '@/lib/http-response'

export type RemoteAudioFetchEvent =
  | {
      type: 'download-start'
      fileName: string
      totalBytes: number | null
    }
  | {
      type: 'download-progress'
      receivedBytes: number
      totalBytes: number | null
      percent: number | null
    }
  | {
      type: 'download-complete'
      receivedBytes: number
    }

export type FetchRemoteAudioForAsrOptions = {
  fetchFn?: typeof fetch
  maxAudioBytes: number
  onProgress?: (event: RemoteAudioFetchEvent) => void
}

type ProxyErrorResponse = {
  error?: string
}

const PROXY_AUDIO_ENDPOINT = '/api/proxy-audio'
const DEFAULT_REMOTE_AUDIO_FILE_NAME = '在线音频.mp3'
const DEFAULT_REMOTE_AUDIO_MIME_TYPE = 'audio/mpeg'

const decodeProxyFileName = (value: string | null): string => {
  if (!value) return DEFAULT_REMOTE_AUDIO_FILE_NAME

  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const parseContentLength = (value: string | null): number | null => {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

const buildClientSizeErrorMessage = (size: number, maxAudioBytes: number): string =>
  `文件过大 (${formatFileSize(size)})，为避免浏览器崩溃已中止。最大支持 ${formatFileSize(maxAudioBytes)}。`

const assertProxyAudioResponse = async (response: Response): Promise<void> => {
  const contentType = response.headers.get('content-type') || ''
  if (response.ok && !contentType.includes('application/json')) return

  const { data } = await readJsonResponse<ProxyErrorResponse>(response)
  throw new Error(readResponseErrorMessage(response, data))
}

export const fetchRemoteAudioForAsr = async (
  url: string,
  {
    fetchFn = fetch,
    maxAudioBytes,
    onProgress,
  }: FetchRemoteAudioForAsrOptions
): Promise<File> => {
  const response = await fetchFn(PROXY_AUDIO_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })

  await assertProxyAudioResponse(response)

  const totalBytes = parseContentLength(response.headers.get('content-length'))
  const fileName = decodeProxyFileName(response.headers.get('x-file-name'))
  const mimeType = response.headers.get('content-type') || DEFAULT_REMOTE_AUDIO_MIME_TYPE

  if (totalBytes !== null && totalBytes > maxAudioBytes) {
    throw new Error(buildClientSizeErrorMessage(totalBytes, maxAudioBytes))
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('无法读取音频数据流')
  }

  onProgress?.({
    type: 'download-start',
    fileName,
    totalBytes,
  })

  const chunks: ArrayBuffer[] = []
  let receivedBytes = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue

    chunks.push(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength))
    receivedBytes += value.byteLength

    if (receivedBytes > maxAudioBytes) {
      await reader.cancel()
      throw new Error(buildClientSizeErrorMessage(receivedBytes, maxAudioBytes))
    }

    onProgress?.({
      type: 'download-progress',
      receivedBytes,
      totalBytes,
      percent: totalBytes === null ? null : Math.round((receivedBytes / totalBytes) * 100),
    })
  }

  onProgress?.({
    type: 'download-complete',
    receivedBytes,
  })

  return new File([new Blob(chunks, { type: mimeType })], fileName, { type: mimeType })
}
