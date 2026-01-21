import { describe, it, expect } from 'vitest'

import { isPrivateHost } from '@/lib/url-utils'

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
