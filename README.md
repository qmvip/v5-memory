# V5 元记忆系统 (V5 Memory Meta-System)

> 通用大模型全局记忆框架 | V5 Meta Structure Powered

## 核心定位

**一句话**：让 AI 记住用户的一切，实现跨平台、跨场景的个性化记忆能力。

**技术核心**：V5 势垒方程 `P = 1/(1+e^(-2γ(Input-B)))` 驱动记忆的提取、召回、注入全生命周期。

**方程本质**：Sigmoid 函数变体，将「输入匹配度」映射为 0-1 之间的「记忆激活概率」，实现记忆召回/写入的量化决策。

---

## 三大版本

| 版本 | 定位 | 用户群体 | 技术栈 | 核心差异 |
|------|------|----------|--------|----------|
| **完整版** | 全功能、全平台适配 | 高级用户、研究者 | Node.js CLI + Web | 支持向量检索、云端同步、自定义元规则 |
| **网页版** | 浏览器插件形态 | 写手、视觉设计师 | Chrome Extension (Manifest V3) | 轻量本地存储、仅关键词检索、主流 LLM 适配 |
| **IDE版** | 开发工具形态 | 程序员、架构师 | VS Code 插件 / Electron | 适配 IDE 内 AI 助手（Cursor/Windsurf）、代码上下文记忆 |

---

## 功能矩阵

| 功能 | 完整版 | 网页版 | IDE版 | 实现说明 |
|------|--------|--------|-------|----------|
| 多平台适配 | ✅ | ✅ | ✅ | Meta-Adapt Layer |
| 自动记忆提取 | ✅ | ✅ | ✅ | V5 势垒方程阈值过滤 |
| 智能召回注入 | ✅ | ✅ | ✅ | V5 势垒方程排序 |
| V5 元规则引擎 | ✅ | ✅ | ✅ | 核心引擎驱动 |
| 记忆中心 UI | ✅ | ✅ | ✅ | 筛选/编辑记忆 |
| 向量语义检索 | ✅ (可选) | ❌ | ❌ | LocalEmbedding |
| 云端同步 | ✅ (可选) | ❌ | ❌ | 加密同步 |
| 自定义角色 | ✅ | ✅ | ✅ | namespace 隔离 |

---

## V5 元结构

```
┌─────────────────────────────────────────────────────────────┐
│                      V5 Meta Engine                        │
├─────────────┬─────────────┬─────────────┬──────────────────┤
│  Meta-Adapt │  Meta-Opera  │  Meta-Data  │   Meta-Security │
│   Layer    │   Layer     │   Layer     │     Layer       │
│  平台适配  │  记忆操作   │  元数据管理 │    安全管控     │
├─────────────┴─────────────┴─────────────┴──────────────────┤
│                     Storage Layer                          │
│           (IndexedDB / localStorage / FileSystem)          │
└─────────────────────────────────────────────────────────────┘
```

### 核心组件

1. **Meta-Adapt Layer** - 平台适配器：DeepSeek/ChatGPT/Claude/Gemini/Cursor/Windsurf/Cline
2. **Meta-Opera Layer** - 提取/召回/注入器 + 规则引擎
3. **Meta-Data Layer** - 版本链、关联关系、生命周期
4. **Meta-Security Layer** - 敏感信息、脱敏、审计、隔离

---

## 关键技术实现

### V5 势垒方程

```javascript
export function v5BarrierEquation(input, gamma = 0.85, barrier = 0.5) {
  const normalizedInput = Math.max(0, Math.min(1, input));
  const exponent = -2 * gamma * (normalizedInput - barrier);
  return parseFloat((1 / (1 + Math.exp(exponent))).toFixed(4));
}

// input=0.7 → P=0.8176 (高概率召回)
// input=0.4 → P=0.3820 (低概率召回)
```

### 写入得分

```javascript
export function calculateWriteScore(confidence, importance, platformWeight = 1, freshness = 1) {
  return (confidence * 0.4) + (importance * 0.3) + (platformWeight * 0.2) + (freshness * 0.1);
}
```

### 记忆类型阈值

| 类型 | 阈值 | 说明 |
|------|------|------|
| pinned | 1.0 | 置顶（最高） |
| persona | 0.8 | 用户画像 |
| core | 0.6 | 核心记忆 |
| episodic | 0.4 | 情境细节 |

---

## 快速开始

### 完整版

```bash
cd src/complete
npm install
node cli.js --init
node cli.js --input "我喜欢Python" --platform deepseek
node cli.js --retrieve "推荐框架"
```

### 网页版

```bash
cd src/web/frontend
npm install && npm run build
# 加载 dist 到 Chrome
```

### IDE版

```bash
cd src/ide/vscode
npm install
# F5 调试
```

---

## 项目结构

```
v5-memory/
├── README.md
├── SPEC.md
├── src/
│   ├── core/
│   │   ├── engine/
│   │   │   ├── meta_engine.js   # 核心引擎
│   │   │   ├── scorer.js        # V5 势垒方程
│   │   │   ├── extractor.js     # 记忆提取
│   │   │   ├── retriever.js    # 记忆召回
│   │   │   └── injector.js     # 记忆注入
│   │   ├── adapt/
│   │   │   ├── base_adapter.js
│   │   │   └── platform_adapters.js
│   │   ├── security/
│   │   │   └── sanitizer.js    # 敏感信息+审计
│   │   └── storage/
│   │       └── memory_store.js
│   ├── complete/cli.js
│   ├── web/frontend/
│   └── ide/vscode/
```

---

## 合规声明

- 技术框架，不涉及玄学/占卜
- 本地存储优先，隐私优先
- 敏感信息自动脱敏
- 一键清空功能

---

## 许可证

MIT - 望易 V5 元结构体系
