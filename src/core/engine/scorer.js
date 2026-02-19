/**
 * V5 Scorer - 势垒方程计算器
 * 
 * 核心公式：
 * P = 1 / (1 + e^(-2γ(Input - B)))
 * 
 * 方程本质：Sigmoid 函数变体，将「输入匹配度」映射为 0-1 之间的「记忆激活概率」
 * 实现记忆召回/写入的量化决策
 * 
 * @author V5 Meta-Structure
 * @version 1.0.0
 */

/**
 * V5 势垒方程 - 核心计算
 * 
 * @param {number} input - 输入匹配度 (0-1)
 * @param {number} gamma - 系统响应强度 γ (默认 0.85)
 * @param {number} barrier - 临界阈值 B (默认 0.5)
 * @returns {number} 概率 P (0-1)
 */
export function v5Formula(input, gamma = 0.85, barrier = 0.5) {
  // 边界校验：确保输入在 0-1 范围内
  const normalizedInput = Math.max(0, Math.min(1, input))
  
  // V5 势垒方程：P = 1 / (1 + e^(-2γ(Input-B)))
  const exponent = -2 * gamma * (normalizedInput - barrier)
  const p = 1 / (1 + Math.exp(exponent))
  
  return parseFloat(p.toFixed(4)) // 保留4位小数
}

// V5 势垒方程别名（兼容 TypeScript 风格）
export const v5BarrierEquation = v5Formula

/**
 * 记忆类型阈值配置
 */
export const MEMORY_TYPE_THRESHOLDS = {
  persona: 0.8,    // 用户画像：严格门槛
  core: 0.6,      // 核心记忆：中高门槛
  episodic: 0.4,  // 情境记忆：中等门槛
  pinned: 1.0     // 置顶记忆：最高门槛
}

/**
 * 类型优先级得分
 */
export function getTypeScore(type) {
  const typeScores = {
    pinned: 1.0,
    persona: 0.85,
    core: 0.7,
    episodic: 0.5
  }
  return typeScores[type] || 0.5
}

/**
 * 判断记忆类型
 */
export function judgeMemoryType(text, context = {}) {
  // 置顶记忆：明确标记
  if (context.isPinned) return 'pinned'
  
  // 用户画像特征
  const personaPatterns = [/喜欢|偏好|通常|习惯/]
  for (const pattern of personaPatterns) {
    if (pattern.test(text)) return 'persona'
  }
  
  // 核心记忆特征
  const corePatterns = [/目标|项目|正在|当前|计划/]
  for (const pattern of corePatterns) {
    if (pattern.test(text)) return 'core'
  }
  
  // 情境记忆：默认
  return 'episodic'
}

/**
 * 计算记忆召回得分
 * 
 * @param {string} input - 用户输入
 * @param {object} memory - 记忆条目
 * @param {number} gamma - 系统响应强度
 * @param {number} barrier - 临界阈值
 * @returns {number} 召回得分 (0-1)
 */
export function calculateRecallScore(input, memory, gamma = 0.85, barrier = 0.5) {
  // 1. 关键词匹配度
  const keywordScore = calculateKeywordSimilarity(input, memory.body.text)
  
  // 2. 时间衰减因子
  const timeDecay = calculateTimeDecay(memory.meta.lifecycle.lastUsedAt)
  
  // 3. 召回优先级
  const priorityScore = memory.meta.dimensions?.recall_priority || 0.5
  
  // 4. 平台适配权重
  const platformWeight = memory.meta.platform === 'deepseek' ? 1.0 : 0.9
  
  // 综合 Input 计算
  const inputScore = (
    keywordScore * 0.3 +
    priorityScore * 0.3 +
    timeDecay * 0.2 +
    platformWeight * 0.2
  )
  
  // 应用 V5 势垒方程
  return v5Formula(inputScore, gamma, barrier)
}

/**
 * 计算记忆写入得分
 * 
 * @param {object} memory - 待写入的记忆
 * @param {object} config - 引擎配置
 * @returns {number} 写入得分 (0-1)
 */
export function calculateWriteScore(memory, config = {}) {
  const {
    confidence = 0.8,
    importance = 0.7,
    platformWeight = 1.0,
    freshness = 0.8
  } = memory.meta.dimensions || {}
  
  // 加权计算
  const score = (
    (confidence || 0.8) * 0.4 +
    (importance || 0.7) * 0.3 +
    platformWeight * 0.2 +
    freshness * 0.1
  )
  
  return score
}

/**
 * 关键词相似度计算
 * 
 * @param {string} text1 - 文本1
 * @param {string} text2 - 文本2
 * @returns {number} 相似度 (0-1)
 */
export function calculateKeywordSimilarity(text1, text2) {
  if (!text1 || !text2) return 0
  
  const words1 = new Set(normalizeText(text1))
  const words2 = new Set(normalizeText(text2))
  
  if (words1.size === 0 || words2.size === 0) return 0
  
  // Jaccard 相似度
  const intersection = new Set([...words1].filter(x => words2.has(x)))
  const union = new Set([...words1, ...words2])
  
  return intersection.size / union.size
}

/**
 * 文本归一化
 */
function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1)
}

/**
 * 时间衰减计算
 * 
 * @param {string|Date} lastUsed - 上次使用时间
 * @param {number} halfLife - 半衰期（天）
 * @returns {number} 衰减因子 (0-1)
 */
export function calculateTimeDecay(lastUsed, halfLife = 7) {
  if (!lastUsed) return 1
  
  const last = new Date(lastUsed).getTime()
  const now = Date.now()
  const daysPassed = (now - last) / (1000 * 60 * 60 * 24)
  
  // 指数衰减: factor = 0.5^(days / halfLife)
  return Math.pow(0.5, daysPassed / halfLife)
}

/**
 * 批量计算召回得分
 * 
 * @param {string} input - 用户输入
 * @param {Array} memories - 记忆列表
 * @param {number} gamma - 系统响应强度
 * @param {number} barrier - 临界阈值
 * @returns {Array} 带得分的记忆列表
 */
export function batchCalculateRecall(input, memories, gamma = 0.85, barrier = 0.5) {
  return memories.map(memory => ({
    ...memory,
    recallScore: calculateRecallScore(input, memory, gamma, barrier)
  }))
    .sort((a, b) => b.recallScore - a.recallScore)
}

/**
 * 动态调整势垒参数
 * 
 * 根据用户反馈或上下文自动调整 γ 和 B
 * 
 * @param {object} params - 当前参数
 * @param {object} feedback - 反馈数据
 * @returns {object} 调整后的参数
 */
export function adjustV5Params(params, feedback = {}) {
  let { gamma = 0.85, barrier = 0.5 } = params
  
  // 用户标记为"不相关"时，提高阈值
  if (feedback.irrelevant) {
    return {
      gamma: Math.min(gamma * 1.1, 1.5),  // 提高敏感度
      barrier: Math.min(barrier + 0.05, 0.9)
    }
  }
  
  // 用户标记为"有用"时，降低阈值
  if (feedback.useful) {
    return {
      gamma: Math.max(gamma * 0.9, 0.5),
      barrier: Math.max(barrier - 0.05, 0.3)
    }
  }
  
  return { gamma, barrier }
}

/**
 * 势垒方程可视化（用于调试）
 */
export function visualizeV5Curve(gamma = 0.85, barrier = 0.5) {
  console.log(`\nV5 势垒曲线 (γ=${gamma}, B=${barrier})`)
  console.log('Input → Probability')
  console.log('-'.repeat(40))
  
  for (let input = 0; input <= 1; input += 0.1) {
    const p = v5Formula(input, gamma, barrier)
    const bar = '█'.repeat(Math.round(p * 20))
    console.log(`${input.toFixed(1)} → ${p.toFixed(4)} | ${bar}`)
  }
}

export default {
  v5Formula,
  v5BarrierEquation,
  calculateRecallScore,
  calculateWriteScore,
  calculateKeywordSimilarity,
  calculateTimeDecay,
  getTypeScore,
  MEMORY_TYPE_THRESHOLDS,
  judgeMemoryType,
  batchCalculateRecall,
  adjustV5Params,
  visualizeV5Curve
}
