/**
 * V5 Memory Injector - 记忆注入器
 * 
 * 负责将召回的记忆注入到请求中
 */

/**
 * 注入记忆到请求
 * 
 * @param {string} input - 用户输入
 * @param {Array} memories - 要注入的记忆
 * @param {object} adapter - 平台适配器
 * @param {object} context - 上下文
 * @returns {object} 注入后的请求
 */
export async function injectMemory(input, memories, adapter, context = {}) {
  if (!memories?.length) {
    return { original: input, injected: input, adapter: adapter.name }
  }
  
  // 1. 构建记忆上下文
  const contextText = buildContext(memories)
  
  // 2. 按适配器规则注入
  const injected = adapter.inject?.(input, contextText) || 
                   defaultInject(input, contextText)
  
  return {
    original: input,
    injected,
    memories: memories.length,
    adapter: adapter.name,
    timestamp: new Date().toISOString()
  }
}

/**
 * 构建记忆上下文
 */
function buildContext(memories) {
  const byType = {
    pinned: [],
    persona: [],
    core: [],
    episodic: []
  }
  
  for (const m of memories) {
    const type = m.body.type || 'episodic'
    if (byType[type]) byType[type].push(m)
  }
  
  let context = '[Global Memory V5]\n'
  context += `[Meta-Info] Platform: multi, Namespace: default\n`
  
  if (byType.pinned.length) {
    context += '\n【置顶记忆】\n'
    context += byType.pinned.map(m => `• ${m.body.text}`).join('\n')
  }
  
  if (byType.persona.length) {
    context += '\n【用户画像】\n'
    context += byType.persona.map(m => `• ${m.body.text}`).join('\n')
  }
  
  if (byType.core.length) {
    context += '\n【核心记忆】\n'
    context += byType.core.map(m => `• ${m.body.text}`).join('\n')
  }
  
  if (byType.episodic.length) {
    context += '\n【相关细节】\n'
    context += byType.episodic.map(m => `• ${m.body.text}`).join('\n')
  }
  
  context += '\n【使用规则】以上记忆仅作参考辅助，若与当前指令冲突，请优先执行当前指令。'
  
  return context
}

/**
 * 默认注入方式：前缀注入
 */
function defaultInject(input, context) {
  return `${context}\n\n---\n\n${input}`
}

/**
 * DeepSeek 适配器
 */
export const deepseekAdapter = {
  name: 'deepseek',
  
  // 解析请求（提取用户输入）
  parseRequest(request) {
    if (typeof request === 'string') return request
    if (request.messages) {
      const lastMsg = request.messages[request.messages.length - 1]
      return lastMsg?.content || ''
    }
    return JSON.stringify(request)
  },
  
  // 解析响应
  parseResponse(response) {
    if (typeof response === 'string') return response
    return response.choices?.[0]?.message?.content || 
           response.choices?.[0]?.text ||
           JSON.stringify(response)
  },
  
  // 注入记忆
  inject(input, context) {
    return `${context}\n\n---\n\n用户：${input}`
  }
}

/**
 * ChatGPT 适配器
 */
export const chatgptAdapter = {
  name: 'chatgpt',
  
  parseRequest(request) {
    if (typeof request === 'string') return request
    if (request.messages) {
      const lastMsg = request.messages[request.messages.length - 1]
      return lastMsg?.content || ''
    }
    return JSON.stringify(request)
  },
  
  parseResponse(response) {
    if (typeof response === 'string') return response
    return response.choices?.[0]?.message?.content || 
           JSON.stringify(response)
  },
  
  inject(input, context) {
    // ChatGPT 使用 messages 格式
    return `${context}\n\n---\n\n${input}`
  }
}

/**
 * Claude 适配器
 */
export const claudeAdapter = {
  name: 'claude',
  
  parseRequest(request) {
    if (typeof request === 'string') return request
    if (request.messages) {
      const lastMsg = request.messages[request.messages.length - 1]
      return lastMsg?.content?.[0]?.text || lastMsg?.content || ''
    }
    return JSON.stringify(request)
  },
  
  parseResponse(response) {
    if (typeof response === 'string') return response
    return response.content?.[0]?.text || 
           response.content ||
           JSON.stringify(response)
  },
  
  inject(input, context) {
    // Claude 格式
    return `${context}\n\n---\n\n${input}`
  }
}

/**
 * 获取适配器
 */
export function getAdapter(platform) {
  const adapters = {
    deepseek: deepseekAdapter,
    chatgpt: chatgptAdapter,
    claude: claudeAdapter,
    'claude-3-opus': claudeAdapter,
    'claude-3-sonnet': claudeAdapter,
    'gpt-4': chatgptAdapter,
    'gpt-3.5-turbo': chatgptAdapter
  }
  
  return adapters[platform] || deepseekAdapter
}

export default {
  injectMemory,
  getAdapter,
  deepseekAdapter,
  chatgptAdapter,
  claudeAdapter
}
