export const FIXED_SYSTEM_PROMPT =
  '你是一个专业的文字编辑助手。你的任务是对语音转文字的内容进行润色处理。请直接输出处理后的文本，不要有任何解释、前言或后语。'

export const DEFAULT_POLISH_INSTRUCTIONS =
  '请对以下语音转文字内容进行处理：1. 纠正错别字和语法错误 2. 添加适当的标点符号 3. 分段排版使内容更易读 4. 保持原意不变，不要添加或删除内容'

export const buildChatCompletionsUrl = (apiUrl: string): string => {
  return `${apiUrl.trim().replace(/\/+$/, '')}/chat/completions`
}
