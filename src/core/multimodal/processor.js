/**
 * V5 Multimodal - 多模态科学数据处理
 * 
 * 支持：
 * 1. 科学图像 (显微镜图像、光谱图、实验照片)
 * 2. 谱图数据 (NMR, MS, IR, UV-Vis)
 * 3. 分子结构式 (SMILES, MOL, SDF)
 * 4. 蛋白质结构 (PDB, FASTA)
 */

import { BaseAdapter } from '../adapt/base_adapter.js'

/**
 * 多模态数据类型
 */
export const MULTIMODAL_TYPES = {
  IMAGE: 'image',           // 图像
  SPECTRUM: 'spectrum',    // 谱图
  MOLECULE: 'molecule',    // 分子结构
  PROTEIN: 'protein',      // 蛋白质
  TABLE: 'table',           // 表格数据
  TEXT: 'text'             // 文本
}

/**
 * 支持的文件格式
 */
export const SUPPORTED_FORMATS = {
  [MULTIMODAL_TYPES.IMAGE]: ['jpg', 'jpeg', 'png', 'tif', 'tiff', 'bmp', 'gif'],
  [MULTIMODAL_TYPES.SPECTRUM]: ['json', 'csv', 'dx', 'asc'],
  [MULTIMODAL_TYPES.MOLECULE]: ['smiles', 'smarts', 'mol', 'sdf', 'pdb'],
  [MULTIMODAL_TYPES.PROTEIN]: ['fasta', 'pdb', 'a3m', 'seq'],
  [MULTIMODAL_TYPES.TABLE]: ['csv', 'tsv', 'xlsx', 'json'],
  [MULTIMODAL_TYPES.TEXT]: ['txt', 'md', 'json']
}

/**
 * 多模态处理器
 */
export class MultimodalProcessor {
  constructor(options = {}) {
    this.config = {
      // 是否提取特征
      extractFeatures: options.extractFeatures ?? true,
      
      // 是否生成描述
      generateDescription: options.generateDescription ?? true,
      
      // 图像处理配置
      imageConfig: options.imageConfig || {
        maxSize: 2048,
        thumbnailSize: 256,
        enableOCR: false
      },
      
      // 谱图处理配置
      spectrumConfig: options.spectrumConfig || {
        normalize: true,
        baseline: true
      },
      
      ...options
    }
    
    // 注册处理器
    this.handlers = new Map()
    this.registerDefaultHandlers()
  }
  
  /**
   * 注册默认处理器
   */
  registerDefaultHandlers() {
    this.register(MULTIMODAL_TYPES.IMAGE, new ImageHandler(this.config.imageConfig))
    this.register(MULTIMODAL_TYPES.SPECTRUM, new SpectrumHandler(this.config.spectrumConfig))
    this.register(MULTIMODAL_TYPES.MOLECULE, new MoleculeHandler())
    this.register(MULTIMODAL_TYPES.PROTEIN, new ProteinHandler())
    this.register(MULTIMODAL_TYPES.TABLE, new TableHandler())
  }
  
  /**
   * 注册处理器
   */
  register(type, handler) {
    this.handlers.set(type, handler)
  }
  
  /**
   * 检测数据类型
   */
  detectType(input) {
    // 根据扩展名检测
    if (input instanceof File || input.name) {
      const ext = input.name.split('.').pop().toLowerCase()
      
      for (const [type, formats] of Object.entries(SUPPORTED_FORMATS)) {
        if (formats.includes(ext)) {
          return type
        }
      }
    }
    
    // 根据内容检测
    if (typeof input === 'string') {
      // SMILES
      if (/^[A-Za-z0-9+\-\[\]()=#@\/%!{}]+$/.test(input.trim())) {
        return MULTIMODAL_TYPES.MOLECULE
      }
      
      // FASTA
      if (input.startsWith('>') || /^[ACDEFGHIKLMNPQRSTVWY]+$/i.test(input.trim())) {
        return MULTIMODAL_TYPES.PROTEIN
      }
      
      // JSON
      try {
        const parsed = JSON.parse(input)
        if (Array.isArray(parsed) || parsed.data) {
          return MULTIMODAL_TYPES.SPECTRUM
        }
      } catch (e) {}
    }
    
    return MULTIMODAL_TYPES.TEXT
  }
  
  /**
   * 处理输入
   */
  async process(input, options = {}) {
    const type = options.type || this.detectType(input)
    const handler = this.handlers.get(type)
    
    if (!handler) {
      throw new Error(`No handler for type: ${type}`)
    }
    
    const result = await handler.process(input, options)
    
    // 生成描述
    if (this.config.generateDescription && result.description === undefined) {
      result.description = await this.generateDescription(result)
    }
    
    // 提取特征
    if (this.config.extractFeatures && result.features === undefined) {
      result.features = await this.extractFeatures(result)
    }
    
    return {
      type,
      data: result.data,
      metadata: result.metadata || {},
      description: result.description,
      features: result.features,
      processedAt: new Date().toISOString()
    }
  }
  
  /**
   * 生成描述
   */
  async generateDescription(result) {
    const type = result.type
    
    switch (type) {
      case MULTIMODAL_TYPES.IMAGE:
        return `图像: ${result.metadata.width}x${result.metadata.height}像素`
      
      case MULTIMODAL_TYPES.SPECTRUM:
        return `谱图数据: ${result.data.points}个数据点`
      
      case MULTIMODAL_TYPES.MOLECULE:
        return `分子: ${result.metadata.formula}, ${result.metadata.atomCount}个原子`
      
      case MULTIMODAL_TYPES.PROTEIN:
        return `蛋白质: ${result.metadata.sequenceLength}个氨基酸`
      
      default:
        return '数据处理完成'
    }
  }
  
  /**
   * 提取特征
   */
  async extractFeatures(result) {
    // 简单特征提取（实际应对接模型）
    const features = {
      size: JSON.stringify(result.data).length,
      type: result.type,
      timestamp: Date.now()
    }
    
    return features
  }
  
  /**
   * 批量处理
   */
  async processBatch(inputs, options = {}) {
    const results = []
    
    for (const input of inputs) {
      try {
        const result = await this.process(input, options)
        results.push(result)
      } catch (error) {
        results.push({ error: error.message, input: input.name || input })
      }
    }
    
    return results
  }
}

/**
 * 图像处理器
 */
class ImageHandler {
  constructor(config = {}) {
    this.config = config
  }
  
  async process(input, options = {}) {
    const metadata = {
      name: input.name,
      size: input.size,
      type: input.type
    }
    
    // 读取图像
    const data = await this.readImage(input)
    
    return {
      data,
      metadata: {
        ...metadata,
        width: data.width,
        height: data.height,
        channels: data.channels
      }
    }
  }
  
  async readImage(input) {
    // 简单处理（实际应用需对接图像库）
    return {
      width: 1024,
      height: 1024,
      channels: 3,
      data: new Uint8Array(1024 * 1024 * 3)
    }
  }
}

/**
 * 谱图处理器
 */
class SpectrumHandler {
  constructor(config = {}) {
    this.config = config
  }
  
  async process(input, options = {}) {
    // 解析谱图数据
    const data = await this.parseSpectrum(input)
    
    // 处理
    let processed = data
    if (this.config.normalize) {
      processed = this.normalize(data)
    }
    if (this.config.baseline) {
      processed = this.correctBaseline(processed)
    }
    
    return {
      data: processed,
      metadata: {
        type: data.type,
        points: processed.length,
        range: [data.xMin, data.xMax]
      }
    }
  }
  
  async parseSpectrum(input) {
    // 简单解析（实际需对接具体格式）
    if (typeof input === 'string') {
      try {
        const data = JSON.parse(input)
        return {
          x: data.x || [],
          y: data.y || [],
          type: 'unknown',
          xMin: Math.min(...(data.x || [0])),
          xMax: Math.max(...(data.x || [1]))
        }
      } catch (e) {
        // 尝试 CSV
        return this.parseCSV(input)
      }
    }
    
    return { x: [], y: [], type: 'unknown', xMin: 0, xMax: 1 }
  }
  
  parseCSV(content) {
    const lines = content.trim().split('\n')
    const x = []
    const y = []
    
    for (const line of lines.slice(1)) {
      const [xi, yi] = line.split(',').map(Number)
      if (!isNaN(xi) && !isNaN(yi)) {
        x.push(xi)
        y.push(yi)
      }
    }
    
    return {
      x,
      y,
      type: 'csv',
      xMin: Math.min(...x),
      xMax: Math.max(...x)
    }
  }
  
  normalize(data) {
    const y = data.y
    const max = Math.max(...y)
    const min = Math.min(...y)
    
    return {
      ...data,
      y: y.map(v => (v - min) / (max - min) || 0)
    }
  }
  
  correctBaseline(data) {
    // 简单基线校正
    const y = data.y
    const baseline = Math.min(...y)
    
    return {
      ...data,
      y: y.map(v => v - baseline)
    }
  }
}

/**
 * 分子结构处理器
 */
class MoleculeHandler {
  async process(input, options = {}) {
    const format = this.detectFormat(input)
    const parsed = this.parse(input, format)
    const metadata = this.calculateProperties(parsed)
    
    return {
      data: parsed,
      metadata
    }
  }
  
  detectFormat(input) {
    const text = typeof input === 'string' ? input : ''
    
    if (text.includes('\n') && text.includes('M  END')) return 'mol'
    if (/^[A-Za-z0-9+\-\[\]()=#@\/%!{}]+$/.test(text.trim())) return 'smiles'
    
    return 'smiles'
  }
  
  parse(input, format) {
    if (format === 'smiles') {
      return this.parseSMILES(input)
    }
    
    return { atoms: [], bonds: [] }
  }
  
  parseSMILES(smiles) {
    // 简单解析（实际需对接 RDKit 等）
    const atoms = []
    const bonds = []
    
    // 统计元素
    const elementRegex = /[A-Z][a-z]?/g
    const elements = smiles.match(elementRegex) || []
    
    for (const el of new Set(elements)) {
      atoms.push({ element: el, count: elements.filter(e => e === el).length })
    }
    
    return {
      smiles,
      atoms,
      bonds,
      formula: this.getFormula(elements)
    }
  }
  
  getFormula(elements) {
    const counts = {}
    for (const el of elements) {
      counts[el] = (counts[el] || 0) + 1
    }
    
    return Object.entries(counts)
      .sort((a, b) => {
        const order = ['C', 'H', 'N', 'O', 'S', 'P', 'F', 'Cl', 'Br', 'I']
        return (order.indexOf(a[0]) - order.indexOf(b[0]))
      })
      .map(([el, count]) => count === 1 ? el : `${el}${count}`)
      .join('')
  }
  
  calculateProperties(parsed) {
    const atomCount = parsed.atoms?.reduce((sum, a) => sum + a.count, 0) || 0
    const bondCount = parsed.bonds?.length || 0
    
    return {
      formula: parsed.formula,
      atomCount,
      bondCount,
      smiles: parsed.smiles
    }
  }
}

/**
 * 蛋白质处理器
 */
class ProteinHandler {
  async process(input, options = {}) {
    const format = this.detectFormat(input)
    const parsed = this.parse(input, format)
    const metadata = this.calculateProperties(parsed)
    
    return {
      data: parsed,
      metadata
    }
  }
  
  detectFormat(input) {
    const text = typeof input === 'string' ? input : ''
    
    if (text.startsWith('>')) return 'fasta'
    if (text.includes('ATOM')) return 'pdb'
    
    return 'sequence'
  }
  
  parse(input, format) {
    if (format === 'fasta') {
      return this.parseFASTA(input)
    }
    
    return { sequence: input.toString().trim() }
  }
  
  parseFASTA(content) {
    const lines = content.trim().split('\n')
    const header = lines[0]?.replace('>', '').trim() || ''
    const sequence = lines.slice(1).join('').replace(/\s/g, '')
    
    return {
      header,
      sequence,
      length: sequence.length
    }
  }
  
  calculateProperties(parsed) {
    const seq = parsed.sequence || ''
    
    // 氨基酸组成
    const composition = {}
    for (const aa of seq) {
      composition[aa] = (composition[aa] || 0) + 1
    }
    
    // 分子量计算
    const mw = this.calculateMolecularWeight(seq)
    
    return {
      sequenceLength: seq.length,
      composition,
      molecularWeight: mw,
      header: parsed.header
    }
  }
  
  calculateMolecularWeight(sequence) {
    // 氨基酸分子量
    const aaWeights = {
      A: 89.1, R: 174.2, N: 132.1, D: 133.1, C: 121.2,
      Q: 146.2, E: 147.1, G: 75.1, H: 155.2, I: 131.2,
      L: 131.2, K: 146.2, M: 149.2, F: 165.2, P: 115.1,
      S: 105.1, T: 119.1, W: 204.2, Y: 181.2, V: 117.1
    }
    
    let mw = 0
    for (const aa of sequence) {
      mw += aaWeights[aa] || 110
    }
    
    // 减去水分子
    mw -= (sequence.length - 1) * 18
    
    return mw
  }
}

/**
 * 表格处理器
 */
class TableHandler {
  async process(input, options = {}) {
    const data = await this.parse(input)
    
    const stats = this.calculateStats(data)
    
    return {
      data,
      metadata: {
        rows: data.length,
        columns: data[0] ? Object.keys(data[0]).length : 0,
        stats
      }
    }
  }
  
  async parse(input) {
    if (typeof input === 'string') {
      try {
        const json = JSON.parse(input)
        return Array.isArray(json) ? json : [json]
      } catch (e) {
        return this.parseCSV(input)
      }
    }
    
    return []
  }
  
  parseCSV(content) {
    const lines = content.trim().split('\n')
    const headers = lines[0].split(',').map(h => h.trim())
    
    const data = []
    for (const line of lines.slice(1)) {
      const values = line.split(',')
      const row = {}
      
      for (let i = 0; i < headers.length; i++) {
        const val = values[i]?.trim()
        row[headers[i]] = isNaN(Number(val)) ? val : Number(val)
      }
      
      data.push(row)
    }
    
    return data
  }
  
  calculateStats(data) {
    if (data.length === 0) return {}
    
    const numericColumns = {}
    
    for (const row of data) {
      for (const [key, val] of Object.entries(row)) {
        if (typeof val === 'number') {
          if (!numericColumns[key]) {
            numericColumns[key] = []
          }
          numericColumns[key].push(val)
        }
      }
    }
    
    const stats = {}
    for (const [col, values] of Object.entries(numericColumns)) {
      const sum = values.reduce((a, b) => a + b, 0)
      stats[col] = {
        mean: sum / values.length,
        min: Math.min(...values),
        max: Math.max(...values)
      }
    }
    
    return stats
  }
}

export default {
  MultimodalProcessor,
  MULTIMODAL_TYPES,
  SUPPORTED_FORMATS
}
