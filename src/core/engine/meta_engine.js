/**
 * V5 Meta Engine - Core Rule Engine
 * V5 元规则引擎 - 记忆系统的核心决策中心
 * 
 * 核心职责：
 * 1. 驱动记忆的提取、召回、注入全生命周期
 * 2. 计算 V5 势垒方程得分
 * 3. 管理元规则配置
 * 4. 处理版本链与冲突合并
 * 
 * @author V5 Meta-Structure
 * @version 1.0.0
 */

import { 
  v5BarrierEquation, 
  calculateRecallScore, 
  calculateWriteScore,
  MEMORY_TYPE_THRESHOLDS,
  judgeMemoryType 
} from './scorer.js'
import { extractMemory, createMemoryEntry } from './extractor.js'
import { retrieveMemories } from './retriever.js'
import { injectMemory, getAdapter } from '../adapt/platform_adapters.js'
import { V5MemoryStore } from '../storage/memory_store.js'
import { Sanitizer, SecurityAuditor } from '../security/sanitizer.js'

export class V5MetaEngine {
  constructor(config = {}) {
    this.config = {
      // V5 势垒参数
      gamma: config.gamma || 0.85,          // 系统响应强度
      barrier: config.barrier || 0.5,        // 临界阈值
      recallThreshold: config.recallThreshold || 0.5,
      writeThreshold: config.writeThreshold || 0.6,
      
      // 平台适配
      platform: config.platform || 'deepseek',
      namespace: config.namespace || 'default',
      
      // 注入预算
      budget: config.budget || {
        persona: 3,
        core: 4,
        episodic: 6
      },
      
      // 生命周期
      ttl: config.ttl || 30 * 24 * 60 * 60 * 1000, // 30天
      
      // 安全
      autoMaskSensitive: config.autoMaskSensitive ?? true,
      sensitivityPatterns: config.sensitivityPatterns || [
        /password/i, /api[_-]?key/i, /secret/i, 
        /token/i, /otp/i, /\d{6,}/, /bank/i
      ],
      
      // 扩展
      ...config
    }
    
    this.store = new V5MemoryStore()
    this.platformAdapter = null
    this.sanitizer = new Sanitizer({
      patterns: this.config.sensitivityPatterns,
      autoMask: this.config.autoMaskSensitive
    })
    this.auditor = new SecurityAuditor()
  }
  
  /**
   * 初始化引擎
   */
  async init() {
    await this.store.init()
    // 自动设置适配器
    this.setPlatformAdapter(getAdapter(this.config.platform))
    return this
  }
  
  /**
   * 设置平台适配器
   */
  setPlatformAdapter(adapter) {
    this.platformAdapter = adapter
    if (adapter) {
      this.config.platform = adapter.name
    }
  }
  
  /**
   * 核心流程：对话后提取并写入记忆
   * 
   * 对应伪代码: extractAndSave()
   */
  async extractAndSave(conversation, platform) {
    // 1. 适配平台：解析会话内容
    if (!this.platformAdapter) {
      throw new Error(`未适配平台：${platform}`)
    }
    const parsedContent = this.platformAdapter.parseResponse(conversation)
    
    // 2. 安全层：敏感信息检测
    const securedContent = this.sanitize(parsedContent)
    
    // 3. 计算写入得分和激活概率
    const writeScore = calculateWriteScore(
      securedContent.confidence || 0.8,
      securedContent.importance || 0.7,
      this.platformAdapter.platformWeight || 1,
      securedContent.freshness || 1
    )
    const activateProbability = v5BarrierEquation(writeScore, this.config.gamma, this.config.barrier)
    
    // 4. 按阈值过滤：不同类型记忆的激活阈值不同
    const memoryType = judgeMemoryType(parsedContent, securedContent)
    const typeThreshold = MEMORY_TYPE_THRESHOLDS[memoryType] || 0.5
    
    if (activateProbability < typeThreshold) {
      this.auditor.log('FILTERED', { reason: 'threshold', score: activateProbability, type: memoryType })
      return null
    }
    
    // 5. 构建 V5 记忆条目
    const memoryItem = createMemoryEntry({
      type: memoryType,
      text: parsedContent,
      dimensions: {
        confidence: securedContent.confidence || 0.8,
        importance: securedContent.importance || 0.7,
        time_decay: 1,
        recall_priority: memoryType === 'pinned' ? 1 : 0.8
      }
    }, {
      platform: this.config.platform,
      namespace: this.config.namespace
    })
    
    // 6. 处理冲突：标记旧条目为 superseded
    await this.handleConflict(memoryItem)
    
    // 7. 写入存储层
    const id = await this.store.add(memoryItem)
    this.auditor.log('WRITE', { memoryId: id, type: memoryType, score: activateProbability })
    
    return { ...memoryItem, id }
  }
  
  /**
   * 核心流程：发送前召回并注入记忆
   * 
   * 对应伪代码: retrieveAndInject()
   */
  async retrieveAndInject(input, platform, request) {
    try {
      // 1. 获取所有活跃记忆
      const memories = await this.store.query({
        platform: platform || this.config.platform,
        namespace: this.config.namespace,
        status: 'active'
      })
      
      if (memories.length === 0) {
        return { request, memories: [] }
      }
      
      // 2. 计算每条记忆的召回概率
      const matchedMemories = memories.map(memory => {
        const recallScore = this.calculateMatchScore(input, memory)
        const recallProbability = v5BarrierEquation(
          recallScore, 
          this.config.gamma, 
          this.config.barrier
        )
        return { ...memory, recallScore, recallProbability }
      })
      
      // 3. 按召回概率排序 + 裁剪（按预算）
      const sortedMemories = matchedMemories
        .sort((a, b) => b.recallProbability - a.recallProbability)
      
      const selectedMemories = this.cropMemories(sortedMemories)
      
      // 4. 适配平台：注入记忆到请求中
      const adapter = this.platformAdapter || getAdapter(platform)
      if (!adapter) {
        throw new Error(`未适配平台：${platform}`)
      }
      
      const injectedRequest = adapter.injectToRequest(request, 
        this.buildContext(selectedMemories)
      )
      
      this.auditor.log('RECALL', { 
        inputLength: input.length, 
        recalled: selectedMemories.length,
        platform 
      })
      
      return { request: injectedRequest, memories: selectedMemories }
    } catch (e) {
      // 失败降级：返回原始请求
      this.auditor.log('ERROR', { phase: 'retrieveAndInject', error: e.message })
      console.error('[V5] 召回注入失败', e)
      return { request, memories: [] }
    }
  }
  
  /**
   * 处理单轮对话（完整流程）
   */
  async processTurn(input, response, context = {}) {
    const result = {
      input,
      response,
      extracted: [],
      recalled: [],
      injected: [],
      written: [],
      errors: []
    }
    
    try {
      // 1. 召回相关记忆
      result.recalled = await this.recall(input, context)
      
      // 2. 注入记忆到请求
      result.injected = await this.inject(input, result.recalled, context)
      
      // 3. 从响应中提取新记忆
      result.extracted = await this.extract(response, context)
      
      // 4. 写入新记忆
      result.written = await this.write(result.extracted, context)
      
    } catch (error) {
      result.errors.push({
        phase: 'processTurn',
        error: error.message,
        timestamp: new Date().toISOString()
      })
      
      // Fail-Open: 不阻断对话
      console.error('[V5 Meta Engine] Error:', error)
    }
    
    return result
  }
  
  /**
   * 记忆召回
   */
  async recall(input, context = {}) {
    const memories = await this.store.query({
      platform: this.config.platform,
      namespace: this.config.namespace,
      status: 'active'
    })
    
    // V5 势垒方程计算得分
    const scored = memories.map(mem => ({
      ...mem,
      recallScore: calculateRecallScore(
        input,
        mem,
        this.config.gamma,
        this.config.barrier
      )
    }))
    
    // 过滤低于阈值的记忆
    const filtered = scored
      .filter(m => m.recallScore >= this.config.recallThreshold)
      .sort((a, b) => b.recallScore - a.recallScore)
    
    // 按类型配额分配
    return this.allocateBudget(filtered, this.config.budget)
  }
  
  /**
   * 记忆注入
   */
  async inject(input, memories, context = {}) {
    if (!this.platformAdapter) {
      throw new Error('Platform adapter not set')
    }
    
    return injectMemory(input, memories, this.platformAdapter, context)
  }
  
  /**
   * 记忆提取
   */
  async extract(response, context = {}) {
    if (!this.platformAdapter) {
      throw new Error('Platform adapter not set')
    }
    
    return extractMemory(response, this.platformAdapter, context)
  }
  
  /**
   * 记忆写入
   */
  async write(memories, context = {}) {
    const written = []
    
    for (const mem of memories) {
      const writeScore = calculateWriteScore(mem, this.config)
      
      // 检查是否超过阈值
      if (writeScore < this.config.writeThreshold) {
        continue
      }
      
      // 检查敏感信息
      const processed = this.processSensitive(mem)
      
      // 冲突检测与版本链
      const existing = await this.store.findSimilar(processed)
      
      if (existing) {
        // 创建新版本，标记旧版本为 superseded
        processed.meta.relations.supersedes = existing.meta.id
        existing.meta.status = 'superseded'
        await this.store.update(existing)
      }
      
      // 写入新记忆
      const id = await this.store.add(processed)
      written.push({ ...processed, id })
    }
    
    return written
  }
  
  /**
   * 处理敏感信息
   */
  processSensitive(memory) {
    if (!this.config.autoMaskSensitive) {
      return memory
    }
    
    const text = memory.body.text
    let sensitivity = 'normal'
    
    // 检测敏感模式
    for (const pattern of this.config.sensitivityPatterns) {
      if (pattern.test(text)) {
        sensitivity = 'highly_sensitive'
        break
      }
    }
    
    // 脱敏处理
    if (sensitivity === 'highly_sensitive' && !memory.meta.security?.masked) {
      memory.body.text = this.maskSensitive(text)
      memory.meta.security = {
        ...memory.meta.security,
        sensitivity,
        masked: true
      }
    } else {
      memory.meta.security = {
        ...memory.meta.security,
        sensitivity
      }
    }
    
    return memory
  }
  
  /**
   * 脱敏掩码
   */
  maskSensitive(text) {
    return text.replace(/(\d{4,})/g, '****')
               .replace(/(password|api[_-]?key|secret|token)[^\s]*/gi, '****')
  }
  
  /**
   * 配额分配
   */
  allocateBudget(scored, budget) {
    const result = {
      persona: [],
      core: [],
      episodic: []
    }
    
    for (const type of ['persona', 'core', 'episodic']) {
      const items = scored.filter(m => m.body.type === type)
      result[type] = items.slice(0, budget[type])
    }
    
    // 扁平化输出
    return [...result.persona, ...result.core, ...result.episodic]
  }
  
  /**
   * 清理过期记忆
   */
  async cleanup() {
    const all = await this.store.query({
      platform: this.config.platform,
      namespace: this.config.namespace
    })
    
    const now = Date.now()
    let cleaned = 0
    
    for (const mem of all) {
      if (mem.meta.lifecycle.status === 'deleted') continue
      
      const expiresAt = mem.meta.lifecycle.expiresAt
      if (expiresAt && new Date(expiresAt).getTime() < now) {
        mem.meta.status = 'expired'
        await this.store.update(mem)
        cleaned++
      }
    }
    
    return cleaned
  }
  
  /**
   * 导出记忆
   */
  async export(format = 'json') {
    const memories = await this.store.query({
      platform: this.config.platform,
      namespace: this.config.namespace
    })
    
    if (format === 'json') {
      return JSON.stringify(memories, null, 2)
    }
    
    // CSV 格式
    const headers = ['id', 'type', 'text', 'createdAt', 'platform']
    const rows = memories.map(m => [
      m.meta.id, m.body.type, m.body.text, 
      m.meta.lifecycle.createdAt, m.meta.platform
    ])
    
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  }
  
  /**
   * 导入记忆
   */
  async import(data, format = 'json') {
    let memories
    
    if (format === 'json') {
      memories = JSON.parse(data)
    } else {
      throw new Error('Unsupported format')
    }
    
    for (const mem of memories) {
      // 重新生成 ID
      mem.meta.id = `mem_${Date.now()}_${Math.random().toString(36).slice(2)}`
      await this.store.add(mem)
    }
    
    return memories.length
  }
  
  /**
   * 计算输入与记忆的匹配得分
   */
  calculateMatchScore(input, memory) {
    const text = memory.body?.text || ''
    
    // 简单关键词匹配
    const inputWords = new Set(input.toLowerCase().split(/\s+/))
    const memoryWords = new Set(text.toLowerCase().split(/\s+/))
    
    const intersection = [...inputWords].filter(w => memoryWords.has(w))
    const union = new Set([...inputWords, ...memoryWords])
    
    const keywordScore = union.size > 0 ? intersection.size / union.size : 0
    
    // 召回优先级
    const priorityScore = memory.meta?.dimensions?.recall_priority || 0.5
    
    // 时间衰减
    const lastUsed = memory.meta?.lifecycle?.lastUsedAt
    const now = Date.now()
    const daysPassed = lastUsed ? (now - new Date(lastUsed).getTime()) / (1000 * 60 * 60 * 24) : 0
    const timeDecay = Math.pow(0.5, daysPassed / 7)  // 7天半衰期
    
    // 平台权重
    const platformWeight = 1.0
    
    // 类型得分
    const typeScores = { pinned: 1, persona: 0.85, core: 0.7, episodic: 0.5 }
    const typeScore = typeScores[memory.body?.type] || 0.5
    
    // 综合得分
    return (
      keywordScore * 0.35 +
      priorityScore * 0.25 +
      timeDecay * 0.2 +
      platformWeight * 0.1 +
      typeScore * 0.1
    )
  }
  
  /**
   * 按预算裁剪记忆
   */
  cropMemories(sortedMemories) {
    const budget = this.config.budget || { persona: 3, core: 4, episodic: 6 }
    const result = []
    const used = { persona: 0, core: 0, episodic: 0 }
    
    for (const mem of sortedMemories) {
      const type = mem.body?.type || 'episodic'
      
      if (used[type] < (budget[type] || 6)) {
        result.push(mem)
        used[type]++
      }
    }
    
    return result
  }
  
  /**
   * 处理冲突：版本链管理
   */
  async handleConflict(memory) {
    const all = await this.store.query({
      platform: memory.meta?.platform,
      namespace: memory.meta?.namespace,
      status: 'active'
    })
    
    // 简单相似度检测
    for (const existing of all) {
      const similarity = this.textSimilarity(memory.body?.text || '', existing.body?.text || '')
      
      if (similarity > 0.8) {
        // 创建版本链
        memory.meta.relations.supersedes = existing.meta.id
        existing.meta.status = 'superseded'
        await this.store.update(existing)
        
        this.auditor.log('CONFLICT', { 
          oldId: existing.meta.id, 
          newId: memory.meta.id 
        })
        
        return true
      }
    }
    
    return false
  }
  
  /**
   * 文本相似度
   */
  textSimilarity(a, b) {
    if (!a || !b) return 0
    
    const setA = new Set(a.toLowerCase().split(/\s+/))
    const setB = new Set(b.toLowerCase().split(/\s+/))
    
    const intersection = [...setA].filter(x => setB.has(x))
    const union = new Set([...setA, ...setB])
    
    return union.size > 0 ? intersection.size / union.size : 0
  }
  
  /**
   * 敏感信息脱敏
   */
  sanitize(text) {
    if (!text) return {}
    
    // 检测关键词判断置信度和重要性
    const confidence = 0.8
    const importance = /目标|项目|重要/.test(text) ? 0.9 : 0.7
    const freshness = 1
    
    return { confidence, importance, freshness }
  }
  
  /**
   * 构建记忆上下文
   */
  buildContext(memories) {
    if (!memories?.length) return ''
    
    const byType = {
      pinned: [],
      persona: [],
      core: [],
      episodic: []
    }
    
    for (const m of memories) {
      const type = m.body?.type || 'episodic'
      if (byType[type]) byType[type].push(m)
    }
    
    let context = '[Global Memory V5]\n'
    context += `[Meta-Info] Platform: ${this.config.platform}, Namespace: ${this.config.namespace}\n`
    
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
   * 获取配置
   */
  getConfig() {
    return { ...this.config }
  }
  
  /**
   * 更新配置
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig }
    return this.config
  }
  
  /**
   * 获取审计日志
   */
  getAuditLogs(filters) {
    return this.auditor.getLogs(filters)
  }
}

export default V5MetaEngine
