/**
 * V5 Memory - VS Code Extension
 * 
 * IDE 版：面向程序员、架构师
 * 支持 Cursor、Windsurf、Cline 等 AI IDE
 */

import * as vscode from 'vscode'
import { V5MetaEngine } from '../../core/engine/meta_engine.js'
import { getAdapter } from '../../core/engine/injector.js'
import { FileSystemStore } from '../../core/storage/memory_store.js'
import path from 'path'
import fs from 'fs'

// 全局引擎
let engine = null
let statusBar = null

// 初始化引擎
async function initEngine() {
  if (engine) return engine
  
  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '.'
  const storePath = path.join(workspacePath, '.v5memory')
  
  const store = new FileSystemStore({
    basePath: storePath,
    namespace: 'default',
    platform: 'ide'
  })
  
  const config = vscode.workspace.getConfiguration('v5memory')
  
  engine = new V5MetaEngine({
    gamma: config.get('gamma', 0.85),
    barrier: config.get('barrier', 0.5),
    writeThreshold: 0.6,
    recallThreshold: 0.5,
    platform: config.get('platform', 'cursor'),
    namespace: 'default'
  })
  
  engine.store = store
  
  vscode.window.showInformationMessage('[V5] 记忆引擎已初始化')
  return engine
}

// 创建状态栏
function createStatusBar() {
  statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  )
  statusBar.text = '$(memory) V5'
  statusBar.tooltip = 'V5 Memory - 点击打开记忆面板'
  statusBar.command = 'v5memory.showPanel'
  statusBar.show()
}

// 注册命令
function registerCommands() {
  vscode.commands.registerCommand('v5memory.init', async () => {
    await initEngine()
    vscode.window.showInformationMessage('[V5] 记忆系统已启动')
  })
  
  vscode.commands.registerCommand('v5memory.recall', async () => {
    const editor = vscode.window.activeTextEditor
    if (!editor) return
    
    const selection = editor.selection
    const query = editor.document.getText(selection)
    
    if (!query) {
      vscode.window.showWarningMessage('请先选择要查询的代码或文本')
      return
    }
    
    const eng = await initEngine()
    const memories = await eng.recall(query)
    
    if (memories.length === 0) {
      vscode.window.showInformationMessage('未找到相关记忆')
      return
    }
    
    // 显示结果
    const items = memories.map(m => ({
      label: `[${m.body.type}] ${m.body.text.substring(0, 50)}`,
      detail: `相似度: ${m.recallScore.toFixed(2)}`,
      description: m.body.text
    }))
    
    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: '选择要插入的记忆'
    })
    
    if (selected) {
      await editor.insertSnippet(
        new vscode.SnippetString(`\n// V5 Memory: ${selected.label}\n${selected.description}\n`),
        editor.selection.end
      )
    }
  })
  
  vscode.commands.registerCommand('v5memory.showPanel', async () => {
    const eng = await initEngine()
    const memories = await eng.store.query({})
    
    const panel = vscode.window.createWebviewPanel(
      'v5memory',
      'V5 记忆中心',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    )
    
    panel.webview.html = generatePanelHtml(memories)
  })
  
  vscode.commands.registerCommand('v5memory.add', async () => {
    const text = await vscode.window.showInputBox({
      prompt: '输入要记忆的内容',
      placeHolder: '例如: 用户喜欢使用 TypeScript'
    })
    
    if (!text) return
    
    const eng = await initEngine()
    
    const memory = {
      meta: {
        id: `mem_${Date.now()}`,
        version: 'v1.0',
        platform: 'ide',
        namespace: 'default',
        tags: ['manual'],
        dimensions: {
          confidence: 1,
          importance: 1,
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
        type: 'pinned',
        text
      }
    }
    
    await eng.store.add(memory)
    vscode.window.showInformationMessage('[V5] 记忆已添加')
  })
  
  vscode.commands.registerCommand('v5memory.clear', async () => {
    const choice = await vscode.window.showWarningMessage(
      '确定要清空所有记忆吗？',
      { modal: true },
      '确定', '取消'
    )
    
    if (choice === '确定') {
      const eng = await initEngine()
      await eng.store.clear()
      vscode.window.showInformationMessage('[V5] 记忆已清空')
    }
  })
}

// 生成面板 HTML
function generatePanelHtml(memories) {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 20px; }
    h1 { font-size: 18px; margin-bottom: 20px; }
    .stats { display: flex; gap: 20px; margin-bottom: 20px; }
    .stat { background: #f5f5f5; padding: 10px 20px; border-radius: 6px; }
    .stat-value { font-size: 24px; font-weight: bold; }
    .stat-label { font-size: 12px; color: #666; }
    .memory-list { max-height: 400px; overflow-y: auto; }
    .memory-item { 
      background: #f9f9f9; 
      padding: 12px; 
      margin-bottom: 8px; 
      border-radius: 6px;
      cursor: pointer;
    }
    .memory-item:hover { background: #f0f0f0; }
    .memory-type { 
      display: inline-block; 
      font-size: 10px; 
      padding: 2px 6px; 
      border-radius: 4px; 
      background: #e0e0e0;
      margin-bottom: 4px;
    }
    .memory-type.pinned { background: #fff3e0; color: #e65100; }
    .memory-type.persona { background: #e3f2fd; color: #1565c0; }
    .memory-type.core { background: #f3e5f5; color: #7b1fa2; }
    .memory-text { font-size: 13px; }
    .btn {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      margin-right: 8px;
    }
    .btn-primary { background: #007acc; color: white; }
    .btn-danger { background: #f44336; color: white; }
  </style>
</head>
<body>
  <h1>V5 记忆中心</h1>
  
  <div class="stats">
    <div class="stat">
      <div class="stat-value">${memories.length}</div>
      <div class="stat-label">总记忆数</div>
    </div>
  </div>
  
  <div style="margin-bottom: 20px;">
    <button class="btn btn-primary" onclick="vscode.postMessage({command: 'add'})">+ 添加记忆</button>
    <button class="btn btn-danger" onclick="vscode.postMessage({command: 'clear'})">清空</button>
  </div>
  
  <div class="memory-list">
    ${memories.map(m => `
      <div class="memory-item">
        <span class="memory-type ${m.body.type}">${m.body.type}</span>
        <div class="memory-text">${m.body.text}</div>
      </div>
    `).join('')}
  </div>
  
  <script>
    const vscode = acquireVsCodeApi()
  </script>
</body>
</html>
  `
}

// 激活插件
export function activate(context) {
  console.log('[V5] Extension activated')
  
  createStatusBar()
  registerCommands()
  
  // 自动初始化
  initEngine()
  
  // 监听配置变化
  vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('v5memory')) {
      engine = null // 重建引擎
      initEngine()
    }
  })
}

// 停用插件
export function deactivate() {
  if (statusBar) {
    statusBar.dispose()
  }
}
