/**
 * V5 Meta-Adapt Layer - 平台适配基类
 * 
 * 定义平台适配器接口，提供通用方法
 */

/**
 * 适配器基类
 */
export class BaseAdapter {
  constructor(options = {}) {
    this.name = options.name || 'unknown'
    this.platformWeight = options.platformWeight || 1.0
    this.requestPatterns = options.requestPatterns || []
    this.responsePatterns = options.responsePatterns || []
  }
  
  /**
   * 解析请求 - 提取用户输入
   */
  parseRequest(request) {
    if (typeof request === 'string') return request
    
    // 通用消息格式
    if (request.messages) {
      const lastMsg = request.messages[request.messages.length - 1]
      if (lastMsg) {
        // OpenAI 格式
        if (lastMsg.content && typeof lastMsg.content === 'string') {
          return lastMsg.content
        }
        // Anthropic 格式
        if (lastMsg.content && Array.isArray(lastMsg.content)) {
          return lastMsg.content
            .filter(c => c.type === 'text')
            .map(c => c.text)
            .join('')
        }
      }
    }
    
    return JSON.stringify(request)
  }
  
  /**
   * 解析响应 - 提取助手回复
   */
  parseResponse(response) {
    if (typeof response === 'string') return response
    
    // OpenAI 格式
    if (response.choices?.[0]?.message?.content) {
      return response.choices[0].message.content
    }
    
    // Anthropic 格式
    if (response.content?.[0]?.text) {
      return response.content[0].text
    }
    
    // 流式响应
    if (response.delta?.content) {
      return response.delta.content
    }
    
    return JSON.stringify(response)
  }
  
  /**
   * 注入记忆到输入
   */
  inject(input, context) {
    return `${context}\n\n---\n\n${input}`
  }
  
  /**
   * 注入记忆到请求体
   */
  injectToRequest(request, context) {
    const input = this.parseRequest(request)
    const injected = this.inject(input, context)
    
    // 尝试注入到 messages
    if (request.messages && Array.isArray(request.messages)) {
      const lastMsg = request.messages[request.messages.length - 1]
      if (lastMsg && lastMsg.role === 'user') {
        // 克隆请求，避免修改原始
        const newRequest = JSON.parse(JSON.stringify(request))
        newRequest.messages[newRequest.messages.length - 1].content = injected
        return newRequest
      }
    }
    
    // 如果无法注入到 messages，返回原始请求
    return request
  }
  
  /**
   * 检测请求是否匹配此适配器
   */
  matchesRequest(url, method = 'POST') {
    for (const pattern of this.requestPatterns) {
      if (pattern.test(url)) return true
    }
    return false
  }
  
  /**
   * 获取适配器配置
   */
  getConfig() {
    return {
      name: this.name,
      platformWeight: this.platformWeight,
      requestPatterns: this.requestPatterns,
      responsePatterns: this.responsePatterns
    }
  }
}

/**
 * 适配器管理器
 */
export class AdapterManager {
  constructor() {
    this.adapters = new Map()
  }
  
  /**
   * 注册适配器
   */
  register(adapter) {
    this.adapters.set(adapter.name, adapter)
    return this
  }
  
  /**
   * 批量注册
   */
  registerMany(adapters) {
    for (const adapter of adapters) {
      this.register(adapter)
    }
    return this
  }
  
  /**
   * 获取适配器
   */
  get(name) {
    return this.adapters.get(name)
  }
  
  /**
   * 自动检测适配器
   */
  detect(url) {
    for (const [name, adapter] of this.adapters) {
      if (adapter.matchesRequest(url)) {
        return adapter
      }
    }
    return null
  }
  
  /**
   * 获取所有适配器
   */
  getAll() {
    return Array.from(this.adapters.values())
  }
  
  /**
   * 列出所有适配器名称
   */
  list() {
    return Array.from(this.adapters.keys())
  }
}

export default {
  BaseAdapter,
  AdapterManager
}
