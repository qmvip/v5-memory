/**
 * V5 Memory - Background Service Worker
 * 
 * 后台服务 worker，负责记忆的核心逻辑
 */

import { V5MetaEngine } from '../core/engine/meta_engine.js'
import { getAdapter } from '../core/engine/injector.js'
import { IndexedDBStore } from '../core/storage/memory_store.js'

// 全局引擎实例
let engine = null

// 初始化引擎
async function initEngine() {
  if (engine) return engine
  
  const store = new IndexedDBStore({
    dbName: 'v5_memory_web',
    namespace: 'default',
    platform: 'web'
  })
  await store.init()
  
  // 加载配置
  const config = await loadConfig()
  
  engine = new V5MetaEngine({
    gamma: config.gamma || 0.85,
    barrier: config.barrier || 0.5,
    writeThreshold: config.writeThreshold || 0.6,
    recallThreshold: config.recallThreshold || 0.5,
    platform: config.platform || 'deepseek',
    namespace: config.namespace || 'default',
    budget: config.budget || { persona: 3, core: 4, episodic: 6 }
  })
  
  engine.store = store
  
  console.log('[V5 Background] Engine initialized')
  return engine
}

// 加载配置
async function loadConfig() {
  return new Promise(resolve => {
    chrome.storage.local.get([
      'gamma', 'barrier', 'writeThreshold', 'recallThreshold',
      'platform', 'namespace', 'enabled'
    ], result => {
      resolve(result)
    })
  })
}

// 保存配置
async function saveConfig(config) {
  return new Promise(resolve => {
    chrome.storage.local.set(config, resolve)
  })
}

// 消息处理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse)
  return true // 异步响应
})

async function handleMessage(message, sender) {
  const { type, payload } = message
  
  try {
    const eng = await initEngine()
    
    switch (type) {
      case 'INIT':
        return { success: true, config: await loadConfig() }
        
      case 'PROCESS_TURN': {
        const { input, response, platform } = payload
        
        // 设置平台适配器
        eng.config.platform = platform
        eng.setPlatformAdapter(getAdapter(platform))
        
        const result = await eng.processTurn(input, response)
        return { success: true, result }
      }
      
      case 'RECALL': {
        const { query, platform } = payload
        eng.config.platform = platform
        const memories = await eng.recall(query)
        return { success: true, memories }
      }
      
      case 'GET_ALL': {
        const memories = await eng.store.query({})
        return { success: true, memories }
      }
      
      case 'ADD_MEMORY': {
        const { memory } = payload
        const id = await eng.store.add(memory)
        return { success: true, id }
      }
      
      case 'UPDATE_MEMORY': {
        const { memory } = payload
        await eng.store.update(memory)
        return { success: true }
      }
      
      case 'DELETE_MEMORY': {
        const { id } = payload
        await eng.store.delete(id)
        return { success: true }
      }
      
      case 'CLEAR': {
        await eng.store.clear()
        return { success: true }
      }
      
      case 'EXPORT': {
        const data = await eng.export('json')
        return { success: true, data }
      }
      
      case 'IMPORT': {
        const { data } = payload
        const count = await eng.import(data)
        return { success: true, count }
      }
      
      case 'UPDATE_CONFIG': {
        await saveConfig(payload)
        engine = null // 重建引擎
        return { success: true }
      }
      
      case 'GET_CONFIG':
        return { success: true, config: await loadConfig() }
        
      case 'GET_STATS': {
        const all = await eng.store.query({})
        return { success: true, stats: { total: all.length } }
      }
      
      default:
        return { error: 'Unknown message type' }
    }
  } catch (error) {
    console.error('[V5 Background] Error:', error)
    return { error: error.message }
  }
}

// 安装时初始化
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[V5] Extension installed')
  
  // 默认配置
  await saveConfig({
    enabled: true,
    gamma: 0.85,
    barrier: 0.5,
    writeThreshold: 0.6,
    recallThreshold: 0.5,
    platform: 'deepseek',
    namespace: 'default',
    autoExtract: true,
    autoInject: true
  })
})

// 定时清理过期记忆
chrome.alarms.create('cleanup', { periodInMinutes: 60 })

chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name === 'cleanup') {
    const eng = await initEngine()
    const cleaned = await eng.cleanup()
    if (cleaned > 0) {
      console.log(`[V5] Cleaned ${cleaned} expired memories`)
    }
  }
})

console.log('[V5 Background] Service worker loaded')
