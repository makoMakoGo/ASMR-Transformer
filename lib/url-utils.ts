const AUDIO_EXTENSIONS = ['mp3', 'wav', 'm4a', 'flac', 'ogg', 'webm', 'aac', 'wma']
const ALLOWED_AUDIO_HOSTS: Array<{ host: string; allowSubdomains: boolean }> = [
  { host: 'asmrgay.com', allowSubdomains: true },
  { host: 'asmr.pw', allowSubdomains: true },
  { host: 'asmr.loan', allowSubdomains: true },
  { host: 'asmr.party', allowSubdomains: true },
  { host: 'asmr.stream', allowSubdomains: true },
  { host: 'asmr.121231234.xyz', allowSubdomains: false },
]

const MIME_MAP: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  webm: 'audio/webm',
  aac: 'audio/aac',
  wma: 'audio/x-ms-wma',
}

const MIME_TO_EXTENSION: Record<string, string> = Object.entries(MIME_MAP).reduce(
  (acc, [ext, mime]) => {
    acc[mime] = ext
    return acc
  },
  {} as Record<string, string>
)

export const allowedAudioExtensions = AUDIO_EXTENSIONS

export const isAllowedAudioHost = (host: string): boolean => {
  const h = host.trim().toLowerCase()
  if (!h) return false
  return ALLOWED_AUDIO_HOSTS.some(({ host: allowed, allowSubdomains }) =>
    allowSubdomains ? h === allowed || h.endsWith(`.${allowed}`) : h === allowed
  )
}

const parseIpv4 = (host: string): [number, number, number, number] | null => {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return null
  const parts = host.split('.').map((p) => Number(p))
  if (parts.length !== 4) return null
  if (parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null
  return parts as [number, number, number, number]
}

export const isPrivateHost = (host: string): boolean => {
  const h = host.trim().toLowerCase()
  if (!h) return true

  if (h === 'localhost' || h.endsWith('.localhost')) return true

  const ipv4 = parseIpv4(h)
  if (ipv4) {
    const [a, b] = ipv4
    if (a === 127) return true
    if (a === 10) return true
    if (a === 0) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    return false
  }

  if (!h.includes(':')) return false

  if (h === '::1' || h === '0:0:0:0:0:0:0:1') return true
  if (h.startsWith('fe80:')) return true
  if (h.startsWith('fc') || h.startsWith('fd')) return true
  if (h.startsWith('::ffff:')) {
    const mapped = h.slice('::ffff:'.length)
    return isPrivateHost(mapped)
  }

  return false
}

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

export type AudioUrlValidationError =
  | 'INVALID_URL'
  | 'UNSUPPORTED_PROTOCOL'
  | 'PRIVATE_HOST'
  | 'HOST_NOT_ALLOWED'
  | 'MISSING_AUDIO_EXTENSION'

export type AudioUrlValidationResult =
  | { ok: true; url: URL }
  | { ok: false; error: AudioUrlValidationError }

export const validateAndParseAudioUrl = (
  input: string,
  options: { requireAudioExtension?: boolean } = {}
): AudioUrlValidationResult => {
  const url = getUrlObject(input)
  if (!url) return { ok: false, error: 'INVALID_URL' }

  if (!['http:', 'https:'].includes(url.protocol)) {
    return { ok: false, error: 'UNSUPPORTED_PROTOCOL' }
  }

  if (isPrivateHost(url.hostname)) {
    return { ok: false, error: 'PRIVATE_HOST' }
  }

  if (!isAllowedAudioHost(url.hostname)) {
    return { ok: false, error: 'HOST_NOT_ALLOWED' }
  }

  if (options.requireAudioExtension) {
    const ext = getExtensionFromUrl(input)
    if (!ext || !allowedAudioExtensions.includes(ext)) {
      return { ok: false, error: 'MISSING_AUDIO_EXTENSION' }
    }
  }

  return { ok: true, url }
}

export const isValidAudioUrl = (input: string): boolean => {
  const url = getUrlObject(input)
  if (!url) return false

  if (!['http:', 'https:'].includes(url.protocol)) return false

  if (!isAllowedAudioHost(url.hostname)) return false

  const ext = getExtensionFromUrl(input)

  if (ext) {
    return AUDIO_EXTENSIONS.includes(ext)
  }

  return false
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
