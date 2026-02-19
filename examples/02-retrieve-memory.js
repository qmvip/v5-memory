/**
 * 示例 2: 记忆检索
 * 
 * 运行: node examples/02-retrieve-memory.js
 * 
 * 功能: 根据关键词检索记忆
 */

import { V5MetaEngine } from '../src/core/engine/meta_engine.js'
import { FileSystemStore } from '../src/core/storage/memory_store.js'

async function main() {
  console.log('\n=== V5 记忆检索示例 ===\n')
  
  // 1. 创建存储 (先写入一些测试数据)
  const store = new FileSystemStore({
    basePath: './v5-data',
    namespace: 'default',
    platform: 'demo'
  })
  
  // 写入测试记忆
  const testMemories = [
    {
      meta: {
        id: 'mem_1', version: 'v1.0', platform: 'demo', namespace: 'default',
        tags: ['python', 'backend'], dimensions: { confidence: 0.9, importance: 0.8, time_decay: 1, recall_priority: 1 },
        relations: {}, lifecycle: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), lastUsedAt: new Date().toISOString(), status: 'active' },
        security: { sensitivity: 'normal', masked: false, origin: 'manual' }
      },
      body: { type: 'persona', text: '我喜欢用 Python 写后端代码，偏好简洁的风格' }
    },
    {
      meta: {
        id: 'mem_2', version: 'v1.0', platform: 'demo', namespace: 'default',
        tags: ['javascript', 'frontend'], dimensions: { confidence: 0.8, importance: 0.7, time_decay: 1, recall_priority: 0.8 },
        relations: {}, lifecycle: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), lastUsedAt: new Date().toISOString(), status: 'active' },
        security: { sensitivity: 'normal', masked: false, origin: 'manual' }
      },
      body: { type: 'core', text: '当前在开发一个 React 前端项目，使用 TypeScript' }
    },
    {
      meta: {
        id: 'mem_3', version: 'v1.0', platform: 'demo', namespace: 'default',
        tags: ['ai', 'experiment'], dimensions: { confidence: 0.85, importance: 0.9, time_decay: 0.8, recall_priority: 1 },
        relations: {}, lifecycle: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), lastUsedAt: new Date().toISOString(), status: 'active' },
        security: { sensitivity: 'normal', masked: false, origin: 'manual' }
      },
      body: { type: 'episodic', text: '上次实验参数：学习率 0.001，批次大小 32' }
    }
  ]
  
  for (const mem of testMemories) {
    try { await store.add(mem) } catch (e) {}
  }
  
  // 2. 创建引擎
  const engine = new V5MetaEngine({
    gamma: 0.85,
    barrier: 0.5,
    platform: 'demo'
  })
  engine.store = store
  
  // 3. 检索记忆
  const query = 'Python 后端'
  console.log(`🔍 搜索: "${query}"\n`)
  
  const results = await engine.recall(query)
  
  console.log(`📋 找到 ${results.length} 条相关记忆:\n`)
  
  for (const mem of results) {
    console.log(`  [${mem.body.type}] ${mem.body.text}`)
    console.log(`      得分: ${mem.recallScore?.toFixed(4)}`)
    console.log('')
  }
  
  // 4. 另一种检索方式: 直接查询
  console.log('--- 直接查询所有记忆 ---')
  const all = await store.query({})
  console.log(`共 ${all.length} 条记忆\n`)
  
  for (const mem of all) {
    console.log(`  - [${mem.body.type}] ${mem.body.text.substring(0, 40)}...`)
  }
}

main().catch(console.error)
