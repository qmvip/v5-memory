/**
 * V5 Memory Extractor - 记忆提取器
 * 
 * 从大模型响应中提取有价值的信息并结构化
 */

import { v5Formula } from './scorer.js'

/**
 * 从响应中提取记忆
 * 
 * @param {string|object} response - 大模型响应
 * @param {object} adapter - 平台适配器
 * @param {object} context - 上下文信息
 * @returns {Array} 提取的记忆列表
 */
export async function extractMemory(response, adapter, context = {}) {
  const text = typeof response === 'string' 
    ? response 
    : adapter.parseResponse?.(response) || JSON.stringify(response)
  
  // 1. 解析响应文本
  const parsed = adapter.parseResponse?.(response) || text
  
  // 2. 使用 LLM 或规则提取关键信息
  const candidates = await extractCandidates(parsed, context)
  
  // 3. 过滤并评分
  const filtered = candidates
    .map(c => ({
      ...c,
      score: scoreExtraction(c, text)
    }))
    .filter(c => c.score >= 0.4)
  
  // 4. 去重
  return deduplicate(filtered)
}

/**
 * 提取候选记忆
 */
async function extractCandidates(text, context) {
  const candidates = []
  
  // 1. 用户画像提取（偏好、风格、习惯）
  const personaPatterns = [
    /我喜欢(.+?)[。，]/g,
    /我偏好(.+?)[。，]/g,
    /我通常(.+?)[。，]/g,
    /我喜欢(.+?)、(.+?)/g,
    /我的(.+?)是(.+?)[，。]/
  ]
  
  for (const pattern of personaPatterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      candidates.push({
        type: 'persona',
        text: match[0],
        keyInfo: match.slice(1).join(' '),
        dimensions: {
          confidence: 0.8,
          importance: 0.7,
          time_decay: 0.9,
          recall_priority: 1
        }
      })
    }
  }
  
  // 2. 核心记忆提取（目标、约束、项目）
  const corePatterns = [
    /我正在(.+?)[做进行]/g,
    /我的目标是(.+?)[。，]/g,
    /我需要(.+?)[。，]/g,
    /当前在(.+?)[阶段]/g,
    /项目(.+?)[是]/g
  ]
  
  for (const pattern of corePatterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      candidates.push({
        type: 'core',
        text: match[0],
        keyInfo: match[1],
        dimensions: {
          confidence: 0.75,
          importance: 0.85,
          time_decay: 0.8,
          recall_priority: 0.9
        }
      })
    }
  }
  
  // 3. 情境记忆提取（细节、上下文）
  const episodicPatterns = [
    /(?:上次|之前|刚才|今天|昨天)(.+?)[，。]/g,
    /在那(.+?)[时候]/g,
    /关于(.+?)[，]/g
  ]
  
  for (const pattern of episodicPatterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      candidates.push({
        type: 'episodic',
        text: match[0],
        keyInfo: match[1],
        dimensions: {
          confidence: 0.6,
          importance: 0.5,
          time_decay: 0.5,
          recall_priority: 0.5
        }
      })
    }
  }
  
  // 4. 如果没有匹配，返回空（避免无意义提取）
  return candidates
}

/**
 * 评分提取候选
 */
function scoreExtraction(candidate, fullText) {
  let score = 0.5
  
  // 文本长度适中得高分
  const len = candidate.text.length
  if (len >= 10 && len <= 100) score += 0.2
  else if (len > 100) score -= 0.1
  
  // 包含明确主体代词得高分
  if (/我|我们|本人/.test(candidate.text)) score += 0.15
  
  // 类型权重
  const typeWeights = {
    persona: 0.9,
    core: 0.85,
    episodic: 0.7
  }
  score *= typeWeights[candidate.type] || 0.5
  
  // 避免重复信息
  const duplicates = fullText.split(candidate.text).length - 1
  if (duplicates > 1) score *= 0.8
  
  return Math.min(score, 1)
}

/**
 * 去重
 */
function deduplicate(candidates) {
  const seen = new Set()
  const result = []
  
  for (const c of candidates) {
    // 简单去重：归一化后比较
    const normalized = c.text.toLowerCase().replace(/\s/g, '')
    if (!seen.has(normalized)) {
      seen.add(normalized)
      result.push(c)
    }
  }
  
  return result
}

/**
 * 创建标准记忆结构
 * 
 * @param {object} candidate - 提取候选
 * @param {object} context - 上下文
 * @returns {object} 标准化的记忆条目
 */
export function createMemoryEntry(candidate, context = {}) {
  const now = new Date().toISOString()
  
  return {
    meta: {
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      version: 'v1.0',
      platform: context.platform || 'unknown',
      namespace: context.namespace || 'default',
      tags: inferTags(candidate.text),
      dimensions: candidate.dimensions || {
        confidence: 0.7,
        importance: 0.6,
        time_decay: 0.8,
        recall_priority: 0.7
      },
      relations: {
        conversation_id: context.conversationId || null,
        turn_id: context.turnId || null,
        supersedes: null,
        related_to: []
      },
      lifecycle: {
        createdAt: now,
        updatedAt: now,
        lastUsedAt: now,
        expiresAt: new Date(Date.now()() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        ttl: 30 * 24 * 60 * 60,
        status: 'active'
      },
      security: {
        sensitivity: 'normal',
        masked: false,
        origin: 'auto'
      }
    },
    body: {
      type: candidate.type || 'episodic',
      text: candidate.text,
      raw_content: candidate.rawContent || ''
    }
  }
}

/**
 * 推断标签
 */
function inferTags(text) {
  const tags = []
  const textLower = text.toLowerCase()
  
  // 语言标签
  if (/[a-z]/.test(text)) tags.push('english')
  if (/[\u4e00-\u9fff]/.test(text)) tags.push('chinese')
  
  // 领域标签
  const domainTags = {
    '技术|编程|代码|开发': 'tech',
    '设计|UI|UX|视觉': 'design',
    '写作|文章|内容': 'writing',
    '商务|商业|营销': 'business',
    '个人|生活|习惯': 'personal'
  }
  
  for (const [pattern, tag] of Object.entries(domainTags)) {
    if (new RegExp(pattern).test(textLower)) {
      tags.push(tag)
    }
  }
  
  return tags.length ? tags : ['general']
}

export default {
  extractMemory,
  createMemoryEntry
}
