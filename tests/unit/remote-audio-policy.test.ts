import { describe, expect, it } from 'vitest'

import {
  ALIST_PAGE_HOSTS,
  getRemoteAudioMimeType,
  isAlistPageHost,
  isAllowedRemoteAudioHost,
  REMOTE_AUDIO_EXTENSIONS,
} from '@/lib/remote-audio-policy'

describe('remote-audio-policy', () => {
  it('uses one host policy for AList pages and allowed remote audio hosts', () => {
    expect(ALIST_PAGE_HOSTS.some((host) => host.startsWith('www.'))).toBe(false)

    for (const host of ALIST_PAGE_HOSTS) {
      expect(isAlistPageHost(host)).toBe(true)
      expect(isAlistPageHost(`www.${host}`)).toBe(true)
      expect(isAllowedRemoteAudioHost(host)).toBe(true)
      expect(isAllowedRemoteAudioHost(`www.${host}`)).toBe(true)
    }
  })

  it('keeps raw download hosts out of the AList page host policy', () => {
    expect(isAllowedRemoteAudioHost('asmr.121231234.xyz')).toBe(true)
    expect(isAllowedRemoteAudioHost('a.asmr.121231234.xyz')).toBe(false)
    expect(isAlistPageHost('asmr.121231234.xyz')).toBe(false)
  })

  it('keeps extension and MIME policy together', () => {
    expect(REMOTE_AUDIO_EXTENSIONS).toContain('mp3')
    expect(getRemoteAudioMimeType('mp3')).toBe('audio/mpeg')
    expect(getRemoteAudioMimeType('.m4a')).toBe('audio/mp4')
    expect(getRemoteAudioMimeType('wma')).toBeNull()
  })
})
