/**
 * V5 Reasoning - Tree of Thoughts / Graph of Thoughts
 * 
 * 高级推理框架：
 * 1. Tree of Thoughts (ToT) - 树搜索
 * 2. Graph of Thoughts (GoT) - 图搜索
 */

import { v5BarrierEquation } from '../engine/scorer.js'

/**
 * 思维节点
 */
class ThoughtNode {
  constructor(content, parent = null, score = 0) {
    this.id = `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    this.content = content
    this.parent = parent
    this.children = []
    this.score = score
    this.depth = parent ? parent.depth + 1 : 0
    this.createdAt = new Date().toISOString()
    this.evaluated = false
  }
  
  addChild(node) {
    this.children.push(node)
    return node
  }
  
  getPath() {
    const path = []
    let current = this
    
    while (current) {
      path.unshift(current.content)
      current = current.parent
    }
    
    return path
  }
  
  isLeaf() {
    return this.children.length === 0
  }
}

/**
 * Tree of Thoughts 推理器
 */
export class TreeOfThoughts {
  constructor(options = {}) {
    this.config = {
      // 搜索参数
      maxDepth: options.maxDepth || 5,
      branchFactor: options.branchFactor || 3,
      maxNodes: options.maxNodes || 100,
      
      // 评估器
      evaluate: options.evaluate || this.defaultEvaluate,
      
      // 剪枝阈值
      pruningThreshold: options.pruningThreshold || 0.3,
      
      // 是否回溯
      enableBacktrack: options.enableBacktrack ?? true,
      
      // V5 参数
      gamma: options.gamma || 0.85,
      barrier: options.barrier || 0.5,
      
      ...options
    }
    
    this.root = null
    this.allNodes = []
    this.bestPath = null
    this.bestScore = 0
  }
  
  /**
   * 默认评估函数
   */
  defaultEvaluate(content, context) {
    // 简单的基于关键词的评估
    const keywords = context?.keywords || []
    let score = 0.5
    
    for (const kw of keywords) {
      if (content.includes(kw)) {
        score += 0.1
      }
    }
    
    return Math.min(score, 1)
  }
  
  /**
   * 生成思考
   */
  async think(prompt, context = {}) {
    this.root = new ThoughtNode(prompt)
    this.allNodes = [this.root]
    this.bestScore = 0
    this.bestPath = [prompt]
    
    // 广度优先搜索
    const queue = [this.root]
    
    while (queue.length > 0 && this.allNodes.length < this.config.maxNodes) {
      const current = queue.shift()
      
      // 检查是否达到最大深度
      if (current.depth >= this.config.maxDepth) {
        continue
      }
      
      // 生成子节点
      const children = await this.generateChildren(current, prompt, context)
      
      for (const child of children) {
        // 评估子节点
        const evaluation = await this.config.evaluate(child.content, context)
        child.score = evaluation
        
        // 应用 V5 势垒方程
        child.v5Score = v5BarrierEquation(evaluation, this.config.gamma, this.config.barrier)
        
        // 剪枝
        if (child.v5Score < this.config.pruningThreshold) {
          continue
        }
        
        // 添加子节点
        current.addChild(child)
        this.allNodes.push(child)
        queue.push(child)
        
        // 更新最佳路径
        if (child.v5Score > this.bestScore) {
          this.bestScore = child.v5Score
          this.bestPath = child.getPath()
        }
      }
    }
    
    return {
      bestPath: this.bestPath,
      bestScore: this.bestScore,
      allNodes: this.allNodes.length,
      tree: this.toTreeStructure()
    }
  }
  
  /**
   * 生成子节点
   */
  async generateChildren(parent, originalPrompt, context) {
    const children = []
    const parentContent = parent.content
    
    // 生成不同的思考方向
    const directions = [
      `${parentContent} - 从技术角度分析`,
      `${parentContent} - 从可行性角度考虑`,
      `${parentContent} - 从风险角度评估`
    ]
    
    // 如果有记忆上下文，加入相关方向
    if (context?.memories?.length > 0) {
      directions.push(`${parentContent} - 结合已有经验`)
    }
    
    // 生成子节点
    for (const direction of directions.slice(0, this.config.branchFactor)) {
      const child = new ThoughtNode(direction, parent)
      children.push(child)
    }
    
    return children
  }
  
  /**
   * 回溯搜索
   */
  backtrack(startNode, targetScore) {
    if (!this.config.enableBacktrack) return null
    
    // 简单回溯：尝试不同的分支
    const stack = [startNode]
    const visited = new Set()
    
    while (stack.length > 0) {
      const current = stack.pop()
      
      if (visited.has(current.id)) continue
      visited.add(current.id)
      
      // 检查是否达到目标分数
      if (current.v5Score >= targetScore) {
        return current.getPath()
      }
      
      // 探索父节点
      if (current.parent) {
        stack.push(current.parent)
      }
      
      // 探索其他子节点
      for (const sibling of current.parent?.children || []) {
        if (!visited.has(sibling.id)) {
          stack.push(sibling)
        }
      }
    }
    
    return null
  }
  
  /**
   * 转换为树结构
   */
  toTreeStructure() {
    const convert = (node) => ({
      id: node.id,
      content: node.content.substring(0, 50),
      score: node.score,
      v5Score: node.v5Score,
      depth: node.depth,
      children: node.children.map(convert)
    })
    
    return convert(this.root)
  }
  
  /**
   * 可视化
   */
  visualize() {
    const print = (node, indent = 0) => {
      const prefix = '  '.repeat(indent)
      const score = node.v5Score?.toFixed(3) || node.score?.toFixed(3) || '0.000'
      console.log(`${prefix}[${score}] ${node.content.substring(0, 40)}`)
      
      for (const child of node.children) {
        print(child, indent + 1)
      }
    }
    
    console.log('\n=== Tree of Thoughts ===')
    print(this.root)
    console.log(`\nBest Score: ${this.bestScore.toFixed(3)}`)
    console.log(`Total Nodes: ${this.allNodes.length}`)
  }
}

/**
 * Graph of Thoughts 推理器
 */
export class GraphOfThoughts {
  constructor(options = {}) {
    this.config = {
      maxNodes: options.maxNodes || 50,
      enableRefinement: options.enableRefinement ?? true,
      enableAggregation: options.enableAggregation ?? true,
      ...options
    }
    
    this.nodes = new Map()
    this.edges = new Map()
    this.startNode = null
    this.endNode = null
  }
  
  /**
   * 添加节点
   */
  addNode(content, type = 'thought') {
    const node = {
      id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      content,
      type,  // thought, refinement, aggregation
      score: 0,
      neighbors: new Set(),
      createdAt: new Date().toISOString()
    }
    
    this.nodes.set(node.id, node)
    this.edges.set(node.id, [])
    
    return node
  }
  
  /**
   * 添加边
   */
  addEdge(fromId, toId, weight = 1) {
    const edges = this.edges.get(fromId) || []
    edges.push({ to: toId, weight })
    this.edges.set(fromId, edges)
    
    // 双向边
    const reverseEdges = this.edges.get(toId) || []
    reverseEdges.push({ to: fromId, weight })
    this.edges.set(toId, reverseEdges)
    
    // 更新邻居
    this.nodes.get(fromId)?.neighbors.add(toId)
    this.nodes.get(toId)?.neighbors.add(fromId)
  }
  
  /**
   * 思考
   */
  async think(prompt, context = {}) {
    // 创建起始节点
    this.startNode = this.addNode(prompt, 'start')
    
    // 生成初始思考
    const thoughts = await this.generateThoughts(prompt, context)
    
    // 添加思考节点
    const thoughtNodes = []
    for (const thought of thoughts) {
      const node = this.addNode(thought, 'thought')
      this.addEdge(this.startNode.id, node.id)
      thoughtNodes.push(node)
    }
    
    // 可能的改进
    if (this.config.enableRefinement) {
      const refined = await this.refineThoughts(thoughtNodes, context)
      for (const node of refined) {
        thoughtNodes.push(node)
      }
    }
    
    // 聚合
    if (this.config.enableAggregation && thoughtNodes.length > 1) {
      const aggregated = await this.aggregateThoughts(thoughtNodes)
      this.endNode = aggregated
    } else {
      // 选择最佳
      this.endNode = thoughtNodes.sort((a, b) => b.score - a.score)[0]
    }
    
    return {
      path: this.getPath(),
      score: this.endNode?.score || 0,
      nodes: this.nodes.size
    }
  }
  
  /**
   * 生成思考
   */
  async generateThoughts(prompt, context) {
    const thoughts = [
      `${prompt} - 技术方案`,
      `${prompt} - 风险分析`,
      `${prompt} - 可行性评估`
    ]
    
    return thoughts
  }
  
  /**
   * 改进思考
   */
  async refineThoughts(thoughtNodes, context) {
    const refined = []
    
    for (const node of thoughtNodes.slice(0, 2)) {
      const refinedContent = `${node.content} (优化版)`
      const refinedNode = this.addNode(refinedContent, 'refinement')
      this.addEdge(node.id, refinedNode.id)
      refined.push(refinedNode)
    }
    
    return refined
  }
  
  /**
   * 聚合思考
   */
  async aggregateThoughts(thoughtNodes) {
    const contents = thoughtNodes.map(n => n.content).join(' + ')
    const aggregatedContent = `综合方案: ${contents}`
    
    const aggregated = this.addNode(aggregatedContent, 'aggregation')
    
    // 连接到所有思考节点
    for (const node of thoughtNodes) {
      this.addEdge(node.id, aggregated.id)
    }
    
    return aggregated
  }
  
  /**
   * 获取路径
   */
  getPath() {
    if (!this.startNode || !this.endNode) return []
    
    // 简单 BFS 找路径
    const visited = new Set()
    const queue = [[this.startNode.id]]
    
    while (queue.length > 0) {
      const path = queue.shift()
      const current = path[path.length - 1]
      
      if (current === this.endNode.id) {
        return path.map(id => this.nodes.get(id)?.content)
      }
      
      if (visited.has(current)) continue
      visited.add(current)
      
      const edges = this.edges.get(current) || []
      for (const edge of edges) {
        if (!visited.has(edge.to)) {
          queue.push([...path, edge.to])
        }
      }
    }
    
    return []
  }
  
  /**
   * 可视化
   */
  visualize() {
    console.log('\n=== Graph of Thoughts ===')
    
    for (const [id, node] of this.nodes) {
      const edges = this.edges.get(id) || []
      console.log(`[${node.type.substring(0, 3)}] ${node.content.substring(0, 40)}`)
      console.log(`   → ${edges.map(e => e.to.substring(0, 8)).join(', ')}`)
    }
  }
}

export default {
  TreeOfThoughts,
  GraphOfThoughts,
  ThoughtNode
}
