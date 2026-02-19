/**
 * V5 Memory Complete Edition - 完整版 CLI
 * 
 * 全功能版本，支持所有平台适配
 * 
 * 使用方式:
 *   node cli.js --init
 *   node cli.js --input "今天天气真好"
 *   node cli.js --recall "我想起来了"
 *   node cli.js --list
 *   node cli.js --export
 */

import { V5MetaEngine } from '../core/engine/meta_engine.js'
import { getAdapter } from '../core/engine/injector.js'
import { FileSystemStore } from '../core/storage/memory_store.js'

// 命令行参数解析
const args = process.argv.slice(2)
const command = args[0]

// 初始化引擎
const store = new FileSystemStore({
  basePath: './data',
  namespace: 'default',
  platform: 'complete'
})

const engine = new V5MetaEngine({
  gamma: 0.85,
  barrier: 0.5,
  writeThreshold: 0.6,
  recallThreshold: 0.5,
  platform: 'complete'
})

// 设置适配器
engine.store = store

// 主入口
async function main() {
  switch (command) {
    case '--init':
      await init()
      break
    case '--input':
      await processInput(args.slice(1).join(' '))
      break
    case '--recall':
      await recall(args.slice(1).join(' '))
      break
    case '--list':
      await listMemories()
      break
    case '--export':
      await exportMemories()
      break
    case '--import':
      await importMemories(args[1])
      break
    case '--clear':
      await clearMemories()
      break
    case '--stats':
      await showStats()
      break
    default:
      showHelp()
  }
}

// 初始化
async function init() {
  console.log('[V5 Complete] Initializing...')
  
  // 创建示例记忆
  const sampleMemories = [
    {
      meta: {
        id: 'mem_sample_1',
        version: 'v1.0',
        platform: 'complete',
        namespace: 'default',
        tags: ['personal', 'chinese'],
        dimensions: {
          confidence: 0.9,
          importance: 0.8,
          time_decay: 0.9,
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
        text: '我喜欢简洁高效的技术建议，中文交流'
      }
    },
    {
      meta: {
        id: 'mem_sample_2',
        version: 'v1.0',
        platform: 'complete',
        namespace: 'default',
        tags: ['tech', 'chinese'],
        dimensions: {
          confidence: 0.85,
          importance: 0.85,
          time_decay: 0.8,
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
        text: '当前在开发 V5 元记忆系统项目，使用 Node.js'
      }
    }
  ]
  
  for (const mem of sampleMemories) {
    await store.add(mem)
  }
  
  console.log('[V5 Complete] Initialized with sample memories')
  console.log(`   - ${sampleMemories.length} sample memories added`)
  console.log('\nTry: node cli.js --list')
}

// 处理输入
async function processInput(input) {
  console.log(`\n[V5 Complete] Processing: "${input}"`)
  
  // 召回相关记忆
  const recalled = await engine.recall(input)
  
  console.log(`[V5 Complete] Recalled ${recalled.length} memories:`)
  for (const m of recalled) {
    console.log(`   - [${m.body.type}] ${m.body.text.substring(0, 50)}... (score: ${m.recallScore.toFixed(2)})`)
  }
  
  // 模拟响应
  const mockResponse = `好的，我明白了。你喜欢简洁的技术建议。`
  
  // 提取新记忆
  const extracted = await engine.extract(mockResponse, {
    platform: 'complete',
    conversationId: `conv_${Date.now()}`
  })
  
  console.log(`\n[V5 Complete] Extracted ${extracted.length} new memories`)
  
  // 写入
  const written = await engine.write(extracted)
  console.log(`[V5 Complete] Written ${written.length} new memories`)
  
  // 显示当前记忆库状态
  await showStats()
}

// 召回测试
async function recall(query) {
  console.log(`\n[V5 Complete] Recalling: "${query}"`)
  
  const recalled = await engine.recall(query)
  
  console.log(`\n=== Recalled ${recalled.length} memories ===`)
  for (const m of recalled) {
    console.log(`\n[${m.body.type}] score: ${m.recallScore.toFixed(3)}`)
    console.log(`   ${m.body.text}`)
    console.log(`   tags: ${m.meta.tags?.join(', ')}`)
  }
}

// 列出所有记忆
async function listMemories() {
  const all = await store.query({})
  
  console.log(`\n=== Total ${all.length} memories ===`)
  
  const byType = { pinned: 0, persona: 0, core: 0, episodic: 0 }
  
  for (const m of all) {
    const type = m.body.type || 'episodic'
    byType[type] = (byType[type] || 0) + 1
    
    console.log(`\n[${type}] ${m.meta.id}`)
    console.log(`   ${m.body.text}`)
    console.log(`   status: ${m.meta.lifecycle.status}`)
    console.log(`   created: ${m.meta.lifecycle.createdAt}`)
  }
  
  console.log(`\n=== By Type ===`)
  console.log(`   pinned: ${byType.pinned}`)
  console.log(`   persona: ${byType.persona}`)
  console.log(`   core: ${byType.core}`)
  console.log(`   episodic: ${byType.episodic}`)
}

// 导出
async function exportMemories() {
  const data = await engine.export('json')
  console.log(data)
}

// 导入
async function importMemories(filePath) {
  const fs = await import('fs')
  const data = fs.readFileSync(filePath, 'utf-8')
  const count = await engine.import(data)
  console.log(`Imported ${count} memories`)
}

// 清理
async function clearMemories() {
  const count = await store.clear()
  console.log(`Cleared ${count} memories`)
}

// 统计
async function showStats() {
  const all = await store.query({})
  
  const stats = {
    total: all.length,
    byType: {},
    byPlatform: {},
    byStatus: {}
  }
  
  for (const m of all) {
    const type = m.body.type
    const platform = m.meta.platform
    const status = m.meta.lifecycle.status
    
    stats.byType[type] = (stats.byType[type] || 0) + 1
    stats.byPlatform[platform] = (stats.byPlatform[platform] || 0) + 1
    stats.byStatus[status] = (stats.byStatus[status] || 0) + 1
  }
  
  console.log('\n=== V5 Memory Stats ===')
  console.log(`Total: ${stats.total}`)
  console.log(`By Type:`, stats.byType)
  console.log(`By Platform:`, stats.byPlatform)
  console.log(`By Status:`, stats.byStatus)
}

// 帮助
function showHelp() {
  console.log(`
V5 Memory Complete Edition
==========================

Usage:
  node cli.js --init          Initialize with sample memories
  node cli.js --input "..."   Process input and auto-manage memory
  node cli.js --recall "..."  Test recall
  node cli.js --list          List all memories
  node cli.js --export       Export memories as JSON
  node cli.js --import <file> Import memories
  node cli.js --clear        Clear all memories
  node cli.js --stats        Show statistics
  `)
}

main().catch(console.error)
