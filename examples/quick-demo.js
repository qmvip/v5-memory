#!/usr/bin/env node

/**
 * V5 Memory - 1分钟快速演示
 * 
 * 一键运行，快速体验 V5 记忆系统核心功能
 * 
 * 使用: node examples/quick-demo.js
 */

import { v5BarrierEquation, calculateWriteScore } from './src/core/engine/scorer.js'
import { FileSystemStore } from './src/core/storage/memory_store.js'

async function main() {
  console.log('\n' + '='.repeat(50))
  console.log('    V5 元记忆系统 - 1分钟快速演示')
  console.log('='.repeat(50) + '\n')
  
  // 1. V5 势垒方程演示
  console.log('🔢 V5 势垒方程演示:')
  console.log('   公式: P = 1 / (1 + e^(-2γ(Input-B)))')
  
  const testInputs = [0.3, 0.5, 0.7, 0.9]
  for (const input of testInputs) {
    const p = v5BarrierEquation(input, 0.85, 0.5)
    console.log(`   Input=${input} → P=${p.toFixed(4)} ${p > 0.7 ? '✅ 高激活' : p > 0.4 ? '⚠️ 中激活' : '❌ 低激活'}`)
  }
  
  // 2. 写入得分演示
  console.log('\n📝 写入得分演示:')
  const writeScore = calculateWriteScore(0.9, 0.8, 1.0, 1.0)
  console.log(`   置信度=0.9, 重要性=0.8, 平台权重=1.0, 新鲜度=1.0`)
  console.log(`   写入得分: ${writeScore.toFixed(4)}`)
  
  // 3. 存储演示
  console.log('\n💾 存储演示:')
  const store = new FileSystemStore({
    basePath: './v5-quick-demo',
    namespace: 'demo',
    platform: 'quick'
  })
  
  const testMemory = {
    meta: {
      id: 'demo_1',
      version: 'v1.0',
      platform: 'quick',
      namespace: 'demo',
      tags: ['demo'],
      dimensions: { confidence: 0.9, importance: 0.8, time_decay: 1, recall_priority: 1 },
      relations: {},
      lifecycle: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
        status: 'active'
      },
      security: { sensitivity: 'normal', masked: false, origin: 'manual' }
    },
    body: {
      type: 'persona',
      text: '这是我的第一条 V5 记忆'
    }
  }
  
  await store.add(testMemory)
  console.log('   ✅ 记忆写入成功!')
  
  const count = await store.count({})
  console.log(`   📊 当前存储: ${count} 条记忆`)
  
  // 4. 完成
  console.log('\n' + '='.repeat(50))
  console.log('    演示完成! V5 系统运行正常 ✅')
  console.log('='.repeat(50))
  console.log('\n📚 更多示例:')
  console.log('   npm run example:write      - 记忆写入')
  console.log('   npm run example:retrieve   - 记忆检索')
  console.log('   npm run example:experiment - 实验闭环')
  console.log('')
}

main().catch(console.error)
