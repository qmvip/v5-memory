/**
 * V5 Memory Compressor - 记忆压缩与摘要生成
 * 
 * 功能：
 * 1. 基于重要性评估的记忆摘要生成
 * 2. 自动压缩低频记忆
 * 3. 保留关键信息
 */

import { v5BarrierEquation, calculateKeywordSimilarity } from '../engine/scorer.js'

/**
 * 压缩级别
 */
export const COMPRESSION_LEVELS = {
  NONE: 0,      // 不压缩
  LIGHT: 1,     // 轻度压缩 (保留70%内容)
  MEDIUM: 2,   // 中度压缩 (保留50%内容)
  HEAVY: 3,    // 重度压缩 (保留30%内容)
  SUMMARY: 4   // 极简摘要
}

/**
 * 摘要生成器
 */
export class MemoryCompressor {
  constructor(options = {}) {
    this.config = {
      // 压缩阈值
      compressionThreshold: options.compressionThreshold || 0.3,
      
      // 保留关键词数量
      keepKeywords: options.keepKeywords || 5,
      
      // 摘要最大长度
      summaryMaxLength: options.summaryMaxLength || 100,
      
      // 压缩级别
      defaultLevel: options.defaultLevel || COMPRESSION_LEVELS.MEDIUM,
      
      ...options
    }
    
    // 关键词提取器
    this.keywordExtractor = new KeywordExtractor()
  }
  
  /**
   * 评估记忆重要性
   */
  evaluateImportance(memory) {
    const now = Date.now()
    const lastUsed = new Date(memory.meta?.lifecycle?.lastUsedAt || 0).getTime()
    const daysSinceUse = (now - lastUsed) / (1000 * 60 * 60 * 24)
    
    // 因素加权
    let score = 0
    
    // 1. 使用频率
    const usageCount = memory.usageCount || 0
    score += Math.min(usageCount / 10, 0.4)  // 最高0.4
    
    // 2. 类型权重
    const typeWeights = { pinned: 1.0, persona: 0.8, core: 0.6, episodic: 0.4 }
    score += typeWeights[memory.body?.type] || 0.3
    
    // 3. 时间衰减
    const timeDecay = Math.pow(0.5, daysSinceUse / 30)  // 30天半衰期
    score += timeDecay * 0.3
    
    // 4. 敏感度（高敏感度降低压缩）
    const sensitivity = memory.meta?.security?.sensitivity
    if (sensitivity === 'highly_sensitive') {
      score *= 0.7
    }
    
    return Math.min(score, 1)
  }
  
  /**
   * 确定压缩级别
   */
  determineCompressionLevel(memory) {
    const importance = this.evaluateImportance(memory)
    
    if (importance > 0.7) return COMPRESSION_LEVELS.NONE
    if (importance > 0.5) return COMPRESSION_LEVELS.LIGHT
    if (importance > 0.3) return COMPRESSION_LEVELS.MEDIUM
    if (importance > 0.15) return COMPRESSION_LEVELS.HEAVY
    return COMPRESSION_LEVELS.SUMMARY
  }
  
  /**
   * 压缩记忆
   */
  compress(memory, level = null) {
    const text = memory.body?.text || ''
    
    if (!text) return memory
    
    // 确定压缩级别
    const compressionLevel = level || this.determineCompressionLevel(memory)
    
    if (compressionLevel === COMPRESSION_LEVELS.NONE) {
      return memory
    }
    
    // 提取关键信息
    const keywords = this.keywordExtractor.extract(text, this.config.keepKeywords)
    const keySentences = this.extractKeySentences(text, compressionLevel)
    
    // 生成摘要
    let compressedText = ''
    switch (compressionLevel) {
      case COMPRESSION_LEVELS.LIGHT:
        compressedText = this.compressLight(text, keywords)
        break
      case COMPRESSION_LEVELS.MEDIUM:
        compressedText = this.compressMedium(text, keywords, keySentences)
        break
      case COMPRESSION_LEVELS.HEAVY:
        compressedText = this.compressHeavy(text, keywords, keySentences)
        break
      case COMPRESSION_LEVELS.SUMMARY:
        compressedText = this.generateSummary(text, keywords)
        break
      default:
        compressedText = text
    }
    
    // 返回压缩后的记忆
    return {
      ...memory,
      body: {
        ...memory.body,
        text: compressedText,
        original_text: text,  // 保留原文
        compression_level: compressionLevel,
        keywords: keywords
      },
      meta: {
        ...memory.meta,
        dimensions: {
          ...memory.meta?.dimensions,
          importance: this.evaluateImportance(memory),
          compressed: true,
          compression_level: compressionLevel
        }
      }
    }
  }
  
  /**
   * 轻度压缩：保留70%
   */
  compressLight(text, keywords) {
    const sentences = text.split(/[。！？\n]/)
    const importantSentences = sentences.filter(s => 
      keywords.some(k => s.includes(k))
    )
    
    if (importantSentences.length > 0) {
      return importantSentences.join('。') + '。'
    }
    
    // 保留前半部分
    return text.substring(0, Math.ceil(text.length * 0.7))
  }
  
  /**
   * 中度压缩：保留50%
   */
  compressMedium(text, keywords, keySentences) {
    const result = keySentences.slice(0, 2).join('。')
    const kwText = `[关键词: ${keywords.slice(0, 3).join(', ')}]`
    
    return `${kwText} ${result}`
  }
  
  /**
   * 重度压缩：保留30%
   */
  compressHeavy(text, keywords, keySentences) {
    const firstKey = keySentences[0] || ''
    const kwText = `[关键词: ${keywords.slice(0, 2).join(', ')}]`
    
    return `${kwText} ${firstKey}`.substring(0, this.config.summaryMaxLength)
  }
  
  /**
   * 极简摘要
   */
  generateSummary(text, keywords) {
    const kwText = keywords.slice(0, 2).join(', ')
    const preview = text.substring(0, 50)
    
    return `[${kwText}] ${preview}...`
  }
  
  /**
   * 提取关键句子
   */
  extractKeySentences(text, level) {
    const sentences = text.split(/[。！？\n]/).filter(s => s.trim().length > 5)
    
    // 评分并排序
    const scored = sentences.map(s => ({
      text: s,
      score: this.scoreSentence(s)
    })).sort((a, b) => b.score - a.score)
    
    const count = Math.ceil(sentences.length * (1 - level * 0.2))
    return scored.slice(0, count).map(s => s.text)
  }
  
  /**
   * 句子评分
   */
  scoreSentence(sentence) {
    let score = 0
    
    // 长度适中得高分
    const len = sentence.length
    if (len > 10 && len < 100) score += 0.3
    else if (len >= 100) score += 0.1
    
    // 包含数字得高分（科学数据）
    if (/\d+/.test(sentence)) score += 0.2
    
    // 包含专业术语得高分
    if (/算法|模型|公式|实验|数据/.test(sentence)) score += 0.3
    
    // 开头权重
    if (/首先|第一|关键|重要/.test(sentence)) score += 0.2
    
    return score
  }
  
  /**
   * 批量压缩
   */
  compressBatch(memories) {
    return memories.map(m => this.compress(m))
  }
  
  /**
   * 解压缩（恢复原文）
   */
  decompress(memory) {
    if (!memory.body?.original_text) {
      return memory  // 未压缩，直接返回
    }
    
    return {
      ...memory,
      body: {
        ...memory.body,
        text: memory.body.original_text,
        compressed: false
      }
    }
  }
}

/**
 * 关键词提取器
 */
class KeywordExtractor {
  /**
   * 提取关键词
   */
  extract(text, count = 5) {
    // 简单分词
    const words = text.toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1)
    
    // 词频统计
    const freq = {}
    for (const word of words) {
      freq[word] = (freq[word] || 0) + 1
    }
    
    // 排序
    const sorted = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([word]) => word)
    
    return sorted
  }
}

/**
 * 创建默认压缩器
 */
export function createCompressor(options = {}) {
  return new MemoryCompressor(options)
}

export default {
  MemoryCompressor,
  createCompressor,
  COMPRESSION_LEVELS
}
