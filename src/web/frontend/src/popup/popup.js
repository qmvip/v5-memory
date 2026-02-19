/**
 * V5 Memory - Popup Script
 */

// 加载数据
async function loadData() {
  try {
    // 获取统计
    const stats = await chrome.runtime.sendMessage({ type: 'GET_STATS' })
    if (stats.success) {
      document.getElementById('totalMemories').textContent = stats.stats.total || 0
    }
    
    // 获取配置
    const config = await chrome.runtime.sendMessage({ type: 'GET_CONFIG' })
    if (config.success) {
      document.getElementById('enabled').checked = config.config.enabled !== false
      document.getElementById('autoExtract').checked = config.config.autoExtract !== false
      document.getElementById('autoInject').checked = config.config.autoInject !== false
    }
    
    // 获取最近记忆
    const memories = await chrome.runtime.sendMessage({ type: 'GET_ALL' })
    if (memories.success) {
      renderMemories(memories.memories.slice(0, 10))
    }
  } catch (error) {
    console.error('[V5 Popup] Error loading data:', error)
  }
}

// 渲染记忆列表
function renderMemories(memories) {
  const container = document.getElementById('memoryList')
  
  if (!memories || memories.length === 0) {
    container.innerHTML = '<div class="empty">暂无记忆</div>'
    return
  }
  
  container.innerHTML = memories.map(m => `
    <div class="memory-item">
      <span class="memory-type ${m.body.type}">${m.body.type}</span>
      <div class="memory-text">${escapeHtml(m.body.text.substring(0, 100))}</div>
      <div class="memory-meta">${formatDate(m.meta.lifecycle.createdAt)}</div>
    </div>
  `).join('')
}

// HTML 转义
function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// 格式化日期
function formatDate(dateStr) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now - date
  
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  return date.toLocaleDateString('zh-CN')
}

// 事件监听
document.getElementById('enabled').addEventListener('change', async (e) => {
  await chrome.runtime.sendMessage({
    type: 'UPDATE_CONFIG',
    payload: { enabled: e.target.checked }
  })
})

document.getElementById('autoExtract').addEventListener('change', async (e) => {
  await chrome.runtime.sendMessage({
    type: 'UPDATE_CONFIG',
    payload: { autoExtract: e.target.checked }
  })
})

document.getElementById('autoInject').addEventListener('change', async (e) => {
  await chrome.runtime.sendMessage({
    type: 'UPDATE_CONFIG',
    payload: { autoInject: e.target.checked }
  })
})

document.getElementById('openMemoryCenter').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'OPEN_MEMORY_CENTER' })
})

document.getElementById('exportBtn').addEventListener('click', async () => {
  const result = await chrome.runtime.sendMessage({ type: 'EXPORT' })
  if (result.success) {
    const blob = new Blob([result.data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `v5-memories-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
})

document.getElementById('clearBtn').addEventListener('click', async () => {
  if (confirm('确定要清空所有记忆吗？此操作不可恢复。')) {
    await chrome.runtime.sendMessage({ type: 'CLEAR' })
    loadData()
  }
})

// 初始化
loadData()
