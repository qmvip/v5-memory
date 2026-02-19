/**
 * V5 Experiment Loop - 自动化实验闭环
 * 
 * 实现 "假设-模拟-实验-反馈" 闭环
 * 
 * 流程：
 * 假设生成 → 记忆检索 → 参数推荐 → 模拟/实验 → 结果记忆 → 反馈优化
 */

import { v5BarrierEquation } from '../engine/scorer.js'

/**
 * 实验阶段
 */
export const EXPERIMENT_PHASES = {
  HYPOTHESIS: 'hypothesis',       // 假设生成
  DESIGN: 'design',             // 实验设计
  SIMULATION: 'simulation',      // 模拟/实验
  OBSERVATION: 'observation',    // 观察结果
  ANALYSIS: 'analysis',         // 分析
  FEEDBACK: 'feedback',         // 反馈优化
  COMPLETE: 'complete'          // 完成
}

/**
 * 实验类型
 */
export const EXPERIMENT_TYPES = {
  SIMULATION: 'simulation',     // 计算机模拟
  WET_LAB: 'wet_lab',          // 湿实验
  HYBRID: 'hybrid',             // 混合
  LITERATURE: 'literature'     // 文献研究
}

/**
 * 实验闭环管理器
 */
export class ExperimentLoop {
  constructor(options = {}) {
    this.config = {
      // 最大迭代次数
      maxIterations: options.maxIterations || 10,
      
      // 收敛阈值
      convergenceThreshold: options.convergenceThreshold || 0.95,
      
      // 是否启用模拟
      enableSimulation: options.enableSimulation ?? true,
      
      // 是否启用自动参数优化
      enableAutoTune: options.enableAutoTune ?? true,
      
      // V5 参数
      gamma: options.gamma || 0.85,
      barrier: options.barrier || 0.5,
      
      ...options
    }
    
    // 当前实验状态
    this.currentExperiment = null
    this.history = []
  }
  
  /**
   * 创建新实验
   */
  async createExperiment(config) {
    const experiment = {
      id: `exp_${Date.now()}`,
      type: config.type || EXPERIMENT_TYPES.SIMULATION,
      hypothesis: config.hypothesis,
      goal: config.goal,
      
      // 实验参数
      parameters: config.parameters || {},
      
      // 阶段
      phase: EXPERIMENT_PHASES.HYPOTHESIS,
      
      // 历史记录
      history: [],
      
      // 结果
      results: [],
      
      // 迭代次数
      iteration: 0,
      
      // 置信度
      confidence: 0,
      
      // 创建时间
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    this.currentExperiment = experiment
    return experiment
  }
  
  /**
   * 运行实验闭环
   */
  async run(experiment, memoryStore) {
    this.currentExperiment = experiment
    
    console.log(`[ExperimentLoop] Starting experiment: ${experiment.id}`)
    
    while (!this.isConverged() && experiment.iteration < this.config.maxIterations) {
      experiment.iteration++
      console.log(`[ExperimentLoop] Iteration ${experiment.iteration}`)
      
      switch (experiment.phase) {
        case EXPERIMENT_PHASES.HYPOTHESIS:
          await this.generateHypothesis(experiment, memoryStore)
          break
          
        case EXPERIMENT_PHASES.DESIGN:
          await this.designExperiment(experiment, memoryStore)
          break
          
        case EXPERIMENT_PHASES.SIMULATION:
          await this.runSimulation(experiment)
          break
          
        case EXPERIMENT_PHASES.OBSERVATION:
          await this.observeResults(experiment)
          break
          
        case EXPERIMENT_PHASES.ANALYSIS:
          await this.analyzeResults(experiment, memoryStore)
          break
          
        case EXPERIMENT_PHASES.FEEDBACK:
          await this.generateFeedback(experiment, memoryStore)
          break
          
        default:
          break
      }
      
      // 记录历史
      experiment.history.push({
        phase: experiment.phase,
        iteration: experiment.iteration,
        timestamp: new Date().toISOString()
      })
      
      // 更新实验
      experiment.updatedAt = new Date().toISOString()
    }
    
    if (this.isConverged()) {
      experiment.phase = EXPERIMENT_PHASES.COMPLETE
      console.log(`[ExperimentLoop] Experiment converged: ${experiment.id}`)
    }
    
    return experiment
  }
  
  /**
   * 阶段1: 生成假设
   */
  async generateHypothesis(experiment, memoryStore) {
    console.log('[ExperimentLoop] Generating hypothesis...')
    
    // 从记忆检索相关假设
    const relevantMemories = await memoryStore?.query?.({
      tags: ['hypothesis', 'experiment', 'result'],
      status: 'active'
    }) || []
    
    // 基于历史结果生成假设
    const previousResults = experiment.results || []
    
    // 生成假设
    const hypothesis = {
      statement: experiment.hypothesis,
      basedOn: relevantMemories.slice(0, 3).map(m => m.meta?.id),
      confidence: 0.5,
      iteration: experiment.iteration
    }
    
    // 应用 V5 势垒方程评估假设置信度
    const inputScore = this.calculateHypothesisScore(hypothesis, previousResults)
    hypothesis.confidence = v5BarrierEquation(inputScore, this.config.gamma, this.config.barrier)
    
    experiment.hypothesis = hypothesis
    experiment.phase = EXPERIMENT_PHASES.DESIGN
    
    return hypothesis
  }
  
  /**
   * 阶段2: 设计实验
   */
  async designExperiment(experiment, memoryStore) {
    console.log('[ExperimentLoop] Designing experiment...')
    
    // 检索历史相似实验
    const similarExperiments = await this.findSimilarExperiments(experiment, memoryStore)
    
    // 生成实验参数
    let parameters = { ...experiment.parameters }
    
    if (similarExperiments.length > 0) {
      // 基于相似实验优化参数
      const bestParams = this.optimizeParameters(
        parameters,
        similarExperiments.map(e => e.results).flat()
      )
      parameters = { ...parameters, ...bestParams }
    }
    
    // 自动调优
    if (this.config.enableAutoTune) {
      parameters = this.autoTuneParameters(parameters, experiment.goal)
    }
    
    experiment.parameters = parameters
    experiment.phase = EXPERIMENT_PHASES.SIMULATION
    
    return parameters
  }
  
  /**
   * 阶段3: 运行模拟/实验
   */
  async runSimulation(experiment) {
    console.log('[ExperimentLoop] Running simulation...')
    
    // 模拟结果（实际场景可对接真实模拟器）
    const result = {
      id: `result_${Date.now()}`,
      iteration: experiment.iteration,
      parameters: { ...experiment.parameters },
      
      // 模拟输出
      output: this.simulateOutput(experiment),
      
      // 评估指标
      metrics: this.evaluateMetrics(experiment),
      
      // 时间戳
      timestamp: new Date().toISOString()
    }
    
    // 计算结果置信度
    const score = this.calculateResultScore(result)
    result.confidence = v5BarrierEquation(score, this.config.gamma, this.config.barrier)
    
    experiment.results.push(result)
    experiment.phase = EXPERIMENT_PHASES.OBSERVATION
    
    return result
  }
  
  /**
   * 阶段4: 观察结果
   */
  async observeResults(experiment) {
    console.log('[ExperimentLoop] Observing results...')
    
    const latestResult = experiment.results[experiment.results.length - 1]
    
    // 提取关键观察
    const observation = {
      iteration: experiment.iteration,
      metrics: latestResult?.metrics || {},
      output: latestResult?.output || {},
      confidence: latestResult?.confidence || 0,
      interpretation: this.interpretResults(latestResult)
    }
    
    experiment.latestObservation = observation
    experiment.phase = EXPERIMENT_PHASES.ANALYSIS
    
    return observation
  }
  
  /**
   * 阶段5: 分析结果
   */
  async analyzeResults(experiment, memoryStore) {
    console.log('[ExperimentLoop] Analyzing results...')
    
    const results = experiment.results
    const analysis = {
      trend: this.analyzeTrend(results),
      patterns: this.findPatterns(results),
      insights: this.generateInsights(results, experiment.goal),
      confidence: this.calculateAnalysisConfidence(results)
    }
    
    experiment.analysis = analysis
    
    // 判断是否收敛
    if (analysis.confidence >= this.config.convergenceThreshold) {
      experiment.phase = EXPERIMENT_PHASES.COMPLETE
    } else {
      experiment.phase = EXPERIMENT_PHASES.FEEDBACK
    }
    
    // 保存分析到记忆
    if (memoryStore) {
      await this.saveToMemory(experiment, analysis, memoryStore)
    }
    
    return analysis
  }
  
  /**
   * 阶段6: 反馈优化
   */
  async generateFeedback(experiment, memoryStore) {
    console.log('[ExperimentLoop] Generating feedback...')
    
    const analysis = experiment.analysis || {}
    
    // 生成反馈建议
    const feedback = {
      parameterAdjustments: this.suggestParameterAdjustments(experiment),
      hypothesisRefinements: this.refineHypothesis(experiment),
      nextSteps: this.suggestNextSteps(experiment),
      confidence: analysis.confidence || 0
    }
    
    experiment.feedback = feedback
    
    // 调整假设
    if (feedback.hypothesisRefinements) {
      experiment.hypothesis = {
        ...experiment.hypothesis,
        ...feedback.hypothesisRefinements,
        iteration: experiment.iteration
      }
    }
    
    // 调整参数
    if (feedback.parameterAdjustments) {
      experiment.parameters = {
        ...experiment.parameters,
        ...feedback.parameterAdjustments
      }
    }
    
    // 回到设计阶段
    experiment.phase = EXPERIMENT_PHASES.DESIGN
    
    return feedback
  }
  
  /**
   * 检查是否收敛
   */
  isConverged() {
    if (!this.currentExperiment) return false
    
    const experiment = this.currentExperiment
    const results = experiment.results || []
    
    if (results.length < 2) return false
    
    // 检查最近几次结果是否稳定
    const recentResults = results.slice(-3)
    const scores = recentResults.map(r => r.confidence || 0)
    
    const variance = this.calculateVariance(scores)
    return variance < (1 - this.config.convergenceThreshold)
  }
  
  /**
   * 计算假设得分
   */
  calculateHypothesisScore(hypothesis, previousResults) {
    let score = 0.5
    
    // 基础分数
    score += 0.1
    
    // 基于之前结果
    if (previousResults.length > 0) {
      const avgConfidence = previousResults.reduce((sum, r) => sum + (r.confidence || 0), 0) / previousResults.length
      score += avgConfidence * 0.3
    }
    
    return Math.min(score, 1)
  }
  
  /**
   * 查找相似实验
   */
  async findSimilarExperiments(experiment, memoryStore) {
    if (!memoryStore?.query) return []
    
    const memories = await memoryStore.query({
      type: 'experiment',
      tags: { $in: [experiment.goal] }
    })
    
    return memories
  }
  
  /**
   * 优化参数
   */
  optimizeParameters(currentParams, previousResults) {
    if (!previousResults?.length) return {}
    
    // 简单参数优化：选择最佳参数组合
    const best = previousResults
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0]
    
    if (best?.parameters) {
      return {
        learning_rate: best.parameters.learning_rate,
        temperature: best.parameters.temperature,
        epochs: best.parameters.epochs
      }
    }
    
    return {}
  }
  
  /**
   * 自动调优参数
   */
  autoTuneParameters(parameters, goal) {
    // 简单的参数空间搜索
    const tuned = { ...parameters }
    
    // 根据目标调整
    if (goal?.includes('optimize')) {
      tuned.temperature = (tuned.temperature || 0.5) * 0.9
    } else if (goal?.includes('explore')) {
      tuned.temperature = (tuned.temperature || 0.5) * 1.2
    }
    
    return tuned
  }
  
  /**
   * 模拟输出
   */
  simulateOutput(experiment) {
    // 模拟实验输出（实际应对接真实模拟器）
    const params = experiment.parameters
    const seed = experiment.iteration
    
    return {
      value: Math.sin(seed * 0.1) * params.temperature || 0.5,
      error: 0.1 / (seed + 1),
      convergence: Math.min(seed / 10, 1)
    }
  }
  
  /**
   * 评估指标
   */
  evaluateMetrics(experiment) {
    const output = experiment.results[experiment.results.length - 1]?.output || {}
    
    return {
      accuracy: output.convergence || 0.5,
      loss: output.error || 0.1,
      f1_score: output.value || 0.5
    }
  }
  
  /**
   * 计算结果得分
   */
  calculateResultScore(result) {
    const metrics = result.metrics || {}
    
    return (
      (metrics.accuracy || 0.5) * 0.5 +
      (1 - (metrics.loss || 0.1)) * 0.3 +
      (metrics.f1_score || 0.5) * 0.2
    )
  }
  
  /**
   * 解释结果
   */
  interpretResults(result) {
    const metrics = result?.metrics || {}
    
    if (metrics.accuracy > 0.9) return 'Excellent convergence'
    if (metrics.accuracy > 0.7) return 'Good progress'
    if (metrics.accuracy > 0.5) return 'Moderate results'
    return 'Needs improvement'
  }
  
  /**
   * 分析趋势
   */
  analyzeTrend(results) {
    if (results.length < 2) return 'insufficient_data'
    
    const scores = results.map(r => r.confidence || 0)
    const recent = scores.slice(-3)
    
    if (recent.every(s => s > scores[0])) return 'improving'
    if (recent.every(s => s < scores[0])) return 'declining'
    return 'stable'
  }
  
  /**
   * 查找模式
   */
  findPatterns(results) {
    // 简单模式检测
    const patterns = []
    
    if (results.length > 5) {
      const scores = results.map(r => r.confidence || 0)
      const oscillating = scores.slice(-5).some((s, i) => 
        i > 0 && Math.abs(s - scores[i-1]) > 0.1
      )
      
      if (oscillating) patterns.push('oscillation_detected')
    }
    
    return patterns
  }
  
  /**
   * 生成洞察
   */
  generateInsights(results, goal) {
    const insights = []
    
    const trend = this.analyzeTrend(results)
    if (trend === 'improving') {
      insights.push('Current approach is effective')
    }
    
    const best = results.reduce((best, r) => 
      (r.confidence || 0) > (best.confidence || 0) ? r : best
    , results[0])
    
    if (best) {
      insights.push(`Best iteration: ${best.iteration}`)
    }
    
    return insights
  }
  
  /**
   * 计算分析置信度
   */
  calculateAnalysisConfidence(results) {
    if (results.length === 0) return 0
    
    const avg = results.reduce((sum, r) => sum + (r.confidence || 0), 0) / results.length
    const trend = this.analyzeTrend(results)
    
    return avg * (trend === 'improving' ? 1.1 : trend === 'stable' ? 1.0 : 0.9)
  }
  
  /**
   * 建议参数调整
   */
  suggestParameterAdjustments(experiment) {
    const analysis = experiment.analysis || {}
    const adjustments = {}
    
    if (analysis.trend === 'declining') {
      adjustments.learning_rate = (experiment.parameters.learning_rate || 0.01) * 0.8
    }
    
    return adjustments
  }
  
  /**
   * 精炼假设
   */
  refineHypothesis(experiment) {
    const results = experiment.results || []
    
    if (results.length === 0) return null
    
    // 基于结果精炼
    return {
      statement: `${experiment.hypothesis?.statement} (refined based on ${results.length} iterations)`
    }
  }
  
  /**
   * 建议下一步
   */
  suggestNextSteps(experiment) {
    const steps = []
    
    if (experiment.iteration < 3) {
      steps.push('Continue current approach')
    } else if (experiment.iteration < 7) {
      steps.push('Consider parameter adjustment')
    } else {
      steps.push('Review experiment design')
    }
    
    return steps
  }
  
  /**
   * 保存到记忆
   */
  async saveToMemory(experiment, analysis, memoryStore) {
    const memory = {
      meta: {
        id: `mem_exp_${experiment.id}`,
        version: 'v1.0',
        platform: 'experiment',
        namespace: 'default',
        tags: ['experiment', experiment.goal],
        dimensions: {
          confidence: analysis.confidence || 0.5,
          importance: 0.8,
          time_decay: 1,
          recall_priority: 0.9
        },
        relations: {},
        lifecycle: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastUsedAt: new Date().toISOString(),
          status: 'active'
        },
        security: { sensitivity: 'normal', masked: false, origin: 'auto' }
      },
      body: {
        type: 'core',
        text: `实验 ${experiment.id}: ${experiment.goal}. ${experiment.iteration}次迭代. 置信度: ${(analysis.confidence || 0).toFixed(2)}`
      }
    }
    
    await memoryStore.add(memory)
  }
  
  /**
   * 计算方差
   */
  calculateVariance(values) {
    if (values.length === 0) return 0
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2))
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length
  }
  
  /**
   * 获取实验状态
   */
  getStatus() {
    return {
      current: this.currentExperiment,
      history: this.history.length,
      converged: this.isConverged()
    }
  }
}

export default {
  ExperimentLoop,
  EXPERIMENT_PHASES,
  EXPERIMENT_TYPES
}
