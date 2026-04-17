export const readJsonResponse = async <T>(response: Response): Promise<{ data: T | null; text: string }> => {
  const text = await response.text()
  if (!text) return { data: null, text: '' }

  try {
    return { data: JSON.parse(text) as T, text }
  } catch {
    return { data: null, text }
  }
}

const readErrorField = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object' || !('error' in payload)) return null
  const errorValue = (payload as { error?: unknown }).error
  return typeof errorValue === 'string' && errorValue.trim() ? errorValue.trim() : null
}

export const readResponseErrorMessage = (response: Response, payload: unknown): string => {
  const errorMessage = readErrorField(payload)
  if (errorMessage) return errorMessage

  return `HTTP ${response.status}`
}
