import { promises as fs } from 'node:fs'
import path from 'node:path'

export type EnvMap = Record<string, string>

const ENV_LINE_RE = /^\s*(export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/

const hasClosingQuote = (value: string, quote: '"' | "'"): boolean => {
  if (!value.endsWith(quote)) return false
  let backslashes = 0
  for (let i = value.length - 2; i >= 0; i--) {
    if (value[i] !== '\\') break
    backslashes += 1
  }
  return backslashes % 2 === 0
}

const parseEnvValue = (raw: string): string => {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  if (trimmed.startsWith('"') && hasClosingQuote(trimmed, '"')) {
    try {
      return JSON.parse(trimmed) as string
    } catch {
      return trimmed.slice(1, -1)
    }
  }

  if (trimmed.startsWith("'") && hasClosingQuote(trimmed, "'")) {
    return trimmed.slice(1, -1)
  }

  const hashIndex = trimmed.indexOf('#')
  if (hashIndex >= 0) {
    const before = trimmed.slice(0, hashIndex)
    if (/\s$/.test(before)) return before.trimEnd()
  }

  return trimmed
}

export const parseEnv = (content: string): EnvMap => {
  const env: EnvMap = {}
  const lines = content.split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const match = ENV_LINE_RE.exec(line)
    if (!match) continue
    const key = match[2]?.trim()
    if (!key) continue
    const rawValue = match[3] ?? ''
    env[key] = parseEnvValue(rawValue)
  }
  return env
}

export const stringifyEnvValue = (value: string): string => {
  if (value === '') return ''
  const safe = /^[A-Za-z0-9_./:@-]+$/.test(value)
  if (safe) return value
  return JSON.stringify(value)
}

export const upsertEnvContent = (existingContent: string, updates: EnvMap): string => {
  const existingLines = existingContent.split(/\r?\n/)
  const pendingKeys = new Set(Object.keys(updates))

  const nextLines = existingLines.map((line) => {
    const match = ENV_LINE_RE.exec(line)
    if (!match) return line

    const exportPrefix = match[1] || ''
    const key = match[2]
    if (!key || !pendingKeys.has(key)) return line

    pendingKeys.delete(key)
    const leadingWhitespace = /^\s*/.exec(line)?.[0] ?? ''
    const nextValue = updates[key] ?? ''
    return `${leadingWhitespace}${exportPrefix}${key}=${stringifyEnvValue(nextValue)}`
  })

  for (const key of pendingKeys) {
    const nextValue = updates[key] ?? ''
    nextLines.push(`${key}=${stringifyEnvValue(nextValue)}`)
  }

  const content = nextLines.join('\n')
  return content.endsWith('\n') ? content : `${content}\n`
}

export const readEnvFile = async (filePath: string): Promise<{ exists: boolean; content: string; env: EnvMap }> => {
  try {
    const content = await fs.readFile(filePath, 'utf8')
    return { exists: true, content, env: parseEnv(content) }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      return { exists: false, content: '', env: {} }
    }
    throw e
  }
}

export const writeEnvFile = async (filePath: string, updates: EnvMap): Promise<{ content: string; env: EnvMap }> => {
  const { content: existingContent } = await readEnvFile(filePath)
  const nextContent = upsertEnvContent(existingContent, updates)
  const dir = path.dirname(filePath)
  const base = path.basename(filePath)
  const tempPath = path.join(dir, `.${base}.${process.pid}.tmp`)
  await fs.writeFile(tempPath, nextContent, 'utf8')
  await fs.rename(tempPath, filePath)
  return { content: nextContent, env: parseEnv(nextContent) }
}

