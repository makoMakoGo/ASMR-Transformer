import { ProxyAgent, fetch as undiciFetch } from 'undici'

const proxyAgentCache = new Map<string, ProxyAgent>()

const getProxyAgent = (proxyUrl: string): ProxyAgent => {
  const cached = proxyAgentCache.get(proxyUrl)
  if (cached) return cached
  const agent = new ProxyAgent(proxyUrl)
  proxyAgentCache.set(proxyUrl, agent)
  return agent
}

export const fetchWithProxy = async (
  url: string,
  init?: RequestInit,
  proxyUrl?: string
): Promise<Response> => {
  const effectiveProxyUrl = (proxyUrl || '').trim()
  if (!effectiveProxyUrl) return fetch(url, init)

  const agent = getProxyAgent(effectiveProxyUrl)
  const res = undiciFetch(url, { ...init, dispatcher: agent } as Parameters<typeof undiciFetch>[1])
  return res as unknown as Response
}
