/**
 * V5 Scientific Adapters - 科学模型适配器
 * 
 * 支持的科学模型：
 * 1. Graphormer - 分子结构理解
 * 2. ViSNet - 蛋白质结构预测
 * 3. AlphaFold - 蛋白质折叠
 * 4. Materials Project - 材料科学
 */

import { BaseAdapter } from '../adapt/base_adapter.js'

/**
 * 科学模型适配器基类
 */
export class ScientificAdapter extends BaseAdapter {
  constructor(options = {}) {
    super({
      name: options.name || 'scientific',
      platformWeight: 1.0
    })
    
    this.modelType = options.modelType || 'unknown'
    this.supportedFormats = options.supportedFormats || []
  }
  
  /**
   * 解析科学数据输入
   */
  parseScientificInput(input) {
    // 子类实现
    throw new Error('Not implemented')
  }
  
  /**
   * 格式化科学输出
   */
  formatScientificOutput(output) {
    // 子类实现
    throw new Error('Not implemented')
  }
  
  /**
   * 支持的数据格式
   */
  supportsFormat(format) {
    return this.supportedFormats.includes(format)
  }
}

/**
 * Graphormer 适配器 - 分子结构理解
 * 
 * 支持格式：SMILES, SMARTS, MOL, SDF
 */
export class GraphormerAdapter extends ScientificAdapter {
  constructor() {
    super({
      name: 'graphormer',
      modelType: 'molecular_structure',
      supportedFormats: ['smiles', 'smarts', 'mol', 'sdf']
    })
  }
  
  /**
   * 解析 SMILES 输入
   */
  parseScientificInput(input) {
    // 检测输入格式
    const format = this.detectFormat(input)
    
    switch (format) {
      case 'smiles':
        return { format: 'smiles', data: input.trim() }
      case 'smarts':
        return { format: 'smarts', data: input.trim() }
      case 'mol':
        return { format: 'mol', data: input }
      default:
        // 尝试解析为 SMILES
        return { format: 'smiles', data: input.trim() }
    }
  }
  
  /**
   * 检测格式
   */
  detectFormat(input) {
    const trimmed = input.trim()
    
    if (trimmed.includes('\n') && trimmed.includes('M  END')) {
      return 'mol'
    }
    
    if (/^[A-Za-z0-9+\-\[\]()=#@\/%!{}]+$/.test(trimmed)) {
      return 'smiles'
    }
    
    return 'unknown'
  }
  
  /**
   * 格式化输出
   */
  formatScientificOutput(output) {
    return {
      // 图结构特征
      graph_features: output.graph_embedding,
      
      // 分子性质
      properties: {
        atom_count: output.num_atoms,
        bond_count: output.num_bonds,
        molecular_weight: output.molecular_weight,
        logp: output.logp,
        tpsa: output.tpsa,
        num_rotatable_bonds: output.num_rotatable_bonds,
        num_hbd: output.num_hbd,
        num_hba: output.num_hba
      },
      
      // 预测属性
      predictions: {
        solubility: output.predicted_solubility,
        permeability: output.predicted_permeability,
        toxicity: output.predicted_toxicity,
        affinity: output.predicted_affinity
      },
      
      // 置信度
      confidence: output.confidence_score
    }
  }
  
  /**
   * 提取分子描述（用于记忆）
   */
  extractDescription(output) {
    const props = output.properties
    const predictions = output.predictions
    
    return `分子结构分析: ${props.atom_count}个原子, ${props.bond_count}个键。预测溶解度${predictions.solubility}, 渗透性${predictions.permeability}。置信度${(output.confidence * 100).toFixed(1)}%。`
  }
}

/**
 * ViSNet 适配器 - 蛋白质结构预测
 * 
 * 支持格式：FASTA, PDB, A3M
 */
export class ViSNetAdapter extends ScientificAdapter {
  constructor() {
    super({
      name: 'visnet',
      modelType: 'protein_structure',
      supportedFormats: ['fasta', 'pdb', 'a3m']
    })
  }
  
  /**
   * 解析蛋白质序列
   */
  parseScientificInput(input) {
    const format = this.detectProteinFormat(input)
    
    switch (format) {
      case 'fasta':
        return this.parseFASTA(input)
      case 'pdb':
        return { format: 'pdb', data: input }
      default:
        return this.parseFASTA(input)
    }
  }
  
  /**
   * 检测蛋白质格式
   */
  detectProteinFormat(input) {
    if (input.startsWith('>')) return 'fasta'
    if (input.includes('ATOM') || input.includes('HEADER')) return 'pdb'
    return 'sequence'
  }
  
  /**
   * 解析 FASTA
   */
  parseFASTA(input) {
    const lines = input.trim().split('\n')
    const header = lines[0]?.replace('>', '').trim() || ''
    const sequence = lines.slice(1).join('').replace(/\s/g, '')
    
    return {
      format: 'fasta',
      header,
      sequence,
      length: sequence.length
    }
  }
  
  /**
   * 格式化输出
   */
  formatScientificOutput(output) {
    return {
      // 蛋白质信息
      protein_info: {
        sequence_length: output.sequence_length,
        num_residues: output.num_residues,
        chain_id: output.chain_id
      },
      
      // 结构预测
      structure: {
        coordinates: output.atom_coordinates,
        confidence: output.plddt_scores,
        predicted_template: output.used_template
      },
      
      // 功能预测
      function: {
        go_terms: output.predicted_go_terms,
        enzyme_commission: output.predicted_ec,
        protein_family: output.predicted_family
      },
      
      // 置信度
      average_plddt: output.average_plddt,
      ptm_score: output.ptm_score
    }
  }
  
  /**
   * 提取描述
   */
  extractDescription(output) {
    return `蛋白质结构预测: ${output.protein_info.sequence_length}个氨基酸。平均置信度${(output.average_plddt).toFixed(1)}。预测功能: ${output.function.protein_family}。`
  }
}

/**
 * Materials Project 适配器 - 材料科学
 */
export class MaterialsProjectAdapter extends ScientificAdapter {
  constructor() {
    super({
      name: 'materials_project',
      modelType: 'materials_science',
      supportedFormats: ['composition', 'cif', 'poscar']
    })
  }
  
  /**
   * 解析材料组成
   */
  parseScientificInput(input) {
    // 检测化学式
    if (/^[A-Za-z0-9]+$/.test(input.trim())) {
      return { format: 'composition', formula: input.trim() }
    }
    
    return { format: 'unknown', data: input }
  }
  
  /**
   * 格式化输出
   */
  formatScientificOutput(output) {
    return {
      // 材料信息
      material: {
        formula: output.formula,
        composition: output.composition,
        structure_type: output.structure_type
      },
      
      // 物理性质
      properties: {
        band_gap: output.band_gap,
        total_energy: output.total_energy,
        energy_above_hull: output.energy_above_hull,
        magnetic_moment: output.magnetic_moment,
        density: output.density,
        volume: output.volume
      },
      
      // 电子性质
      electronic: {
        is_metal: output.is_metal,
        is_semiconductor: output.is_semiconductor,
        dielectric_constant: output.dielectric_constant
      },
      
      // 机械性质
      mechanical: {
        bulk_modulus: output.bulk_modulus,
        shear_modulus: output.shear_modulus,
        youngs_modulus: output.youngs_modulus,
        poisson_ratio: output.poisson_ratio
      }
    }
  }
  
  /**
   * 提取描述
   */
  extractDescription(output) {
    return `材料分析: ${output.material.formula}。带隙${output.properties.band_gap?.toFixed(2)}eV。${output.electronic.is_metal ? '金属材料' : '非金属材料'}。`
  }
}

/**
 * 科学模型管理器
 */
export class ScienceModelManager {
  constructor() {
    this.adapters = new Map()
    
    // 注册默认适配器
    this.register(new GraphormerAdapter())
    this.register(new ViSNetAdapter())
    this.register(new MaterialsProjectAdapter())
  }
  
  /**
   * 注册适配器
   */
  register(adapter) {
    this.adapters.set(adapter.name, adapter)
  }
  
  /**
   * 获取适配器
   */
  get(name) {
    return this.adapters.get(name)
  }
  
  /**
   * 自动检测适配器
   */
  detect(input) {
    for (const adapter of this.adapters.values()) {
      if (adapter.supportsFormat(adapter.detectFormat(input))) {
        return adapter
      }
    }
    return null
  }
  
  /**
   * 列出所有适配器
   */
  list() {
    return Array.from(this.adapters.values()).map(a => ({
      name: a.name,
      modelType: a.modelType,
      supportedFormats: a.supportedFormats
    }))
  }
}

export default {
  ScientificAdapter,
  GraphormerAdapter,
  ViSNetAdapter,
  MaterialsProjectAdapter,
  ScienceModelManager
}
