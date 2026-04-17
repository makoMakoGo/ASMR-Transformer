import { describe, it, expect } from 'vitest'

import { isAllowedAudioHost, isPrivateHost, validateAndParseAudioUrl } from '@/lib/url-utils'

describe('isPrivateHost', () => {
  it('识别常见私网/回环/链路本地地址', () => {
    const privateHosts = [
      'localhost',
      '127.0.0.1',
      '127.10.20.30',
      '10.0.0.1',
      '192.168.1.1',
      '172.16.0.1',
      '172.31.255.255',
      '169.254.10.10',
      '::1',
      '0:0:0:0:0:0:0:1',
      'fe80::1',
      'fc00::1',
      'fd00::1',
      '::ffff:127.0.0.1',
    ]

    privateHosts.forEach((host) => {
      expect(isPrivateHost(host)).toBe(true)
    })
  })

  it('允许公网域名/公网IP', () => {
    const publicHosts = [
      'example.com',
      '8.8.8.8',
      '1.1.1.1',
      '2001:4860:4860::8888',
    ]

    publicHosts.forEach((host) => {
      expect(isPrivateHost(host)).toBe(false)
    })
  })
})

describe('isAllowedAudioHost', () => {
  it('允许 ASMRGAY 主站与备用站域名', () => {
    const hosts = ['www.asmrgay.com', 'www.asmr.pw', 'www.asmr.loan', 'www.asmr.party', 'www.asmr.stream']
    hosts.forEach((host) => expect(isAllowedAudioHost(host)).toBe(true))
  })

  it('允许 raw_url 下载域名（不允许其子域名）', () => {
    expect(isAllowedAudioHost('asmr.121231234.xyz')).toBe(true)
    expect(isAllowedAudioHost('a.asmr.121231234.xyz')).toBe(false)
  })

  it('拒绝其它域名', () => {
    expect(isAllowedAudioHost('example.com')).toBe(false)
  })
})

describe('validateAndParseAudioUrl', () => {
  it('返回更细粒度错误码', () => {
    expect(validateAndParseAudioUrl('not-a-url')).toEqual({ ok: false, error: 'INVALID_URL' })
    expect(validateAndParseAudioUrl('ftp://www.asmrgay.com/x.mp3')).toEqual({
      ok: false,
      error: 'UNSUPPORTED_PROTOCOL',
    })
    expect(validateAndParseAudioUrl('http://127.0.0.1/x.mp3')).toEqual({
      ok: false,
      error: 'PRIVATE_HOST',
    })
    expect(validateAndParseAudioUrl('https://example.com/x.mp3')).toEqual({
      ok: false,
      error: 'HOST_NOT_ALLOWED',
    })
  })

  it('返回解析后的合法 URL，并在需要时拒绝缺失扩展名', () => {
    const pageUrl = validateAndParseAudioUrl('https://www.asmrgay.com/asmr/x', { requireAudioExtension: false })
    expect(pageUrl.ok).toBe(true)
    if (!pageUrl.ok) throw new Error('expected page URL to parse successfully')
    expect(pageUrl.url.href).toBe('https://www.asmrgay.com/asmr/x')
    expect(pageUrl.url.hostname).toBe('www.asmrgay.com')

    expect(validateAndParseAudioUrl('https://www.asmrgay.com/asmr/x', { requireAudioExtension: true })).toEqual({
      ok: false,
      error: 'MISSING_AUDIO_EXTENSION',
    })
    expect(
      validateAndParseAudioUrl('https://www.asmrgay.com/d/asmr/x.wma?sign=abc', { requireAudioExtension: true })
    ).toEqual({
      ok: false,
      error: 'MISSING_AUDIO_EXTENSION',
    })

    const directUrl = validateAndParseAudioUrl('https://www.asmrgay.com/d/asmr/x.mp3?sign=abc', {
      requireAudioExtension: true,
    })
    expect(directUrl.ok).toBe(true)
    if (!directUrl.ok) throw new Error('expected direct audio URL to parse successfully')
    expect(directUrl.url.href).toBe('https://www.asmrgay.com/d/asmr/x.mp3?sign=abc')
    expect(directUrl.url.searchParams.get('sign')).toBe('abc')
  })
})
