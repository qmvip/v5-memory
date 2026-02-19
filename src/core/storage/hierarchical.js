/**
 * V5 Hierarchical Storage - 分层存储
 * 
 * 内存层级：
 * - Hot: <7天访问，完整细节
 * - Warm: 7-30天访问，摘要
 * - Cold: >30天访问，极简摘要
 */

import { FileSystemStore } from '../storage/memory_store.js'
import { MemoryCompressor, COMPRESSION_LEVELS } from '../compression/compressor.js'

/**
 * 存储层级
 */
export const STORAGE_TIERS = {
  HOT: {
    name: 'hot',
    maxAge: 7 * 24 * 60 * 60 * 1000,  // 7天
    compression: COMPRESSION_LEVELS.NONE,
    storage: 'memory'
  },
  WARM: {
    name: 'warm',
    maxAge: 30 * 24 * 60 * 60 * 1000,  // 30天
    compression: COMPRESSION_LEVELS.MEDIUM,
    storage: 'file'
  },
  COLD: {
    name: 'cold',
    maxAge: Infinity,
    compression: COMPRESSION_LEVELS.SUMMARY,
    storage: 'file'
  }
}

/**
 * 分层存储管理器
 */
export class HierarchicalStorage {
  constructor(options = {}) {
    this.config = {
      basePath: options.basePath || './data/memories',
      tierConfig: options.tierConfig || STORAGE_TIERS,
      autoCompress: options.autoCompress ?? true,
      compressionInterval: options.compressionInterval || 24 * 60 * 60 * 1000,  // 24小时
      ...options
    }
    
    // 内存缓存 (Hot层)
    this.hotCache = new Map()
    
    // 文件存储
    this.warmStore = new FileSystemStore({
      basePath: `${this.config.basePath}/warm`,
      namespace: 'default'
    })
    
    this.coldStore = new FileSystemStore({
      basePath: `${this.config.basePath}/cold`,
      namespace: 'default'
    })
    
    // 压缩器
    this.compressor = new MemoryCompressor()
    
    // 初始化
    this.initialized = false
  }
  
  /**
   * 初始化
   */
  async init() {
    if (this.initialized) return this
    
    // 加载 warm 和 cold 层到内存
    await this.rebuildCache()
    
    this.initialized = true
    return this
  }
  
  /**
   * 重建缓存
   */
  async rebuildCache() {
    // 从 warm 层加载
    const warmMemories = await this.warmStore.query({})
    for (const mem of warmMemories) {
      this.hotCache.set(mem.meta.id, mem)
    }
    
    // 从 cold 层加载元信息
    const coldMemories = await this.coldStore.query({})
    for (const mem of coldMemories) {
      this.hotCache.set(mem.meta.id, {
        ...mem,
        body: {
          ...mem.body,
          text: mem.body.summary || mem.body.text  // 使用摘要
        }
      })
    }
    
    return this
  }
  
  /**
   * 确定存储层级
   */
  determineTier(memory) {
    const now = Date.now()
    const lastUsed = new Date(memory.meta?.lifecycle?.lastUsedAt || now).getTime()
    const age = now - lastUsed
    
    const { tierConfig } = this.config
    
    if (age < tierConfig.HOT.maxAge) {
      return 'hot'
    } else if (age < tierConfig.WARM.maxAge) {
      return 'warm'
    } else {
      return 'cold'
    }
  }
  
  /**
   * 添加记忆
   */
  async add(memory) {
    // 确定层级
    const tier = this.determineTier(memory)
    
    // 添加到对应层级
    const stored = await this.storeToTier(memory, tier)
    
    // 更新缓存
    this.hotCache.set(stored.meta.id, stored)
    
    return stored
  }
  
  /**
   * 存储到指定层级
   */
  async storeToTier(memory, tier) {
    let processed = memory
    
    // 根据层级决定是否压缩
    if (this.config.autoCompress) {
      const compressionLevel = this.getCompressionLevel(tier)
      processed = this.compressor.compress(memory, compressionLevel)
    }
    
    // 添加层级元信息
    processed.meta.storage_tier = tier
    processed.meta.last_migrated = new Date().toISOString()
    
    // 存储
    if (tier === 'hot') {
      this.hotCache.set(processed.meta.id, processed)
    } else if (tier === 'warm') {
      await this.warmStore.add(processed)
    } else {
      await this.coldStore.add(processed)
    }
    
    return processed
  }
  
  /**
   * 获取压缩级别
   */
  getCompressionLevel(tier) {
    const levels = {
      hot: COMPRESSION_LEVELS.NONE,
      warm: COMPRESSION_LEVELS.MEDIUM,
      cold: COMPRESSION_LEVELS.SUMMARY
    }
    return levels[tier] || COMPRESSION_LEVELS.MEDIUM
  }
  
  /**
   * 获取记忆
   */
  async get(id) {
    // 先从缓存获取
    if (this.hotCache.has(id)) {
      const mem = this.hotCache.get(id)
      // 更新访问时间
      await this.touch(id)
      return mem
    }
    
    // 从 warm 层获取
    let mem = await this.warmStore.get(id)
    if (mem) {
      await this.migrateToTier(id, 'hot')
      return this.hotCache.get(id)
    }
    
    // 从 cold 层获取
    mem = await this.coldStore.get(id)
    if (mem) {
      await this.migrateToTier(id, 'warm')
      return this.hotCache.get(id)
    }
    
    return null
  }
  
  /**
   * 更新记忆
   */
  async update(memory) {
    const tier = this.determineTier(memory)
    
    if (tier === 'hot') {
      this.hotCache.set(memory.meta.id, memory)
    } else if (tier === 'warm') {
      await this.warmStore.update(memory)
    } else {
      await this.coldStore.update(memory)
    }
    
    // 每次更新都提升到 hot 层
    await this.migrateToTier(memory.meta.id, 'hot')
    
    return memory
  }
  
  /**
   * 删除记忆
   */
  async delete(id) {
    // 从缓存删除
    this.hotCache.delete(id)
    
    // 从各层删除
    await this.warmStore.delete(id)
    await this.coldStore.delete(id)
    
    return true
  }
  
  /**
   * 查询记忆
   */
  async query(filters = {}) {
    const results = []
    
    // 从缓存查询 hot 层
    let hotResults = Array.from(this.hotCache.values())
    
    // 应用过滤器
    hotResults = hotResults.filter(m => this.matchesFilters(m, filters))
    results.push(...hotResults)
    
    // 如果需要完整结果，也查询 warm 和 cold
    if (filters.includeAllTiers) {
      const warmResults = await this.warmStore.query(filters)
      const coldResults = await this.coldStore.query(filters)
      
      // 去重
      const ids = new Set(results.map(m => m.meta.id))
      for (const m of [...warmResults, ...coldResults]) {
        if (!ids.has(m.meta.id)) {
          results.push(m)
        }
      }
    }
    
    return results
  }
  
  /**
   * 匹配过滤器
   */
  matchesFilters(memory, filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (key === 'status') {
        if (memory.meta?.lifecycle?.status !== value) return false
      } else if (key === 'platform') {
        if (memory.meta?.platform !== value) return false
      } else if (key === 'type') {
        if (memory.body?.type !== value) return false
      } else if (key === 'tier') {
        if (memory.meta?.storage_tier !== value) return false
      }
    }
    return true
  }
  
  /**
   * 触达更新（更新时间）
   */
  async touch(id) {
    const mem = this.hotCache.get(id)
    if (!mem) return
    
    mem.meta.lifecycle.lastUsedAt = new Date().toISOString()
    
    // 检查是否需要降层
    const newTier = this.determineTier(mem)
    if (newTier !== mem.meta.storage_tier) {
      await this.migrateToTier(id, newTier)
    }
  }
  
  /**
   * 层级迁移
   */
  async migrateToTier(id, targetTier) {
    const currentMem = this.hotCache.get(id)
    if (!currentMem) return
    
    const currentTier = currentMem.meta?.storage_tier || 'hot'
    
    if (currentTier === targetTier) return
    
    // 从原层级删除
    if (currentTier === 'hot') {
      this.hotCache.delete(id)
    } else if (currentTier === 'warm') {
      await this.warmStore.delete(id)
    } else {
      await this.coldStore.delete(id)
    }
    
    // 添加到目标层级
    await this.storeToTier(currentMem, targetTier)
  }
  
  /**
   * 定时压缩任务
   */
  async runCompressionCycle() {
    console.log('[HierarchicalStorage] Running compression cycle...')
    
    const allMemories = Array.from(this.hotCache.values())
    
    for (const mem of allMemories) {
      const currentTier = mem.meta?.storage_tier || 'hot'
      const targetTier = this.determineTier(mem)
      
      if (currentTier !== targetTier) {
        await this.migrateToTier(mem.meta.id, targetTier)
      }
    }
    
    console.log('[HierarchicalStorage] Compression cycle complete')
  }
  
  /**
   * 获取统计信息
   */
  async getStats() {
    const hot = this.hotCache.size
    const warm = await this.warmStore.count({})
    const cold = await this.coldStore.count({})
    
    return {
      hot,
      warm,
      cold,
      total: hot + warm + cold
    }
  }
  
  /**
   * 清理过期记忆
   */
  async cleanup() {
    const coldMemories = await this.coldStore.query({})
    let cleaned = 0
    
    for (const mem of coldMemories) {
      const lastUsed = new Date(mem.meta?.lifecycle?.lastUsedAt || 0).getTime()
      const daysSinceUse = (Date.now() - lastUsed) / (1000 * 60 * 60 * 24)
      
      // 超过180天彻底删除
      if (daysSinceUse > 180) {
        await this.coldStore.delete(mem.meta.id)
        cleaned++
      }
    }
    
    return cleaned
  }
}

export default {
  HierarchicalStorage,
  STORAGE_TIERS
}
