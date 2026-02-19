/**
 * V5 Hybrid Retriever - 混合检索
 * 
 * 多路检索：
 * 1. BM25 关键词检索
 * 2. 向量相似度检索
 * 3. 知识图谱检索
 * 
 * + Reranking 重排序
 */

import { v5BarrierEquation } from '../engine/scorer.js'

/**
 * 混合检索器
 */
export class HybridRetriever {
  constructor(options = {}) {
    this.config = {
      // 检索权重
      keywordWeight: options.keywordWeight || 0.3,
      vectorWeight: options.vectorWeight || 0.5,
      graphWeight: options.graphWeight || 0.2,
      
      // 重排序
      enableRerank: options.enableRerank ?? true,
      rerankTopK: options.rerankTopK || 20,
      
      // 向量服务（可选）
      vectorService: options.vectorService || null,
      
      // 知识图谱（可选）
      knowledgeGraph: options.knowledgeGraph || null,
      
      // 阈值
      minScore: options.minScore || 0.3,
      
      ...options
    }
    
    // BM25 索引
    this.bm25Index = new BM25Index()
  }
  
  /**
   * 初始化索引
   */
  async index(memories) {
    console.log('[HybridRetriever] Building index...')
    
    for (const mem of memories) {
      const text = mem.body?.text || ''
      const id = mem.meta?.id
      
      if (id && text) {
        this.bm25Index.add(id, text)
      }
    }
    
    console.log(`[HybridRetriever] Indexed ${memories.length} memories`)
    return this
  }
  
  /**
   * 混合检索
   */
  async retrieve(query, memories, options = {}) {
    const {
      keywordWeight = this.config.keywordWeight,
      vectorWeight = this.config.vectorWeight,
      graphWeight = this.config.graphWeight,
      topK = 10
    } = options
    
    // 并行执行三路检索
    const [keywordResults, vectorResults, graphResults] = await Promise.all([
      this.keywordSearch(query, memories),
      this.vectorSearch(query, memories),
      this.graphSearch(query, memories)
    ])
    
    // 合并结果
    const merged = this.mergeResults(
      keywordResults,
      vectorResults,
      graphResults,
      { keywordWeight, vectorWeight, graphWeight }
    )
    
    // 过滤低分
    const filtered = merged.filter(r => r.score >= this.config.minScore)
    
    // 重排序
    let results = filtered
    if (this.config.enableRerank) {
      results = await this.rerank(query, filtered)
    }
    
    // 返回 Top K
    return results.slice(0, topK)
  }
  
  /**
   * BM25 关键词检索
   */
  async keywordSearch(query, memories) {
    const queryTerms = this.tokenize(query)
    
    if (queryTerms.length === 0) {
      return []
    }
    
    const scores = []
    
    for (const mem of memories) {
      const text = mem.body?.text || ''
      const memTerms = this.tokenize(text)
      
      // 计算 BM25 得分
      const score = this.bm25Score(queryTerms, memTerms, this.bm25Index.getDocCount())
      
      if (score > 0) {
        scores.push({
          id: mem.meta?.id,
          memory: mem,
          score: Math.min(score, 1),  // 归一化
          source: 'keyword'
        })
      }
    }
    
    return scores.sort((a, b) => b.score - a.score)
  }
  
  /**
   * 向量检索
   */
  async vectorSearch(query, memories) {
    // 如果没有向量服务，返回空
    if (!this.config.vectorService) {
      return this.fallbackVectorSearch(query, memories)
    }
    
    try {
      // 获取查询向量
      const queryEmbedding = await this.config.vectorService.embed(query)
      
      const scores = []
      
      for (const mem of memories) {
        const embedding = mem.embedding || mem._embedding
        if (!embedding) continue
        
        // 余弦相似度
        const similarity = this.cosineSimilarity(queryEmbedding, embedding)
        
        scores.push({
          id: mem.meta?.id,
          memory: mem,
          score: similarity,
          source: 'vector'
        })
      }
      
      return scores.sort((a, b) => b.score - a.score)
    } catch (error) {
      console.warn('[HybridRetriever] Vector search failed:', error)
      return this.fallbackVectorSearch(query, memories)
    }
  }
  
  /**
   * 回退到简单向量搜索
   */
  fallbackVectorSearch(query, memories) {
    // 使用关键词相似度作为回退
    const queryTerms = new Set(this.tokenize(query))
    
    const scores = []
    
    for (const mem of memories) {
      const text = mem.body?.text || ''
      const memTerms = new Set(this.tokenize(text))
      
      // Jaccard 相似度
      const intersection = [...queryTerms].filter(t => memTerms.has(t))
      const union = new Set([...queryTerms, ...memTerms])
      const similarity = union.size > 0 ? intersection.size / union.size : 0
      
      if (similarity > 0) {
        scores.push({
          id: mem.meta?.id,
          memory: mem,
          score: similarity,
          source: 'vector'
        })
      }
    }
    
    return scores.sort((a, b) => b.score - a.score)
  }
  
  /**
   * 知识图谱检索
   */
  async graphSearch(query, memories) {
    // 如果没有图谱，返回空
    if (!this.config.knowledgeGraph) {
      return []
    }
    
    try {
      // 从查询中提取实体
      const entities = this.extractEntities(query)
      
      if (entities.length === 0) {
        return []
      }
      
      // 查找相关记忆
      const scores = []
      
      for (const mem of memories) {
        const memEntities = this.extractEntities(mem.body?.text || '')
        
        // 计算实体重叠
        const overlap = entities.filter(e => memEntities.includes(e))
        
        if (overlap.length > 0) {
          const score = overlap.length / Math.max(entities.length, memEntities.length)
          
          scores.push({
            id: mem.meta?.id,
            memory: mem,
            score,
            source: 'graph',
            entities: overlap
          })
        }
      }
      
      return scores.sort((a, b) => b.score - a.score)
    } catch (error) {
      console.warn('[HybridRetriever] Graph search failed:', error)
      return []
    }
  }
  
  /**
   * 合并结果
   */
  mergeResults(keywordResults, vectorResults, graphResults, weights) {
    const { keywordWeight, vectorWeight, graphWeight } = weights
    
    // 构建 ID 到记忆的映射
    const memoryMap = new Map()
    
    // 添加关键词结果
    for (const r of keywordResults) {
      memoryMap.set(r.id, {
        id: r.id,
        memory: r.memory,
        scores: { keyword: r.score },
        finalScore: r.score * keywordWeight
      })
    }
    
    // 合并向量结果
    for (const r of vectorResults) {
      const existing = memoryMap.get(r.id)
      if (existing) {
        existing.scores.vector = r.score
        existing.finalScore += r.score * vectorWeight
      } else {
        memoryMap.set(r.id, {
          id: r.id,
          memory: r.memory,
          scores: { vector: r.score },
          finalScore: r.score * vectorWeight
        })
      }
    }
    
    // 合并图谱结果
    for (const r of graphResults) {
      const existing = memoryMap.get(r.id)
      if (existing) {
        existing.scores.graph = r.score
        existing.finalScore += r.score * graphWeight
      } else {
        memoryMap.set(r.id, {
          id: r.id,
          memory: r.memory,
          scores: { graph: r.score },
          finalScore: r.score * graphWeight
        })
      }
    }
    
    // 转换为数组并排序
    return Array.from(memoryMap.values())
      .sort((a, b) => b.finalScore - a.finalScore)
  }
  
  /**
   * 重排序
   */
  async rerank(query, results) {
    // 简单重排序：结合原始相关性和多样性
    const reranked = []
    const usedTypes = new Set()
    
    for (const r of results) {
      const type = r.memory.body?.type || 'episodic'
      
      // 优先选择不同类型的记忆（增加多样性）
      if (!usedTypes.has(type) || reranked.length < results.length * 0.5) {
        reranked.push(r)
        usedTypes.add(type)
      } else {
        reranked.push(r)
      }
    }
    
    return reranked
  }
  
  /**
   * 分词
   */
  tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1)
  }
  
  /**
   * BM25 得分计算
   */
  bm25Score(queryTerms, docTerms, N) {
    let score = 0
    const avgdl = 100  // 假设平均文档长度
    const k1 = 1.5
    const b = 0.75
    
    for (const term of queryTerms) {
      const df = this.bm25Index.getDF(term) || 1
      const ft = docTerms.filter(t => t === term).length
      
      if (ft > 0) {
        const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1)
        const tf = (ft * (k1 + 1)) / (ft + k1 * (1 - b + b * (docTerms.length / avgdl)))
        score += idf * tf
      }
    }
    
    return score
  }
  
  /**
   * 提取实体
   */
  extractEntities(text) {
    // 简单实体提取：提取连续的中文词或英文词组
    const entities = []
    
    // 中文实体（2-4个连续汉字）
    const chineseMatches = text.match(/[\u4e00-\u9fff]{2,4}/g)
    if (chineseMatches) {
      entities.push(...chineseMatches)
    }
    
    // 英文实体（连续字母）
    const englishMatches = text.match(/[a-zA-Z]{3,}/g)
    if (englishMatches) {
      entities.push(...englishMatches)
    }
    
    return entities
  }
  
  /**
   * 余弦相似度
   */
  cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0
    
    let dotProduct = 0
    let normA = 0
    let normB = 0
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB) + 0.0001)
  }
}

/**
 * BM25 索引
 */
class BM25Index {
  constructor() {
    this.documents = new Map()
    this.termDocs = new Map()
    this.docCount = 0
  }
  
  add(id, text) {
    const terms = text.toLowerCase().split(/\s+/)
    this.documents.set(id, terms)
    this.docCount++
    
    for (const term of terms) {
      if (!this.termDocs.has(term)) {
        this.termDocs.set(term, new Set())
      }
      this.termDocs.get(term).add(id)
    }
  }
  
  getDocCount() {
    return this.docCount
  }
  
  getDF(term) {
    return this.termDocs.get(term)?.size || 0
  }
}

export default {
  HybridRetriever
}
