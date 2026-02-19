/**
 * V5 Memory - Content Script
 * 
 * 注入到各大模型网页，拦截请求/响应
 */

// 配置：需要适配的平台
const PLATFORMS = {
  'chatgpt.com': {
    name: 'chatgpt',
    inputSelector: '#prompt-textarea',
    sendButton: 'button[data-testid="send-button"]',
    containerSelector: '[data-testid="conversation-turn"]'
  },
  'claude.ai': {
    name: 'claude',
    inputSelector: 'div[contenteditable="true"]',
    sendButton: 'button[type="submit"]',
    containerSelector: '[data-testid="message"]'
  },
  'deepseek.com': {
    name: 'deepseek',
    inputSelector: 'textarea.chat-input',
    sendButton: 'button.send-button',
    containerSelector: '.message'
  },
  'gemini.google.com': {
    name: 'gemini',
    inputSelector: 'rich-textarea div[contenteditable]',
    sendButton: 'button[aria-label="Send"]',
    containerSelector: 'message-row'
  }
}

// 当前平台
let currentPlatform = null

// V5 指示灯
let indicatorElement = null

// 初始化
function init() {
  detectPlatform()
  if (currentPlatform) {
    createIndicator()
    setupInterceptors()
    console.log(`[V5] Initialized for ${currentPlatform.name}`)
  }
}

// 检测当前平台
function detectPlatform() {
  const hostname = window.location.hostname
  
  for (const [pattern, config] of Object.entries(PLATFORMS)) {
    if (hostname.includes(pattern.replace('*://', ''))) {
      currentPlatform = { ...config, pattern }
      return
    }
  }
  
  console.log('[V5] Unknown platform, not initializing')
}

// 创建指示灯
function createIndicator() {
  // 使用 Shadow DOM 避免样式冲突
  const host = document.createElement('div')
  host.id = 'v5-indicator-host'
  host.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 999999;'
  
  const shadow = host.attachShadow({ mode: 'closed' })
  shadow.innerHTML = `
    <style>
      .v5-indicator {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #ccc;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      }
      .v5-indicator.active { background: #4CAF50; }
      .v5-indicator.injecting { background: #2196F3; }
      .v5-indicator.writing { background: #FF9800; }
      .v5-indicator.error { background: #F44336; }
      .v5-indicator:hover { transform: scale(1.2); }
      .v5-tooltip {
        position: absolute;
        right: 20px;
        top: 0;
        background: #333;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        white-space: nowrap;
        opacity: 0;
        transition: opacity 0.2s;
      }
      .v5-indicator:hover .v5-tooltip { opacity: 1; }
    </style>
    <div class="v5-indicator" title="V5 Memory">
      <span class="v5-tooltip">V5 Memory Active</span>
    </div>
  `
  
  document.body.appendChild(host)
  indicatorElement = shadow.querySelector('.v5-indicator')
}

// 设置拦截器
function setupInterceptors() {
  // 拦截 fetch
  const originalFetch = window.fetch
  window.fetch = async (...args) => {
    const response = await originalFetch(...args)
    
    // 检查是否是发送消息的请求
    if (isSendMessageRequest(args)) {
      handleSendMessage(args, response.clone())
    }
    
    return response
  }
  
  // 拦截 XHR
  const originalXHROpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function(...args) {
    this.addEventListener('load', () => {
      if (isSendMessageRequest([this._url, this._method])) {
        handleSendMessage([this._url, this._method], this.response)
      }
    })
    return originalXHROpen.apply(this, args)
  }
}

// 检查是否是发送消息请求
function isSendMessageRequest(args) {
  const url = args[0]
  const method = args[1]
  
  if (!url) return false
  
  const platformPatterns = {
    chatgpt: /api\/chat/,
    claude: /api\/chat\/complete/,
    deepseek: /api\/v0\/chat/,
    gemini: /api\/predict/
  }
  
  return platformPatterns[currentPlatform.name]?.test(url)
}

// 处理发送消息
async function handleSendMessage(args, response) {
  try {
    // 获取输入
    const input = extractInput()
    if (!input) return
    
    // 解析响应
    const responseText = await response.clone().text()
    
    // 发送到后台处理
    const result = await chrome.runtime.sendMessage({
      type: 'PROCESS_TURN',
      payload: {
        input,
        response: responseText,
        platform: currentPlatform.name
      }
    })
    
    if (result.success) {
      updateIndicator('injecting')
      setTimeout(() => updateIndicator('active'), 1000)
    } else {
      updateIndicator('error')
    }
  } catch (error) {
    console.error('[V5] Error handling send:', error)
    updateIndicator('error')
  }
}

// 从页面提取输入
function extractInput() {
  const selectors = {
    chatgpt: '#prompt-textarea',
    claude: 'div[contenteditable="true"]',
    deepseek: 'textarea.chat-input',
    gemini: 'rich-textarea div[contenteditable]'
  }
  
  const selector = selectors[currentPlatform.name]
  const element = document.querySelector(selector)
  
  return element?.innerText?.trim() || element?.value?.trim()
}

// 更新指示灯状态
function updateIndicator(status) {
  if (!indicatorElement) return
  
  indicatorElement.className = 'v5-indicator ' + status
  
  const statusText = {
    active: 'V5 Memory Active',
    injecting: 'Injecting Memory...',
    writing: 'Writing Memory...',
    error: 'V5 Error'
  }
  
  const tooltip = indicatorElement.querySelector('.v5-tooltip')
  if (tooltip) {
    tooltip.textContent = statusText[status] || 'V5 Memory'
  }
}

// 等待 DOM 加载
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}

// 监听页面变化（SPA）
let lastUrl = location.href
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href
    setTimeout(init, 1000) // 等待页面渲染
  }
}).observe(document.body, { childList: true, subtree: true })
