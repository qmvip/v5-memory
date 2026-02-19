/**
 * V5 Meta-Adapt Layer - 平台适配器集合
 * 
 * 支持：DeepSeek、ChatGPT、Claude、Gemini、Cursor、Windsurf、Cline
 */

import { BaseAdapter } from './base_adapter.js'

/**
 * DeepSeek 适配器
 */
export class DeepSeekAdapter extends BaseAdapter {
  constructor() {
    super({
      name: 'deepseek',
      platformWeight: 1.0,
      requestPatterns: [
        /api\.deepseek\.com\/v0\/chat/,
        /deepseek\.com\/chat/,
        /api\/chat/
      ]
    })
  }
  
  parseRequest(request) {
    if (typeof request === 'string') return request
    
    // DeepSeek API 格式
    if (request.messages) {
      const lastMsg = request.messages[request.messages.length - 1]
      if (lastMsg?.content) {
        if (typeof lastMsg.content === 'string') {
          return lastMsg.content
        }
        // 多模态格式
        if (Array.isArray(lastMsg.content)) {
          return lastMsg.content
            .filter(c => c.type === 'text')
            .map(c => c.text)
            .join('')
        }
      }
    }
    
    return JSON.stringify(request)
  }
  
  parseResponse(response) {
    if (typeof response === 'string') return response
    
    // DeepSeek 流式/非流式响应
    if (response.choices?.[0]?.message?.content) {
      return response.choices[0].message.content
    }
    
    // 流式 delta
    if (response.choices?.[0]?.delta?.content) {
      return response.choices[0].delta.content
    }
    
    return JSON.stringify(response)
  }
  
  inject(input, context) {
    return `${context}\n\n---\n\n用户：${input}\n\n请根据以上记忆信息更好地回答用户问题。如果记忆与当前问题无关，请忽略记忆。`
  }
}

/**
 * ChatGPT 适配器
 */
export class ChatGPTAdapter extends BaseAdapter {
  constructor() {
    super({
      name: 'chatgpt',
      platformWeight: 1.0,
      requestPatterns: [
        /api\.openai\.com\/v1\/chat\/completions/,
        /chatgpt\.com\/api\/v0\/chat/
      ]
    })
  }
  
  parseRequest(request) {
    if (typeof request === 'string') return request
    
    if (request.messages) {
      const lastMsg = request.messages[request.messages.length - 1]
      if (lastMsg?.content) {
        return typeof lastMsg.content === 'string' 
          ? lastMsg.content 
          : JSON.stringify(lastMsg.content)
      }
    }
    
    return JSON.stringify(request)
  }
  
  parseResponse(response) {
    if (typeof response === 'string') return response
    
    if (response.choices?.[0]?.message?.content) {
      return response.choices[0].message.content
    }
    
    if (response.choices?.[0]?.delta?.content) {
      return response.choices[0].delta.content
    }
    
    return JSON.stringify(response)
  }
  
  inject(input, context) {
    return `${context}\n\n---\n\n${input}`
  }
}

/**
 * Claude 适配器
 */
export class ClaudeAdapter extends BaseAdapter {
  constructor() {
    super({
      name: 'claude',
      platformWeight: 1.0,
      requestPatterns: [
        /api\.anthropic\.com\/v1\/messages/,
        /claude\.ai\/api\/chat\/complete/
      ]
    })
  }
  
  parseRequest(request) {
    if (typeof request === 'string') return request
    
    // Claude API 格式
    if (request.messages) {
      const lastMsg = request.messages[request.messages.length - 1]
      if (lastMsg?.content) {
        if (typeof lastMsg.content === 'string') {
          return lastMsg.content
        }
        // Anthropic 格式
        if (Array.isArray(lastMsg.content)) {
          return lastMsg.content
            .filter(c => c.type === 'text')
            .map(c => c.text)
            .join('')
        }
      }
    }
    
    return JSON.stringify(request)
  }
  
  parseResponse(response) {
    if (typeof response === 'string') return response
    
    // Anthropic 格式
    if (response.content?.[0]?.text) {
      return response.content[0].text
    }
    
    // 流式
    if (response.delta?.text) {
      return response.delta.text
    }
    
    return JSON.stringify(response)
  }
  
  inject(input, context) {
    return `${context}\n\n---\n\n${input}`
  }
}

/**
 * Gemini 适配器
 */
export class GeminiAdapter extends BaseAdapter {
  constructor() {
    super({
      name: 'gemini',
      platformWeight: 0.95,
      requestPatterns: [
        /generativelanguage\.googleapis\.com\/v1beta\/models/,
        /gemini\.googleapis\.com/
      ]
    })
  }
  
  parseRequest(request) {
    if (typeof request === 'string') return request
    
    // Gemini 格式
    if (request.contents) {
      const lastContent = request.contents[request.contents.length - 1]
      if (lastContent?.parts) {
        return lastContent.parts
          .map(p => p.text || '')
          .join('')
      }
    }
    
    return JSON.stringify(request)
  }
  
  parseResponse(response) {
    if (typeof response === 'string') return response
    
    if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
      return response.candidates[0].content.parts[0].text
    }
    
    return JSON.stringify(response)
  }
  
  inject(input, context) {
    return `${context}\n\n---\n\n${input}`
  }
}

/**
 * Cursor IDE 适配器
 */
export class CursorAdapter extends BaseAdapter {
  constructor() {
    super({
      name: 'cursor',
      platformWeight: 1.0,
      requestPatterns: [
        /cursor\.sh\/api\/chat/,
        /api\.cursor\.sh/
      ]
    })
    
    this.codeContext = true  // 支持代码上下文
  }
  
  parseRequest(request) {
    if (typeof request === 'string') return request
    
    // Cursor 格式
    if (request.messages) {
      // 提取最后一条用户消息
      const userMsgs = request.messages.filter(m => m.role === 'user')
      const lastUserMsg = userMsgs[userMsgs.length - 1]
      if (lastUserMsg?.content) {
        if (typeof lastUserMsg.content === 'string') {
          return lastUserMsg.content
        }
        // 可能包含代码片段
        return JSON.stringify(lastUserMsg.content)
      }
    }
    
    return JSON.stringify(request)
  }
  
  parseResponse(response) {
    if (typeof response === 'string') return response
    
    if (response.choices?.[0]?.message?.content) {
      return response.choices[0].message.content
    }
    
    return JSON.stringify(response)
  }
  
  inject(input, context) {
    // 代码场景的特殊注入格式
    return `${context}\n\n---\n\nCurrent task:\n${input}\n\nPlease consider the above memory context when writing code.`
  }
}

/**
 * Windsurf 适配器
 */
export class WindsurfAdapter extends BaseAdapter {
  constructor() {
    super({
      name: 'windsurf',
      platformWeight: 1.0,
      requestPatterns: [
        /windsurf\.sh\/api/,
        /api\.windsurf\.sh/
      ]
    })
  }
  
  parseRequest(request) {
    if (typeof request === 'string') return request
    
    if (request.messages) {
      const lastMsg = request.messages[request.messages.length - 1]
      if (lastMsg?.content) {
        return typeof lastMsg.content === 'string' 
          ? lastMsg.content 
          : JSON.stringify(lastMsg.content)
      }
    }
    
    return JSON.stringify(request)
  }
  
  parseResponse(response) {
    if (typeof response === 'string') return response
    
    if (response.choices?.[0]?.message?.content) {
      return response.choices[0].message.content
    }
    
    return JSON.stringify(response)
  }
  
  inject(input, context) {
    return `${context}\n\n---\n\n${input}`
  }
}

/**
 * Cline 适配器
 */
export class ClineAdapter extends BaseAdapter {
  constructor() {
    super({
      name: 'cline',
      platformWeight: 1.0,
      requestPatterns: [
        /cline\.dev\/api/,
        /api\.cline\.dev/
      ]
    })
  }
  
  parseRequest(request) {
    if (typeof request === 'string') return request
    
    if (request.messages) {
      const lastMsg = request.messages[request.messages.length - 1]
      if (lastMsg?.content) {
        return typeof lastMsg.content === 'string' 
          ? lastMsg.content 
          : JSON.stringify(lastMsg.content)
      }
    }
    
    return JSON.stringify(request)
  }
  
  parseResponse(response) {
    if (typeof response === 'string') return response
    
    if (response.choices?.[0]?.message?.content) {
      return response.choices[0].message.content
    }
    
    return JSON.stringify(response)
  }
  
  inject(input, context) {
    return `${context}\n\n---\n\n${input}`
  }
}

/**
 * 获取所有平台适配器
 */
export function getAllAdapters() {
  return [
    new DeepSeekAdapter(),
    new ChatGPTAdapter(),
    new ClaudeAdapter(),
    new GeminiAdapter(),
    new CursorAdapter(),
    new WindsurfAdapter(),
    new ClineAdapter()
  ]
}

/**
 * 根据名称获取适配器
 */
export function getAdapter(name) {
  const adapters = {
    deepseek: DeepSeekAdapter,
    chatgpt: ChatGPTAdapter,
    claude: ClaudeAdapter,
    gemini: GeminiAdapter,
    cursor: CursorAdapter,
    windsurf: WindsurfAdapter,
    cline: ClineAdapter
  }
  
  const AdapterClass = adapters[name]
  return AdapterClass ? new AdapterClass() : null
}

export default {
  BaseAdapter,
  DeepSeekAdapter,
  ChatGPTAdapter,
  ClaudeAdapter,
  GeminiAdapter,
  CursorAdapter,
  WindsurfAdapter,
  ClineAdapter,
  getAllAdapters,
  getAdapter
}
