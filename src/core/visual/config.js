/**
 * V5 Visual Config - 低代码可视化配置
 * 
 * 让非程序员也能轻松配置 V5 记忆系统
 * 
 * 包含：
 * 1. 工作流编辑器
 * 2. 触发规则配置
 * 3. 角色/场景管理
 * 4. 记忆中心可视化
 */

/**
 * 可视化配置项定义
 */
export const CONFIG_COMPONENTS = {
  // 基础配置
  TEXT_INPUT: 'text_input',
  NUMBER_INPUT: 'number_input',
  SLIDER: 'slider',
  TOGGLE: 'toggle',
  SELECT: 'select',
  MULTI_SELECT: 'multi_select',
  
  // 高级配置
  JSON_EDITOR: 'json_editor',
  CODE_EDITOR: 'code_editor',
  REGEX_INPUT: 'regex_input',
  
  // 特殊配置
  THEME_PICKER: 'theme_picker',
  ICON_PICKER: 'icon_picker',
  COLOR_PICKER: 'color_picker',
  
  // 记忆相关
  MEMORY_TYPE_SELECT: 'memory_type_select',
  KEYWORD_TAGS: 'keyword_tags',
  PLATFORM_CHECKBOX: 'platform_checkbox',
  
  // 工作流
  WORKFLOW_NODE: 'workflow_node',
  TRIGGER_CONDITION: 'trigger_condition',
  ACTION_CONFIG: 'action_config'
}

/**
 * V5 配置模式定义
 */
export const V5_CONFIG_SCHEMA = {
  // V5 势垒参数
  v5: {
    label: 'V5 势垒参数',
    description: '核心记忆激活参数配置',
    components: [
      {
        key: 'gamma',
        type: CONFIG_COMPONENTS.SLIDER,
        label: 'Gamma (响应强度)',
        description: '控制记忆激活的敏感度',
        min: 0.5,
        max: 1.5,
        step: 0.05,
        default: 0.85
      },
      {
        key: 'barrier',
        type: CONFIG_COMPONENTS.SLIDER,
        label: 'Barrier (阈值)',
        description: '记忆激活的临界阈值',
        min: 0.3,
        max: 0.9,
        step: 0.05,
        default: 0.5
      }
    ]
  },
  
  // 平台配置
  platforms: {
    label: '平台适配',
    description: '选择需要适配的 AI 平台',
    components: [
      {
        key: 'enabledPlatforms',
        type: CONFIG_COMPONENTS.PLATFORM_CHECKBOX,
        label: '启用平台',
        options: [
          { value: 'deepseek', label: 'DeepSeek', icon: '🔵' },
          { value: 'chatgpt', label: 'ChatGPT', icon: '🟢' },
          { value: 'claude', label: 'Claude', icon: '🟤' },
          { value: 'gemini', label: 'Gemini', icon: '🔷' },
          { value: 'cursor', label: 'Cursor', icon: '💻' },
          { value: 'windsurf', label: 'Windsurf', icon: '🌊' },
          { value: 'cline', label: 'Cline', icon: '⌨️' }
        ],
        default: ['deepseek', 'chatgpt', 'claude']
      }
    ]
  },
  
  // 记忆配置
  memory: {
    label: '记忆设置',
    description: '记忆提取和召回配置',
    components: [
      {
        key: 'autoExtract',
        type: CONFIG_COMPONENTS.TOGGLE,
        label: '自动提取',
        description: '从 AI 响应中自动提取记忆',
        default: true
      },
      {
        key: 'autoInject',
        type: CONFIG_COMPONENTS.TOGGLE,
        label: '自动注入',
        description: '自动将记忆注入到请求中',
        default: true
      },
      {
        key: 'writeThreshold',
        type: CONFIG_COMPONENTS.SLIDER,
        label: '写入阈值',
        description: '记忆写入的最低得分',
        min: 0.3,
        max: 0.9,
        step: 0.05,
        default: 0.6
      },
      {
        key: 'recallThreshold',
        type: CONFIG_COMPONENTS.SLIDER,
        label: '召回阈值',
        description: '记忆召回的最低得分',
        min: 0.2,
        max: 0.8,
        step: 0.05,
        default: 0.5
      }
    ]
  },
  
  // 记忆类型配额
  budget: {
    label: '注入配额',
    description: '不同类型记忆的注入数量限制',
    components: [
      {
        key: 'personaBudget',
        type: CONFIG_COMPONENTS.NUMBER_INPUT,
        label: '用户画像配额',
        min: 1,
        max: 10,
        default: 3
      },
      {
        key: 'coreBudget',
        type: CONFIG_COMPONENTS.NUMBER_INPUT,
        label: '核心记忆配额',
        min: 1,
        max: 10,
        default: 4
      },
      {
        key: 'episodicBudget',
        type: CONFIG_COMPONENTS.NUMBER_INPUT,
        label: '情境记忆配额',
        min: 1,
        max: 20,
        default: 6
      }
    ]
  },
  
  // 安全配置
  security: {
    label: '安全设置',
    description: '敏感信息处理配置',
    components: [
      {
        key: 'autoMaskSensitive',
        type: CONFIG_COMPONENTS.TOGGLE,
        label: '自动脱敏',
        description: '自动识别并脱敏敏感信息',
        default: true
      },
      {
        key: 'sensitivityPatterns',
        type: CONFIG_COMPONENTS.JSON_EDITOR,
        label: '敏感词模式',
        description: '自定义敏感信息检测正则',
        default: [
          '/password/i',
          '/api[_-]?key/i',
          '/token/i'
        ]
      }
    ]
  },
  
  // 存储配置
  storage: {
    label: '存储设置',
    description: '记忆存储配置',
    components: [
      {
        key: 'storageTier',
        type: CONFIG_COMPONENTS.SELECT,
        label: '存储层级',
        options: [
          { value: 'hot', label: '热存储 (内存)' },
          { value: 'warm', label: '温存储 (SSD)' },
          { value: 'cold', label: '冷存储 (磁盘)' },
          { value: 'hierarchical', label: '分层存储 (自动)' }
        ],
        default: 'hierarchical'
      },
      {
        key: 'maxMemory',
        type: CONFIG_COMPONENTS.NUMBER_INPUT,
        label: '最大记忆数',
        min: 100,
        max: 100000,
        step: 100,
        default: 10000
      }
    ]
  }
}

/**
 * 工作流节点类型
 */
export const WORKFLOW_NODE_TYPES = {
  TRIGGER: 'trigger',
  CONDITION: 'condition',
  ACTION: 'action',
  FILTER: 'filter',
  TRANSFORM: 'transform',
  STORAGE: 'storage',
  OUTPUT: 'output'
}

/**
 * 工作流节点模板
 */
export const WORKFLOW_TEMPLATES = {
  // 触发器模板
  trigger: {
    on_message: {
      name: '收到消息',
      type: WORKFLOW_NODE_TYPES.TRIGGER,
      config: {
        platforms: ['deepseek', 'chatgpt', 'claude']
      }
    },
    on_schedule: {
      name: '定时触发',
      type: WORKFLOW_NODE_TYPES.TRIGGER,
      config: {
        cron: '0 * * * *',
        interval: 3600000
      }
    },
    on_threshold: {
      name: '阈值触发',
      type: WORKFLOW_NODE_TYPES.TRIGGER,
      config: {
        metric: 'recallScore',
        threshold: 0.5
      }
    }
  },
  
  // 条件模板
  condition: {
    if_type: {
      name: '如果类型',
      type: WORKFLOW_NODE_TYPES.CONDITION,
      config: {
        field: 'body.type',
        operator: 'equals',
        value: 'persona'
      }
    },
    if_platform: {
      name: '如果平台',
      type: WORKFLOW_NODE_TYPES.CONDITION,
      config: {
        field: 'meta.platform',
        operator: 'in',
        value: []
      }
    },
    if_score: {
      name: '如果得分',
      type: WORKFLOW_NODE_TYPES.CONDITION,
      config: {
        field: 'recallScore',
        operator: 'gte',
        value: 0.5
      }
    }
  },
  
  // 动作模板
  action: {
    extract_memory: {
      name: '提取记忆',
      type: WORKFLOW_NODE_TYPES.ACTION,
      config: {
        method: 'extract',
        confidence: 0.7
      }
    },
    inject_memory: {
      name: '注入记忆',
      type: WORKFLOW_NODE_TYPES.ACTION,
      config: {
        method: 'inject',
        budget: 10
      }
    },
    save_memory: {
      name: '保存记忆',
      type: WORKFLOW_NODE_TYPES.ACTION,
      config: {
        method: 'save',
        compress: true
      }
    },
    send_notification: {
      name: '发送通知',
      type: WORKFLOW_NODE_TYPES.ACTION,
      config: {
        method: 'notify',
        channel: 'system'
      }
    }
  },
  
  // 过滤器模板
  filter: {
    filter_by_type: {
      name: '按类型过滤',
      type: WORKFLOW_NODE_TYPES.FILTER,
      config: {
        field: 'body.type',
        keep: ['persona', 'core']
      }
    },
    filter_by_score: {
      name: '按得分过滤',
      type: WORKFLOW_NODE_TYPES.FILTER,
      config: {
        field: 'recallScore',
        min: 0.3
      }
    }
  },
  
  // 存储模板
  storage: {
    save_to_hot: {
      name: '保存到热存储',
      type: WORKFLOW_NODE_TYPES.STORAGE,
      config: {
        tier: 'hot'
      }
    },
    archive_to_cold: {
      name: '归档到冷存储',
      type: WORKFLOW_NODE_TYPES.STORAGE,
      config: {
        tier: 'cold'
      }
    }
  }
}

/**
 * 角色配置模板
 */
export const ROLE_TEMPLATES = {
  developer: {
    name: '开发者',
    description: '适合程序员使用的配置',
    config: {
      v5: { gamma: 0.9, barrier: 0.6 },
      platforms: ['cursor', 'windsurf', 'cline', 'chatgpt'],
      budget: { persona: 5, core: 6, episodic: 10 },
      memory: {
        autoExtract: true,
        autoInject: true,
        writeThreshold: 0.7,
        recallThreshold: 0.6
      }
    }
  },
  
  researcher: {
    name: '研究人员',
    description: '适合科研人员使用的配置',
    config: {
      v5: { gamma: 0.85, barrier: 0.5 },
      platforms: ['chatgpt', 'claude', 'gemini'],
      budget: { persona: 4, core: 5, episodic: 8 },
      memory: {
        autoExtract: true,
        autoInject: true,
        writeThreshold: 0.6,
        recallThreshold: 0.5
      }
    }
  },
  
  writer: {
    name: '写作者',
    description: '适合内容创作者使用的配置',
    config: {
      v5: { gamma: 0.8, barrier: 0.45 },
      platforms: ['chatgpt', 'claude', 'deepseek'],
      budget: { persona: 3, core: 4, episodic: 6 },
      memory: {
        autoExtract: true,
        autoInject: true,
        writeThreshold: 0.55,
        recallThreshold: 0.45
      }
    }
  },
  
  student: {
    name: '学生',
    description: '适合学习者使用的配置',
    config: {
      v5: { gamma: 0.75, barrier: 0.4 },
      platforms: ['chatgpt', 'deepseek'],
      budget: { persona: 5, core: 8, episodic: 12 },
      memory: {
        autoExtract: true,
        autoInject: true,
        writeThreshold: 0.5,
        recallThreshold: 0.4
      }
    }
  }
}

/**
 * 可视化配置管理器
 */
export class VisualConfigManager {
  constructor() {
    this.config = {}
    this.workflows = []
    this.roles = []
    this.history = []
  }
  
  /**
   * 获取配置模式
   */
  getSchema() {
    return V5_CONFIG_SCHEMA
  }
  
  /**
   * 获取工作流模板
   */
  getWorkflowTemplates() {
    return WORKFLOW_TEMPLATES
  }
  
  /**
   * 获取角色模板
   */
  getRoleTemplates() {
    return ROLE_TEMPLATES
  }
  
  /**
   * 应用角色模板
   */
  applyRoleTemplate(templateName) {
    const template = ROLE_TEMPLATES[templateName]
    if (!template) {
      throw new Error(`Role template not found: ${templateName}`)
    }
    
    this.config = { ...this.config, ...template.config }
    this.roles.push({
      name: template.name,
      appliedAt: new Date().toISOString()
    })
    
    return this.config
  }
  
  /**
   * 更新配置
   */
  updateConfig(section, key, value) {
    if (!this.config[section]) {
      this.config[section] = {}
    }
    
    const oldValue = this.config[section][key]
    this.config[section][key] = value
    
    // 记录历史
    this.history.push({
      section,
      key,
      oldValue,
      newValue: value,
      timestamp: new Date().toISOString()
    })
  }
  
  /**
   * 导出配置
   */
  exportConfig(format = 'json') {
    if (format === 'json') {
      return JSON.stringify(this.config, null, 2)
    }
    
    if (format === 'base64') {
      return btoa(JSON.stringify(this.config))
    }
    
    throw new Error(`Unsupported format: ${format}`)
  }
  
  /**
   * 导入配置
   */
  importConfig(data, format = 'json') {
    if (format === 'json') {
      this.config = JSON.parse(data)
    } else if (format === 'base64') {
      this.config = JSON.parse(atob(data))
    }
    
    return this.config
  }
  
  /**
   * 获取配置
   */
  getConfig() {
    return { ...this.config }
  }
  
  /**
   * 重置配置
   */
  resetConfig() {
    this.config = {}
    this.history = []
  }
  
  /**
   * 撤销
   */
  undo() {
    if (this.history.length === 0) return null
    
    const lastChange = this.history.pop()
    this.config[lastChange.section][lastChange.key] = lastChange.oldValue
    
    return lastChange
  }
  
  /**
   * 获取历史
   */
  getHistory() {
    return [...this.history]
  }
}

export default {
  CONFIG_COMPONENTS,
  V5_CONFIG_SCHEMA,
  WORKFLOW_NODE_TYPES,
  WORKFLOW_TEMPLATES,
  ROLE_TEMPLATES,
  VisualConfigManager
}
