import { describe, it, expect } from 'vitest'

import { ALIST_SITES, isAlistPageUrl } from '@/lib/alist-utils'

describe('ALIST_SITES', () => {
  it('不需要显式列出 www 子域', () => {
    expect(ALIST_SITES.some((site) => site.startsWith('www.'))).toBe(false)
  })
})

describe('isAlistPageUrl', () => {
  it('允许根域和子域播放页', () => {
    expect(isAlistPageUrl('https://asmrgay.com/asmr/123')).toBe(true)
    expect(isAlistPageUrl('https://www.asmrgay.com/asmr/123')).toBe(true)
    expect(isAlistPageUrl('https://sub.asmr.stream/asmr/123')).toBe(true)
  })

  it('拒绝直链和非 AList 域名', () => {
    expect(isAlistPageUrl('https://asmrgay.com/d/asmr/test.mp3')).toBe(false)
    expect(isAlistPageUrl('https://example.com/asmr/123')).toBe(false)
  })
})
