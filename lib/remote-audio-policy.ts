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

export const ALIST_PAGE_HOST_RULES: readonly RemoteAudioHostRule[] = ALIST_PAGE_HOSTS.map((host) => ({
  host,
  allowSubdomains: true,
}))

export const REMOTE_AUDIO_HOST_RULES: readonly RemoteAudioHostRule[] = [
  ...ALIST_PAGE_HOST_RULES,
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

const hostMatchesAnyRule = (host: string, rules: readonly RemoteAudioHostRule[]): boolean => {
  const normalizedHost = normalizeHost(host)
  if (!normalizedHost) return false

  return rules.some((rule) => hostMatchesRule(normalizedHost, rule))
}

export const isAlistPageHost = (host: string): boolean => {
  return hostMatchesAnyRule(host, ALIST_PAGE_HOST_RULES)
}

export const isAllowedRemoteAudioHost = (host: string): boolean => {
  return hostMatchesAnyRule(host, REMOTE_AUDIO_HOST_RULES)
}

export const getRemoteAudioMimeType = (extension: string): string | null => {
  const normalizedExtension = extension.replace(/^\.+/, '').toLowerCase()
  return Object.prototype.hasOwnProperty.call(REMOTE_AUDIO_MIME_TYPES, normalizedExtension)
    ? REMOTE_AUDIO_MIME_TYPES[normalizedExtension]
    : null
}
