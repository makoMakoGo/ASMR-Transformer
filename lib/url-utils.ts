const AUDIO_EXTENSIONS = ['mp3', 'wav', 'm4a', 'flac', 'ogg', 'webm', 'aac']
const TRUSTED_HOSTS = [
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
  'asmr.121231234.xyz',
]

const MIME_MAP: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  webm: 'audio/webm',
  aac: 'audio/aac',
}

const MIME_TO_EXTENSION: Record<string, string> = Object.entries(MIME_MAP).reduce(
  (acc, [ext, mime]) => {
    acc[mime] = ext
    return acc
  },
  {} as Record<string, string>
)

export const allowedAudioExtensions = AUDIO_EXTENSIONS

const getUrlObject = (input: string): URL | null => {
  if (!input || typeof input !== 'string') return null
  try {
    return new URL(input)
  } catch {
    return null
  }
}

export const getExtensionFromUrl = (input: string): string => {
  const url = getUrlObject(input)
  if (!url) return ''

  const pathname = url.pathname.toLowerCase()
  const lastSegment = pathname.split('/').pop() || ''
  const parts = lastSegment.split('.')
  if (parts.length < 2) return ''
  return parts.pop() || ''
}

export const isValidAudioUrl = (input: string): boolean => {
  const url = getUrlObject(input)
  if (!url) return false

  if (!['http:', 'https:'].includes(url.protocol)) return false

  const ext = getExtensionFromUrl(input)
  const hostname = url.hostname.toLowerCase()

  if (ext) {
    return AUDIO_EXTENSIONS.includes(ext)
  }

  // Allow trusted hosts even when no explicit extension is present
  return TRUSTED_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`))
}

export const extractFileName = (input: string): string => {
  const url = getUrlObject(input)
  if (!url) return 'audio-from-url'

  let pathname = url.pathname
  try {
    pathname = decodeURIComponent(url.pathname)
  } catch {
    // keep original pathname if decode fails
  }

  const segments = pathname.split('/').filter(Boolean)
  const last = segments.pop() || ''

  if (!last) return 'audio-from-url'

  const sanitized = last.split('?')[0].split('#')[0].trim()
  return sanitized || 'audio-from-url'
}

export const getAudioMimeType = (input: string): string | null => {
  const ext = input.startsWith('http') ? getExtensionFromUrl(input) : input
  const normalizedExt = ext.replace('.', '').toLowerCase()

  return MIME_MAP[normalizedExt] || null
}

export const getExtensionFromMime = (mime: string): string | null => {
  const cleanMime = mime.toLowerCase().split(';')[0].trim()
  return MIME_TO_EXTENSION[cleanMime] || null
}
