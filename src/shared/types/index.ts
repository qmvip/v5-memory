/**
 * V5 Memory Types - TypeScript 类型定义
 */

// 记忆元数据
export interface V5MemoryMeta {
  id: string
  version: string
  platform: string
  namespace: string
  tags: string[]
  dimensions: V5Dimensions
  relations: V5Relations
  lifecycle: V5Lifecycle
  security: V5Security
}

// V5 维度
export interface V5Dimensions {
  confidence: number      // 置信度 0-1
  importance: number      // 重要性 0-1
  time_decay: number      // 时间衰减因子 0-1
  recall_priority: number // 召回优先级 0-1
}

// V5 关联
export interface V5Relations {
  supersedes: string | null    // 替代的记忆 ID
  related_to: string[]         // 关联的记忆 ID
  conversation_id: string | null
  turn_id: string | null
}

// V5 生命周期
export interface V5Lifecycle {
  createdAt: string
  updatedAt: string
  lastUsedAt: string
  expiresAt: string | null
  ttl: number          // 过期时间（秒）
  status: 'active' | 'superseded' | 'deleted' | 'expired'
}

// V5 安全
export interface V5Security {
  sensitivity: 'normal' | 'sensitive' | 'highly_sensitive'
  masked: boolean
  origin: 'auto' | 'manual'
}

// 记忆本体
export interface V5MemoryBody {
  type: 'persona' | 'core' | 'episodic' | 'pinned'
  text: string
  raw_content?: string
}

// 完整记忆条目
export interface V5Memory {
  meta: V5MemoryMeta
  body: V5MemoryBody
}

// 记忆条目（带召回得分）
export interface V5MemoryWithScore extends V5Memory {
  recallScore: number
  v5Probability?: number
}

// 引擎配置
export interface V5EngineConfig {
  gamma: number           // 系统响应强度
  barrier: number         // 临界阈值
  recallThreshold: number // 召回阈值
  writeThreshold: number  // 写入阈值
  platform: string        // 当前平台
  namespace: string       // 命名空间
  budget: {               // 注入配额
    persona: number
    core: number
    episodic: number
  }
  ttl: number             // 默认过期时间
  autoMaskSensitive: boolean
  sensitivityPatterns: RegExp[]
}

// 平台适配器接口
export interface V5PlatformAdapter {
  name: string
  parseRequest(request: any): string
  parseResponse(response: any): string
  inject(input: string, context: string): string
}

// 召回结果
export interface V5RecallResult {
  original: string
  injected: string
  memories: V5MemoryWithScore[]
  count: number
}

// 处理结果
export interface V5ProcessResult {
  input: string
  response: string
  extracted: V5Memory[]
  recalled: V5MemoryWithScore[]
  injected: V5RecallResult[]
  written: V5Memory[]
  errors: V5Error[]
}

// 错误信息
export interface V5Error {
  phase: string
  error: string
  timestamp: string
}

// 统计信息
export interface V5Stats {
  total: number
  byType: Record<string, number>
  byPlatform: Record<string, number>
  byStatus: Record<string, number>
}

// 平台类型
export type PlatformType = 
  | 'chatgpt' 
  | 'claude' 
  | 'deepseek' 
  | 'gemini'
  | 'cursor'
  | 'windsurf'
  | 'cline'

// 记忆类型
export type MemoryType = 
  | 'persona' 
  | 'core' 
  | 'episodic' 
  | 'pinned'

// 引擎模式
export type EngineMode = 
  | 'complete' 
  | 'web' 
  | 'ide'
