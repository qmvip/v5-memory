/**
 * 示例 3: 实验闭环
 * 
 * 运行: node examples/03-experiment-loop.js
 * 
 * 功能: 运行"假设-模拟-实验-反馈"自动化闭环
 */

import { ExperimentLoop, EXPERIMENT_PHASES } from '../src/core/experiment/loop.js'
import { FileSystemStore } from '../src/core/storage/memory_store.js'

async function main() {
  console.log('\n=== V5 实验闭环示例 ===\n')
  
  // 1. 创建存储
  const store = new FileSystemStore({
    basePath: './v5-data',
    namespace: 'default',
    platform: 'experiment'
  })
  
  // 写入历史实验数据（用于参考）
  const historyMemories = [
    {
      meta: {
        id: 'exp_1', version: 'v1.0', platform: 'experiment', namespace: 'default',
        tags: ['experiment', 'optimization'], dimensions: { confidence: 0.9, importance: 0.9, time_decay: 0.8, recall_priority: 1 },
        relations: {}, lifecycle: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), lastUsedAt: new Date().toISOString(), status: 'active' },
        security: { sensitivity: 'normal', masked: false, origin: 'auto' }
      },
      body: { type: 'core', text: '上次优化: 学习率 0.001 → 0.0005，收敛效果提升 15%' }
    },
    {
      meta: {
        id: 'exp_2', version: 'v1.0', platform: 'experiment', namespace: 'default',
        tags: ['experiment', 'baseline'], dimensions: { confidence: 0.85, importance: 0.8, time_decay: 0.6, recall_priority: 0.8 },
        relations: {}, lifecycle: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), lastUsedAt: new Date().toISOString(), status: 'active' },
        security: { sensitivity: 'normal', masked: false, origin: 'auto' }
      },
      body: { type: 'episodic', text: '基线参数: batch_size=32, epochs=100, 初始准确率 78%' }
    }
  ]
  
  for (const mem of historyMemories) {
    try { await store.add(mem) } catch (e) {}
  }
  
  console.log('📊 已加载历史实验数据\n')
  
  // 2. 创建实验闭环
  const loop = new ExperimentLoop({
    maxIterations: 5,         // 最多5次迭代
    convergenceThreshold: 0.9,  // 收敛阈值
    gamma: 0.85,
    barrier: 0.5
  })
  
  // 3. 创建实验任务
  const experiment = await loop.createExperiment({
    hypothesis: '降低学习率可以提高模型收敛稳定性',
    goal: '优化深度学习模型收敛效果',
    type: 'simulation',
    parameters: {
      learning_rate: 0.001,
      batch_size: 32,
      epochs: 100
    }
  })
  
  console.log('🚀 创建实验:')
  console.log('   假设:', experiment.hypothesis)
  console.log('   目标:', experiment.goal)
  console.log('   初始参数:', JSON.stringify(experiment.parameters))
  console.log('')
  
  // 4. 运行实验闭环
  console.log('⚗️  开始实验闭环...\n')
  
  const result = await loop.run(experiment, store)
  
  // 5. 输出结果
  console.log('='.repeat(40))
  console.log('\n📈 实验结果:')
  console.log('   总迭代次数:', result.iteration)
  console.log('   最终阶段:', result.phase)
  console.log('   最终参数:', JSON.stringify(result.parameters, null, 2))
  
  if (result.results?.length > 0) {
    console.log('\n📊 各次迭代结果:')
    for (const r of result.results) {
      console.log(`   迭代${r.iteration}: 置信度=${r.confidence?.toFixed(4)}, 指标=${JSON.stringify(r.metrics)}`)
    }
  }
  
  if (result.analysis) {
    console.log('\n🔍 分析洞察:')
    console.log('   趋势:', result.analysis.trend)
    console.log('   洞察:', result.analysis.insights?.join(', '))
  }
  
  console.log('\n✅ 实验闭环完成!\n')
}

main().catch(console.error)
