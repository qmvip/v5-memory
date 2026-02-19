/**
 * V5 Memory Retriever - 记忆召回器
 * 
 * 负责根据输入召回最相关的记忆
 */

import { v5Formula, calculateKeywordSimilarity, calculateTimeDecay } from './scorer.js'

/**
 * 召回记忆
 * 
 * @param {string} input - 用户输入
 * @param {Array} memories - 记忆库
 * @param {object} config - 召回配置
 * @returns {Array} 排序后的记忆列表
 */
export async function retrieveMemories(input, memories, config = {}) {
  if (!input || !memories?.length) return []
  
  const {
    gamma = 0.85,
    barrier = 0.5,
    threshold = 0.5,
    maxResults = 20,
    typePriority = { pinned: 3, persona: 2, core: 1.5, episodic: 1 }
  } = config
  
  // 1. 逐条计算召回得分
  const scored = memories.map(memory => {
    const recallScore = calculateRecallScore(
      input,
      memory,
      gamma,
      barrier,
      typePriority
    )
    
    return {
      ...memory,
      recallScore,
      v5Probability: v5Formula(
        recallScore,
        gamma,
        barrier
      )
    }
  })
  
  // 2. 过滤低于阈值的
  const filtered = scored.filter(m => m.recallScore >= threshold)
  
  // 3. 排序（得分 > 类型优先级 > 时间）
  const sorted = filtered.sort((a, b) => {
    // 得分优先
    if (Math.abs(b.recallScore - a.recallScore) > 0.1) {
      return b.recallScore - a.recallScore
    }
    // 类型优先级次之
    const aPriority = typePriority[a.body.type] || 0
    const bPriority = typePriority[b.body.type] || 0
    if (bPriority !== aPriority) return bPriority - aPriority
    // 最后按时间
    return new Date(b.meta.lifecycle.lastUsedAt) - new Date(a.meta.lifecycle.lastUsedAt)
  })
  
  // 4. 返回结果
  return sorted.slice(0, maxResults)
}

/**
 * 计算单条记忆的召回得分
 */
function calculateRecallScore(input, memory, gamma, barrier, typePriority) {
  // 关键词匹配
  const keywordScore = calculateKeywordSimilarity(input, memory.body.text)
  
  // 时间衰减
  const timeScore = calculateTimeDecay(memory.meta.lifecycle.lastUsedAt)
  
  // 类型优先级
  const typeScore = typePriority[memory.body.type] || 1
  
  // 召回优先级维度
  const priorityScore = memory.meta.dimensions?.recall_priority || 0.5
  
  // 平台权重
  const platformWeight = 1.0
  
  // 综合 Input
  const rawScore = (
    keywordScore * 0.35 +
    priorityScore * 0.25 +
    timeScore * 0.2 +
    platformWeight * 0.1 +
    (typeScore / 3) * 0.1  // 归一化类型得分
  )
  
  return rawScore
}

/**
 * 语义召回（预留接口）
 * 
 * @param {string} input - 用户输入
 * @param {Array} memories - 记忆库
 * @param {object} embeddingService - 向量嵌入服务
 * @returns {Promise<Array>} 语义相似的记忆
 */
export async function semanticRetrieve(input, memories, embeddingService) {
  if (!embeddingService) {
    console.warn('[V5 Retriever] No embedding service, falling back to keyword')
    return retrieveMemories(input, memories)
  }
  
  // 获取输入的 embedding
  const inputEmbedding = await embeddingService.embed(input)
  
  // 计算每条记忆的余弦相似度
  const scored = memories.map(memory => {
    const memoryEmbedding = memory.embedding || memory._embedding
    if (!memoryEmbedding) return { ...memory, semanticScore: 0 }
    
    const similarity = cosineSimilarity(inputEmbedding, memoryEmbedding)
    return { ...memory, semanticScore: similarity }
  })
  
  // 排序返回
  return scored
    .filter(m => m.semanticScore >= 0.7)
    .sort((a, b) => b.semanticScore - a.semanticScore)
}

/**
 * 余弦相似度
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0
  
  let dotProduct = 0
  let normA = 0
  let normB = 0
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * 构建召回上下文
 * 
 * @param {Array} memories - 召回的记忆
 * @param {string} format - 输出格式
 * @returns {string} 格式化的记忆上下文
 */
export function buildRecallContext(memories, format = 'v5') {
  if (!memories?.length) return ''
  
  if (format === 'v5') {
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
    context += `[Meta-Info] Platform: memories, Namespace: v5\n`
    
    if (byType.pinned.length) {
      context += '\n[Pinned]\n'
      context += byType.pinned.map(m => `- ${m.body.text}`).join('\n')
    }
    
    if (byType.persona.length) {
      context += '\n[Persona]\n'
      context += byType.persona.map(m => `- ${m.body.text}`).join('\n')
    }
    
    if (byType.core.length) {
      context += '\n[Core]\n'
      context += byType.core.map(m => `- ${m.body.text}`).join('\n')
    }
    
    if (byType.episodic.length) {
      context += '\n[Relevant Details]\n'
      context += byType.episodic.map(m => `- ${m.body.text}`).join('\n')
    }
    
    context += '\n[Meta-Rule] Use memory as supportive context. Prioritize current instruction if conflict.'
    
    return context
  }
  
  // 简单格式
  return memories.map(m => `- ${m.body.text}`).join('\n')
}

export default {
  retrieveMemories,
  semanticRetrieve,
  buildRecallContext
}
