/**
 * V5 MCP Protocol - Model Context Protocol Adapter
 * 
 * 实现 MCP (Model Context Protocol) 协议
 * 让 V5 记忆系统可以与更广泛的工具和数据即插即用
 * 
 * MCP 规范参考: https://spec.modelcontextprotocol.io/
 */

import { EventEmitter } from 'events'

/**
 * MCP 消息类型
 */
export const MCP_MESSAGE_TYPES = {
  // 初始化
  INITIALIZE: 'initialize',
  INITIALIZED: 'initialized',
  
  // 工具调用
  TOOLS_LIST: 'tools/list',
  TOOLS_CALL: 'tools/call',
  
  // 资源
  RESOURCES_LIST: 'resources/list',
  RESOURCES_READ: 'resources/read',
  RESOURCES_SUBSCRIBE: 'resources/subscribe',
  
  // 提示
  PROMPTS_LIST: 'prompts/list',
  PROMPTS_GET: 'prompts/get',
  
  // 通知
  NOTIFICATION: 'notification',
  ERROR: 'error'
}

/**
 * MCP 协议适配器
 */
export class MCPAdapter extends EventEmitter {
  constructor(options = {}) {
    super()
    
    this.config = {
      protocolVersion: options.protocolVersion || '2024-11-05',
      capabilities: options.capabilities || {
        tools: {},
        resources: {},
        prompts: {}
      },
      ...options
    }
    
    // 工具注册表
    this.tools = new Map()
    
    // 资源注册表
    this.resources = new Map()
    
    // 提示注册表
    this.prompts = new Map()
    
    // 初始化状态
    this.initialized = false
    
    // 消息队列
    this.messageQueue = []
    
    // 注册默认工具
    this.registerDefaultTools()
    
    // 注册默认资源
    this.registerDefaultResources()
    
    // 注册默认提示
    this.registerDefaultPrompts()
  }
  
  /**
   * 注册默认工具
   */
  registerDefaultTools() {
    // 记忆工具
    this.registerTool({
      name: 'memory_search',
      description: '搜索记忆库',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '搜索查询' },
          type: { type: 'string', enum: ['persona', 'core', 'episodic', 'pinned'] },
          limit: { type: 'number', default: 10 }
        },
        required: ['query']
      }
    })
    
    this.registerTool({
      name: 'memory_add',
      description: '添加新记忆',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: '记忆内容' },
          type: { type: 'string', enum: ['persona', 'core', 'episodic', 'pinned'], default: 'episodic' },
          tags: { type: 'array', items: { type: 'string' } }
        },
        required: ['text']
      }
    })
    
    this.registerTool({
      name: 'memory_delete',
      description: '删除记忆',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '记忆ID' }
        },
        required: ['id']
      }
    })
    
    this.registerTool({
      name: 'memory_stats',
      description: '获取记忆统计',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    })
    
    this.registerTool({
      name: 'memory_export',
      description: '导出记忆',
      inputSchema: {
        type: 'object',
        properties: {
          format: { type: 'string', enum: ['json', 'csv'], default: 'json' }
        }
      }
    })
    
    // 实验工具
    this.registerTool({
      name: 'experiment_create',
      description: '创建实验',
      inputSchema: {
        type: 'object',
        properties: {
          hypothesis: { type: 'string' },
          goal: { type: 'string' },
          type: { type: 'string', enum: ['simulation', 'wet_lab', 'hybrid'] }
        },
        required: ['hypothesis', 'goal']
      }
    })
    
    this.registerTool({
      name: 'experiment_run',
      description: '运行实验',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          iterations: { type: 'number', default: 10 }
        },
        required: ['id']
      }
    })
    
    // 检索工具
    this.registerTool({
      name: 'retrieve_memories',
      description: '检索并注入记忆',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          platform: { type: 'string' }
        },
        required: ['query']
      }
    })
  }
  
  /**
   * 注册默认资源
   */
  registerDefaultResources() {
    this.registerResource({
      uri: 'memory://all',
      name: '所有记忆',
      description: '完整的记忆库',
      mimeType: 'application/json'
    })
    
    this.registerResource({
      uri: 'memory://persona',
      name: '用户画像',
      description: '用户画像记忆',
      mimeType: 'application/json'
    })
    
    this.registerResource({
      uri: 'memory://core',
      name: '核心记忆',
      description: '核心记忆',
      mimeType: 'application/json'
    })
    
    this.registerResource({
      uri: 'config://v5',
      name: 'V5配置',
      description: '当前V5引擎配置',
      mimeType: 'application/json'
    })
    
    this.registerResource({
      uri: 'stats://memory',
      name: '记忆统计',
      description: '记忆库统计信息',
      mimeType: 'application/json'
    })
  }
  
  /**
   * 注册默认提示
   */
  registerDefaultPrompts() {
    this.registerPrompt({
      name: 'search_memory',
      description: '搜索记忆并返回结果',
      arguments: [
        {
          name: 'query',
          description: '搜索内容',
          required: true
        }
      ],
      template: '请搜索记忆库中与「{{query}}」相关的内容'
    })
    
    this.registerPrompt({
      name: 'add_persona',
      description: '添加用户画像',
      arguments: [
        {
          name: 'trait',
          description: '特征描述',
          required: true
        }
      ],
      template: '请添加用户画像：{{trait}}'
    })
    
    this.registerPrompt({
      name: 'recall_context',
      description: '召回上下文',
      arguments: [
        {
          name: 'topic',
          description: '主题',
          required: true
        }
      ],
      template: '请召回与「{{topic}}」相关的所有记忆，并注入到当前对话中'
    })
  }
  
  /**
   * 注册工具
   */
  registerTool(tool) {
    this.tools.set(tool.name, {
      ...tool,
      registeredAt: new Date().toISOString()
    })
    return this
  }
  
  /**
   * 注册资源
   */
  registerResource(resource) {
    this.resources.set(resource.uri, {
      ...resource,
      registeredAt: new Date().toISOString()
    })
    return this
  }
  
  /**
   * 注册提示
   */
  registerPrompt(prompt) {
    this.prompts.set(prompt.name, {
      ...prompt,
      registeredAt: new Date().toISOString()
    })
    return this
  }
  
  /**
   * 处理消息
   */
  async handleMessage(message) {
    const { method, params, id } = message
    
    try {
      let result = null
      
      switch (method) {
        case MCP_MESSAGE_TYPES.INITIALIZE:
          result = await this.initialize(params)
          break
          
        case MCP_MESSAGE_TYPES.TOOLS_LIST:
          result = await this.listTools()
          break
          
        case MCP_MESSAGE_TYPES.TOOLS_CALL:
          result = await this.callTool(params.name, params.arguments)
          break
          
        case MCP_MESSAGE_TYPES.RESOURCES_LIST:
          result = await this.listResources()
          break
          
        case MCP_MESSAGE_TYPES.RESOURCES_READ:
          result = await this.readResource(params.uri)
          break
          
        case MCP_MESSAGE_TYPES.PROMPTS_LIST:
          result = await this.listPrompts()
          break
          
        case MCP_MESSAGE_TYPES.PROMPTS_GET:
          result = await this.getPrompt(params.name, params.arguments)
          break
          
        default:
          throw new Error(`Unknown method: ${method}`)
      }
      
      // 发送响应
      this.sendResponse({
        id,
        result
      })
      
    } catch (error) {
      this.sendResponse({
        id,
        error: {
          code: -32603,
          message: error.message
        }
      })
    }
  }
  
  /**
   * 初始化
   */
  async initialize(params) {
    this.initialized = true
    
    return {
      protocolVersion: this.config.protocolVersion,
      capabilities: this.config.capabilities,
      serverInfo: {
        name: 'V5 Memory Server',
        version: '1.0.0'
      }
    }
  }
  
  /**
   * 列出工具
   */
  async listTools() {
    const tools = Array.from(this.tools.values()).map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema
    }))
    
    return { tools }
  }
  
  /**
   * 调用工具
   */
  async callTool(name, args) {
    const tool = this.tools.get(name)
    
    if (!tool) {
      throw new Error(`Tool not found: ${name}`)
    }
    
    // 触发工具调用事件
    this.emit('toolCall', { name, args })
    
    // 这里应该对接实际的 V5 引擎
    // 模拟返回
    return {
      content: [
        {
          type: 'text',
          text: `Tool ${name} executed with args: ${JSON.stringify(args)}`
        }
      ]
    }
  }
  
  /**
   * 列出资源
   */
  async listResources() {
    const resources = Array.from(this.resources.values()).map(r => ({
      uri: r.uri,
      name: r.name,
      description: r.description,
      mimeType: r.mimeType
    }))
    
    return { resources }
  }
  
  /**
   * 读取资源
   */
  async readResource(uri) {
    const resource = this.resources.get(uri)
    
    if (!resource) {
      throw new Error(`Resource not found: ${uri}`)
    }
    
    // 这里应该返回实际的资源内容
    return {
      contents: [
        {
          uri,
          mimeType: resource.mimeType,
          text: JSON.stringify({ uri, name: resource.name })
        }
      ]
    }
  }
  
  /**
   * 列出提示
   */
  async listPrompts() {
    const prompts = Array.from(this.prompts.values()).map(p => ({
      name: p.name,
      description: p.description,
      arguments: p.arguments
    }))
    
    return { prompts }
  }
  
  /**
   * 获取提示
   */
  async getPrompt(name, args) {
    const prompt = this.prompts.get(name)
    
    if (!prompt) {
      throw new Error(`Prompt not found: ${name}`)
    }
    
    // 替换模板变量
    let content = prompt.template
    if (args) {
      for (const [key, value] of Object.entries(args)) {
        content = content.replace(new RegExp(`{{${key}}}`, 'g'), value)
      }
    }
    
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: content
          }
        }
      ]
    }
  }
  
  /**
   * 发送响应
   */
  sendResponse(message) {
    this.emit('response', message)
  }
  
  /**
   * 发送通知
   */
  sendNotification(method, params) {
    this.emit('notification', { method, params })
  }
  
  /**
   * 获取状态
   */
  getStatus() {
    return {
      initialized: this.initialized,
      toolsCount: this.tools.size,
      resourcesCount: this.resources.size,
      promptsCount: this.prompts.size
    }
  }
}

/**
 * MCP 客户端
 */
export class MCPClient extends EventEmitter {
  constructor(options = {}) {
    super()
    
    this.config = {
      ...options
    }
    
    this.requestId = 0
    this.pendingRequests = new Map()
    this.transport = null
  }
  
  /**
   * 连接传输层
   */
  connect(transport) {
    this.transport = transport
    
    transport.onmessage = (message) => {
      this.handleMessage(message)
    }
    
    transport.onerror = (error) => {
      this.emit('error', error)
    }
    
    transport.onclose = () => {
      this.emit('close')
    }
  }
  
  /**
   * 发送请求
   */
  async request(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId
      
      this.pendingRequests.set(id, { resolve, reject })
      
      const message = { jsonrpc: '2.0', method, params, id }
      
      this.transport.send(message)
      
      // 超时处理
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error('Request timeout'))
        }
      }, 30000)
    })
  }
  
  /**
   * 处理消息
   */
  handleMessage(message) {
    const { id, result, error } = message
    
    if (id !== undefined && this.pendingRequests.has(id)) {
      const { resolve, reject } = this.pendingRequests.get(id)
      this.pendingRequests.delete(id)
      
      if (error) {
        reject(new Error(error.message))
      } else {
        resolve(result)
      }
    } else if (message.method) {
      // 通知
      this.emit('notification', message)
    }
  }
  
  /**
   * 初始化
   */
  async initialize() {
    return this.request(MCP_MESSAGE_TYPES.INITIALIZE, {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'V5 MCP Client',
        version: '1.0.0'
      }
    })
  }
  
  /**
   * 列出工具
   */
  async listTools() {
    return this.request(MCP_MESSAGE_TYPES.TOOLS_LIST)
  }
  
  /**
   * 调用工具
   */
  async callTool(name, args) {
    return this.request(MCP_MESSAGE_TYPES.TOOLS_CALL, {
      name,
      arguments: args
    })
  }
  
  /**
   * 读取资源
   */
  async readResource(uri) {
    return this.request(MCP_MESSAGE_TYPES.RESOURCES_READ, { uri })
  }
  
  /**
   * 获取提示
   */
  async getPrompt(name, args) {
    return this.request(MCP_MESSAGE_TYPES.PROMPTS_GET, { name, arguments: args })
  }
}

export default {
  MCPAdapter,
  MCPClient,
  MCP_MESSAGE_TYPES
}
