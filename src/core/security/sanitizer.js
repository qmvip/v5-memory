/**
 * V5 Meta-Security Layer - 敏感信息处理
 * 
 * 负责敏感信息识别、脱敏处理、安全审计
 */

import { v5BarrierEquation } from '../engine/scorer.js'

/**
 * 默认敏感信息检测模式
 */
export const DEFAULT_SENSITIVITY_PATTERNS = [
  // 密码相关
  { pattern: /password/i, type: 'password', severity: 'highly_sensitive' },
  { pattern: /pwd/i, type: 'password', severity: 'highly_sensitive' },
  { pattern: /passwd/i, type: 'password', severity: 'highly_sensitive' },
  
  // API Key / Token
  { pattern: /api[_-]?key/i, type: 'api_key', severity: 'highly_sensitive' },
  { pattern: /secret[_-]?key/i, type: 'api_key', severity: 'highly_sensitive' },
  { pattern: /access[_-]?token/i, type: 'token', severity: 'highly_sensitive' },
  { pattern: /bearer\s+[a-zA-Z0-9\-_.~+/]+=*/i, type: 'token', severity: 'highly_sensitive' },
  { pattern: /token[\"':\s]*[a-zA-Z0-9\-_.~+/]+=*/i, type: 'token', severity: 'highly_sensitive' },
  
  // 私钥
  { pattern: /private[_-]?key/i, type: 'private_key', severity: 'highly_sensitive' },
  { pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/i, type: 'private_key', severity: 'highly_sensitive' },
  
  // 数字敏感信息
  { pattern: /\b\d{16,}\b/, type: 'long_number', severity: 'sensitive' },  // 长数字
  { pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/, type: 'card_number', severity: 'highly_sensitive' },  // 银行卡
  { pattern: /\b1[3-9]\d{9}\b/, type: 'phone', severity: 'sensitive' },  // 手机号
  
  // 邮箱（相对敏感）
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, type: 'email', severity: 'sensitive' },
  
  // 身份证
  { pattern: /\b[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b/, type: 'id_card', severity: 'highly_sensitive' },
  
  // OAuth
  { pattern: /oauth[_-]?secret/i, type: 'oauth_secret', severity: 'highly_sensitive' },
  
  // AWS
  { pattern: /AKIA[0-9A-Z]{16}/, type: 'aws_key', severity: 'highly_sensitive' },
  
  // 通用凭证关键词
  { pattern: /(?:credit|card|cvv|security\s+code)/i, type: 'payment', severity: 'highly_sensitive' }
]

/**
 * 敏感信息检测器
 */
export class SensitivityDetector {
  constructor(patterns = DEFAULT_SENSITIVITY_PATTERNS) {
    this.patterns = patterns
  }
  
  /**
   * 检测文本中的敏感信息
   */
  detect(text) {
    if (!text) return []
    
    const findings = []
    
    for (const { pattern, type, severity } of this.patterns) {
      const matches = text.match(pattern)
      if (matches) {
        for (const match of matches) {
          findings.push({
            type,
            severity,
            matched: match,
            position: text.indexOf(match)
          })
        }
      }
    }
    
    return findings
  }
  
  /**
   * 检测敏感信息并返回最高严重级别
   */
  getHighestSeverity(text) {
    const findings = this.detect(text)
    if (findings.length === 0) return 'normal'
    
    const severityLevels = {
      'highly_sensitive': 3,
      'sensitive': 2,
      'normal': 1
    }
    
    let maxLevel = 0
    let highest = 'normal'
    
    for (const finding of findings) {
      const level = severityLevels[finding.severity] || 0
      if (level > maxLevel) {
        maxLevel = level
        highest = finding.severity
      }
    }
    
    return highest
  }
}

/**
 * 脱敏处理器
 */
export class Sanitizer {
  constructor(options = {}) {
    this.detector = new SensitivityDetector(options.patterns)
    this.autoMask = options.autoMask ?? true
    this.maskChar = options.maskChar || '*'
    this.mode = options.mode || 'partial'  // 'partial' | 'full'
  }
  
  /**
   * 脱敏处理文本
   */
  sanitize(text, forceMask = false) {
    if (!text) return text
    
    const findings = this.detector.detect(text)
    if (findings.length === 0) return text
    
    let sanitized = text
    
    // 按位置倒序处理（避免位置偏移）
    const sortedFindings = findings.sort((a, b) => b.position - a.position)
    
    for (const finding of sortedFindings) {
      const { matched, severity } = finding
      
      // 判断是否需要脱敏
      if (!forceMask && severity !== 'highly_sensitive' && !this.autoMask) {
        continue
      }
      
      const masked = this.maskText(matched, severity)
      sanitized = sanitized.replace(matched, masked)
    }
    
    return sanitized
  }
  
  /**
   * 掩码处理
   */
  maskText(text, severity) {
    if (this.mode === 'full') {
      return this.maskChar.repeat(text.length)
    }
    
    // 部分掩码：保留前后各1位
    if (text.length <= 2) {
      return this.maskChar.repeat(text.length)
    }
    
    const visible = Math.min(2, Math.ceil(text.length * 0.2))
    const masked = text.length - visible * 2
    
    return text.substring(0, visible) + 
           this.maskChar.repeat(Math.max(1, masked)) + 
           text.substring(text.length - visible)
  }
  
  /**
   * 构建带安全元数据的记忆条目
   */
  secureMemory(memory) {
    const text = memory.body?.text || ''
    const sensitivity = this.detector.getHighestSeverity(text)
    const masked = sensitivity !== 'normal' ? this.sanitize(text) : text
    
    return {
      ...memory,
      meta: {
        ...memory.meta,
        security: {
          sensitivity,
          masked: sensitivity !== 'normal',
          origin: memory.meta?.security?.origin || 'auto'
        }
      },
      body: {
        ...memory.body,
        text: masked,
        raw_content: memory.body?.raw_content || text  // 保留原始内容
      }
    }
  }
}

/**
 * 安全审计日志
 */
export class SecurityAuditor {
  constructor(storage = null) {
    this.storage = storage
    this.logs = []
  }
  
  /**
   * 记录审计日志
   */
  log(action, details) {
    const entry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      action,
      details,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'node'
    }
    
    this.logs.push(entry)
    
    // 持久化
    if (this.storage) {
      this.storage.saveAudit(entry)
    }
    
    return entry
  }
  
  /**
   * 记录敏感信息访问
   */
  logSensitiveAccess(memoryId, action) {
    return this.log('SENSITIVE_ACCESS', {
      memoryId,
      action,
      sensitivity: 'highly_sensitive'
    })
  }
  
  /**
   * 记录脱敏操作
   */
  logSanitization(memoryId, originalText, maskedText) {
    return this.log('SANITIZATION', {
      memoryId,
      originalLength: originalText.length,
      maskedLength: maskedText.length
    })
  }
  
  /**
   * 记录导出操作
   */
  logExport(format, count) {
    return this.log('EXPORT', { format, count })
  }
  
  /**
   * 记录删除操作
   */
  logDelete(memoryId, reason = 'user_request') {
    return this.log('DELETE', { memoryId, reason })
  }
  
  /**
   * 获取审计日志
   */
  getLogs(filters = {}) {
    let logs = this.logs
    
    if (filters.action) {
      logs = logs.filter(l => l.action === filters.action)
    }
    
    if (filters.from) {
      logs = logs.filter(l => new Date(l.timestamp) >= new Date(filters.from))
    }
    
    if (filters.to) {
      logs = logs.filter(l => new Date(l.timestamp) <= new Date(filters.to))
    }
    
    return logs
  }
  
  /**
   * 导出审计日志
   */
  exportLogs(format = 'json') {
    if (format === 'json') {
      return JSON.stringify(this.logs, null, 2)
    }
    
    // CSV 格式
    const headers = ['id', 'timestamp', 'action', 'details']
    const rows = this.logs.map(l => [
      l.id, l.timestamp, l.action, JSON.stringify(l.details)
    ])
    
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  }
}

/**
 * 命名空间隔离管理器
 */
export class Namespace隔离 {
  constructor() {
    this.current = 'default'
    this.isolated = new Set()
  }
  
  /**
   * 切换命名空间
   */
  switch(namespace) {
    this.current = namespace
    return this.current
  }
  
  /**
   * 创建隔离命名空间
   */
  createIsolated(namespace) {
    this.isolated.add(namespace)
    return namespace
  }
  
  /**
   * 检查命名空间是否隔离
   */
  isIsolated(namespace) {
    return this.isolated.has(namespace)
  }
  
  /**
   * 获取当前命名空间
   */
  getCurrent() {
    return this.current
  }
}

export default {
  SensitivityDetector,
  Sanitizer,
  SecurityAuditor,
  Namespace隔离,
  DEFAULT_SENSITIVITY_PATTERNS
}
