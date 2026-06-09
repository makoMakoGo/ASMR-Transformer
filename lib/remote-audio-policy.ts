export type RemoteAudioHostRule = {
  host: string
  allowSubdomains: boolean
}

export const ALIST_PAGE_HOSTS = [
  'asmrgay.com',
  'asmr.pw',
  'asmr.loan',
  'asmr.party',
  'asmr.stream',
] as const

export const REMOTE_AUDIO_DOWNLOAD_HOST_RULES: readonly RemoteAudioHostRule[] = [
  { host: 'asmr.121231234.xyz', allowSubdomains: false },
]

export const REMOTE_AUDIO_HOST_RULES: readonly RemoteAudioHostRule[] = [
  ...ALIST_PAGE_HOSTS.map((host) => ({ host, allowSubdomains: true })),
  ...REMOTE_AUDIO_DOWNLOAD_HOST_RULES,
]

export const REMOTE_AUDIO_EXTENSIONS: readonly string[] = [
  'mp3',
  'wav',
  'm4a',
  'flac',
  'ogg',
  'webm',
  'aac',
]

export const REMOTE_AUDIO_MIME_TYPES: Readonly<Record<string, string>> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  webm: 'audio/webm',
  aac: 'audio/aac',
}

const hostMatchesRule = (host: string, rule: RemoteAudioHostRule): boolean =>
  rule.allowSubdomains
    ? host === rule.host || host.endsWith(`.${rule.host}`)
    : host === rule.host

const normalizeHost = (host: string): string => host.trim().toLowerCase()

export const isAlistPageHost = (host: string): boolean => {
  const normalizedHost = normalizeHost(host)
  if (!normalizedHost) return false

  return ALIST_PAGE_HOSTS.some((alistHost) =>
    hostMatchesRule(normalizedHost, { host: alistHost, allowSubdomains: true })
  )
}

export const isAllowedRemoteAudioHost = (host: string): boolean => {
  const normalizedHost = normalizeHost(host)
  if (!normalizedHost) return false

  return REMOTE_AUDIO_HOST_RULES.some((rule) => hostMatchesRule(normalizedHost, rule))
}

export const getRemoteAudioMimeType = (extension: string): string | null => {
  const normalizedExtension = extension.replace('.', '').toLowerCase()
  return REMOTE_AUDIO_MIME_TYPES[normalizedExtension] || null
}
