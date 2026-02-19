/**
 * 示例 1: 记忆写入
 * 
 * 运行: node examples/01-write-memory.js
 * 
 * 功能: 向 V5 记忆系统写入一条记忆
 */

import { V5MetaEngine } from '../src/core/engine/meta_engine.js'
import { FileSystemStore } from '../src/core/storage/memory_store.js'

async function main() {
  console.log('\n=== V5 记忆写入示例 ===\n')
  
  // 1. 创建存储
  const store = new FileSystemStore({
    basePath: './v5-data',
    namespace: 'default',
    platform: 'demo'
  })
  
  // 2. 创建引擎
  const engine = new V5MetaEngine({
    gamma: 0.85,   // 响应强度
    barrier: 0.5,  // 阈值
    platform: 'demo'
  })
  engine.store = store
  
  // 3. 写入记忆
  const memory = {
    meta: {
      id: `mem_${Date.now()}`,
      version: 'v1.0',
      platform: 'demo',
      namespace: 'default',
      tags: ['test', 'demo'],
      dimensions: {
        confidence: 0.9,
        importance: 0.8,
        time_decay: 1,
        recall_priority: 1
      },
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
      text: '我喜欢用 Python 写后端代码，偏好简洁的风格'
    }
  }
  
  await store.add(memory)
  
  console.log('✅ 记忆写入成功!')
  console.log('   ID:', memory.meta.id)
  console.log('   内容:', memory.body.text)
  console.log('   类型:', memory.body.type)
  console.log('')
  
  // 4. 验证写入
  const all = await store.query({})
  console.log(`📊 当前共有 ${all.length} 条记忆`)
}

main().catch(console.error)
