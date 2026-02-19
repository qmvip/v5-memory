/**
 * V5 Memory Store - 统一存储层
 * 
 * 支持 Node.js (文件系统) 和 Browser (IndexedDB)
 */

import fs from 'fs'
import path from 'path'

/**
 * Node.js 文件系统存储
 */
export class FileSystemStore {
  constructor(options = {}) {
    this.basePath = options.basePath || './data/memories'
    this.namespace = options.namespace || 'default'
    this.platform = options.platform || 'default'
    this.ensureDirectory()
  }
  
  ensureDirectory() {
    const dir = path.join(this.basePath, this.namespace, this.platform)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }
  
  getFilePath(id) {
    return path.join(
      this.basePath,
      this.namespace,
      this.platform,
      `${id}.json`
    )
  }
  
  async add(memory) {
    const id = memory.meta?.id || `mem_${Date.now()}`
    memory.meta.id = id
    
    const filePath = this.getFilePath(id)
    fs.writeFileSync(filePath, JSON.stringify(memory, null, 2))
    
    return id
  }
  
  async get(id) {
    const filePath = this.getFilePath(id)
    if (!fs.existsSync(filePath)) return null
    
    const content = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(content)
  }
  
  async update(memory) {
    const filePath = this.getFilePath(memory.meta.id)
    fs.writeFileSync(filePath, JSON.stringify(memory, null, 2))
    return true
  }
  
  async delete(id) {
    const filePath = this.getFilePath(id)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
    return true
  }
  
  async query(filters = {}) {
    const dir = path.join(this.basePath, this.namespace, this.platform)
    if (!fs.existsSync(dir)) return []
    
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'))
    const memories = []
    
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(dir, file), 'utf-8')
        const memory = JSON.parse(content)
        
        // 过滤
        if (this.matchesFilters(memory, filters)) {
          memories.push(memory)
        }
      } catch (e) {
        console.error(`[V5 Store] Error reading ${file}:`, e)
      }
    }
    
    return memories
  }
  
  matchesFilters(memory, filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (key === 'status') {
        if (memory.meta?.lifecycle?.status !== value) return false
      } else if (key === 'platform') {
        if (memory.meta?.platform !== value) return false
      } else if (key === 'namespace') {
        if (memory.meta?.namespace !== value) return false
      } else if (key === 'type') {
        if (memory.body?.type !== value) return false
      }
    }
    return true
  }
  
  async findSimilar(memory) {
    const all = await this.query({
      status: 'active',
      platform: memory.meta?.platform,
      namespace: memory.meta?.namespace
    })
    
    // 简单相似度比较
    for (const m of all) {
      const similarity = this.textSimilarity(memory.body.text, m.body.text)
      if (similarity > 0.8) return m
    }
    
    return null
  }
  
  textSimilarity(a, b) {
    const setA = new Set(a.toLowerCase().split(/\s+/))
    const setB = new Set(b.toLowerCase().split(/\s+/))
    const intersection = [...setA].filter(x => setB.has(x))
    const union = new Set([...setA, ...setB])
    return intersection.length / union.size
  }
  
  async count(filters = {}) {
    const all = await this.query(filters)
    return all.length
  }
  
  async clear() {
    const dir = path.join(this.basePath, this.namespace, this.platform)
    if (!fs.existsSync(dir)) return 0
    
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'))
    for (const file of files) {
      fs.unlinkSync(path.join(dir, file))
    }
    return files.length
  }
}

/**
 * 浏览器 IndexedDB 存储
 */
export class IndexedDBStore {
  constructor(options = {}) {
    this.dbName = options.dbName || 'v5_memory'
    this.storeName = options.storeName || 'memories'
    this.db = null
  }
  
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve(this.db)
      }
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result
        
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'meta.id' })
          
          // 创建索引
          store.createIndex('platform', 'meta.platform', { unique: false })
          store.createIndex('namespace', 'meta.namespace', { unique: false })
          store.createIndex('type', 'body.type', { unique: false })
          store.createIndex('status', 'meta.lifecycle.status', { unique: false })
          store.createIndex('createdAt', 'meta.lifecycle.createdAt', { unique: false })
        }
      }
    })
  }
  
  async add(memory) {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readwrite')
      const store = tx.objectStore(this.storeName)
      const request = store.add(memory)
      
      request.onsuccess = () => resolve(memory.meta.id)
      request.onerror = () => reject(request.error)
    })
  }
  
  async get(id) {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readonly')
      const store = tx.objectStore(this.storeName)
      const request = store.get(id)
      
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }
  
  async update(memory) {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readwrite')
      const store = tx.objectStore(this.storeName)
      const request = store.put(memory)
      
      request.onsuccess = () => resolve(true)
      request.onerror = () => reject(request.error)
    })
  }
  
  async delete(id) {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readwrite')
      const store = tx.objectStore(this.storeName)
      const request = store.delete(id)
      
      request.onsuccess = () => resolve(true)
      request.onerror = () => reject(request.error)
    })
  }
  
  async query(filters = {}) {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readonly')
      const store = tx.objectStore(this.storeName)
      const request = store.getAll()
      
      request.onsuccess = () => {
        let results = request.result
        
        // 内存过滤
        results = results.filter(m => this.matchesFilters(m, filters))
        resolve(results)
      }
      request.onerror = () => reject(request.error)
    })
  }
  
  matchesFilters(memory, filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (key === 'status') {
        if (memory.meta?.lifecycle?.status !== value) return false
      } else if (key === 'platform') {
        if (memory.meta?.platform !== value) return false
      } else if (key === 'namespace') {
        if (memory.meta?.namespace !== value) return false
      } else if (key === 'type') {
        if (memory.body?.type !== value) return false
      }
    }
    return true
  }
  
  async findSimilar(memory) {
    const all = await this.query({ status: 'active' })
    
    for (const m of all) {
      const similarity = this.textSimilarity(memory.body.text, m.body.text)
      if (similarity > 0.8) return m
    }
    
    return null
  }
  
  textSimilarity(a, b) {
    const setA = new Set(a.toLowerCase().split(/\s+/))
    const setB = new Set(b.toLowerCase().split(/\s+/))
    const intersection = [...setA].filter(x => setB.has(x))
    const union = new Set([...setA, ...setB])
    return intersection.length / union.size
  }
  
  async count(filters = {}) {
    const all = await this.query(filters)
    return all.length
  }
  
  async clear() {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readwrite')
      const store = tx.objectStore(this.storeName)
      const request = store.clear()
      
      request.onsuccess = () => resolve(true)
      request.onerror = () => reject(request.error)
    })
  }
}

/**
 * 统一存储接口
 */
export class V5MemoryStore {
  constructor(options = {}) {
    this.options = options
    this.store = options.useFileSystem 
      ? new FileSystemStore(options)
      : new IndexedDBStore(options)
  }
  
  async init() {
    if (this.store.init) {
      await this.store.init()
    }
    return this
  }
  
  async add(memory) {
    return this.store.add(memory)
  }
  
  async get(id) {
    return this.store.get(id)
  }
  
  async update(memory) {
    return this.store.update(memory)
  }
  
  async delete(id) {
    return this.store.delete(id)
  }
  
  async query(filters) {
    return this.store.query(filters)
  }
  
  async findSimilar(memory) {
    return this.store.findSimilar(memory)
  }
  
  async count(filters) {
    return this.store.count(filters)
  }
  
  async clear() {
    return this.store.clear()
  }
}

export default {
  FileSystemStore,
  IndexedDBStore,
  V5MemoryStore
}
