# V5 元记忆系统 - 完整技术规范

## 1. 系统架构

### 1.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                      User Layer                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Complete    │  │ Web         │  │ IDE                 │  │
│  │ (Node.js)   │  │ (Chrome Ext)│  │ (VS Code Plugin)    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   V5 Meta Engine                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Meta-Adapt Layer (适配层)                           │  │
│  │  - Platform Interceptor (拦截器)                     │  │
│  │  - Platform Injector (注入器)                        │  │
│  │  - Platform Parser (解析器)                         │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Meta-Opera Layer (操作层)                           │  │
│  │  - Extractor (提取器)                                │  │
│  │  - Retriever (召回器)                                │  │
│  │  - Injector (注入器)                                 │  │
│  │  - Rule Engine (规则引擎)                            │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Meta-Data Layer (元数据层)                          │  │
│  │  - V5 Profiles (V5配置)                              │  │
│  │  - Lifecycle (生命周期)                               │  │
│  │  - Relations (关联关系)                              │  │
│  │  - Security (安全策略)                               │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Storage Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ IndexedDB    │  │ FileSystem   │  │ LocalStorage   │  │
│  │ (Browser)    │  │ (Node.js)     │  │ (Settings)     │  │
│  └──────────────┘  └──────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. V5 势垒方程

### 2.1 核心公式

```
P = 1 / (1 + e^(-2γ(Input - B)))
```

| 参数 | 含义 | 默认值 | 范围 |
|------|------|--------|------|
| γ (gamma) | 系统响应强度/敏感度 | 0.85 | 0.5-1.5 |
| B (barrier) | 临界阈值 | 0.5 | 0.3-0.9 |
| Input | 输入匹配度 | - | 0-1 |
| P | 概率输出 | - | 0-1 |

### 2.2 召回得分计算

```
Input = (
  keywordScore × 0.35 +
  priorityScore × 0.25 +
  timeDecay × 0.2 +
  platformWeight × 0.1 +
  typeScore × 0.1
)
```

### 2.3 写入得分计算

```
Score = (
  confidence × 0.4 +
  importance × 0.3 +
  platformWeight × 0.2 +
  freshness × 0.1
)
```

---

## 3. 数据模型

### 3.1 V5 记忆条目结构

```json
{
  "meta": {
    "id": "mem_xxx",
    "version": "v1.0",
    "platform": "deepseek",
    "namespace": "default",
    "tags": ["language", "style"],
    "dimensions": {
      "confidence": 0.9,
      "importance": 0.8,
      "time_decay": 0.7,
      "recall_priority": 1
    },
    "relations": {
      "supersedes": null,
      "related_to": [],
      "conversation_id": "conv_xxx",
      "turn_id": "turn_xxx"
    },
    "lifecycle": {
      "createdAt": "2026-02-19T00:00:00Z",
      "updatedAt": "2026-02-19T00:00:00Z",
      "lastUsedAt": "2026-02-19T00:00:00Z",
      "expiresAt": "2026-03-21T00:00:00Z",
      "ttl": 2592000,
      "status": "active"
    },
    "security": {
      "sensitivity": "normal",
      "masked": false,
      "origin": "auto"
    }
  },
  "body": {
    "type": "persona",
    "text": "用户偏好简洁的技术建议",
    "raw_content": ""
  }
}
```

### 3.2 记忆类型

| 类型 | 描述 | 默认 TTL | 召回优先级 |
|------|------|----------|------------|
| pinned | 手动置顶 | 永不过期 | 最高 |
| persona | 用户画像 | 90 天 | 高 |
| core | 核心记忆 | 60 天 | 中 |
| episodic | 情境细节 | 30 天 | 低 |

---

## 4. 平台适配

### 4.1 支持的平台

| 平台 | 类型 | 适配器 | 状态 |
|------|------|--------|------|
| DeepSeek | 大模型 Web | ✅ | 完成 |
| ChatGPT | 大模型 Web | ✅ | 完成 |
| Claude | 大模型 Web | ✅ | 完成 |
| Gemini | 大模型 Web | ✅ | 完成 |
| Cursor | AI IDE | ✅ | 完成 |
| Windsurf | AI IDE | ✅ | 完成 |
| Cline | AI IDE | ✅ | 完成 |

### 4.2 适配器接口

```typescript
interface V5PlatformAdapter {
  name: string
  parseRequest(request: any): string
  parseResponse(response: any): string
  inject(input: string, context: string): string
}
```

---

## 5. 注入流程

### 5.1 完整流程

```
用户输入 → 拦截请求 → 召回记忆 → 构建上下文 → 注入请求 → 发送 → 响应 → 提取记忆 → 写入记忆
```

### 5.2 注入预算

| 类型 | 配额 |
|------|------|
| Persona | 3 条 |
| Core | 4 条 |
| Episodic | 6 条 |

---

## 6. 安全策略

### 6.1 敏感信息检测

默认检测模式：
- 密码: `/password/i`
- API Key: `/api[_-]?key/i`
- Token: `/token/i`
- 数字: `/\d{6,}/`
- 银行: `/bank/i`

### 6.2 脱敏处理

命中敏感模式后：
1. 标记 `sensitivity: highly_sensitive`
2. 掩码处理: `****`
3. 可选：拒绝入库

---

## 7. 版本管理

### 7.1 版本链

当同一记忆更新时：
1. 创建新版本
2. 旧版本标记 `status: superseded`
3. 新版本记录 `relations.supersedes` 指向旧版本

### 7.2 回溯能力

通过 `supersedes` 字段可追溯完整版本链。

---

## 8. 性能目标

| 指标 | 目标 |
|------|------|
| 召回延迟 | < 50ms |
| 注入延迟 | < 30ms |
| 写入延迟 | < 100ms |
| 存储容量 | 支持 10,000+ 条记忆 |

---

## 9. 验收标准

### 9.1 功能验收

- [ ] 自动从 AI 响应中提取记忆
- [ ] 按 V5 势垒方程计算召回得分
- [ ] 自动注入记忆到请求
- [ ] 支持多平台适配
- [ ] 支持记忆的手动添加/编辑/删除
- [ ] 支持记忆导出/导入
- [ ] 支持敏感信息自动脱敏

### 9.2 性能验收

- [ ] 单次召回 < 50ms
- [ ] 单次注入 < 30ms
- [ ] 支持 10,000+ 记忆条目

### 9.3 稳定性验收

- [ ] 异常不阻断对话（Fail-Open）
- [ ] 断电/重启后数据不丢失
- [ ] 自动清理过期记忆

---

## 10. 认知科学原理

详见 [docs/COGNITIVE.md](./docs/COGNITIVE.md)

V5 势垒方程不仅是记忆检索公式，更是智能体的进化公式：

```
学习 = 增加 Input (积累数据)
熟练 = 增加 γ (优化算法/降低延迟)
记住 = Input > B 且 γ 足够大 → P = 1
```
