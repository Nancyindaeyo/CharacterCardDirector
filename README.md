# WorldbookDirector（世界书编排器）

> **形态**：SillyTavern **拓展**（非酒馆助手脚本）  
> **发布目录**：[`WorldbookDirector/`](../../WorldbookDirector/)  
> **GitHub 安装**：`https://github.com/Nancyindaeyo/WorldbookDirector`

---

## 安装（用户）

1. 安装 [酒馆助手 JS-Slash-Runner](https://github.com/n0vi028/JS-Slash-Runner) 4.8.19+
2. SillyTavern → **扩展** → **Install Extension** → 粘贴上方 GitHub 地址
3. 刷新并启用 **世界书编排器**

拓展 **不会** 出现在酒馆助手脚本树中，无需手动挂载脚本。

---

## 开发 / 发版（维护者）

```bash
# 生产 bundle → WorldbookDirector/index.js
pnpm build:worldbook-director

# 开发 bundle（含 source map）
pnpm build:worldbook-director:dev
```

发版前提交 `WorldbookDirector/index.js` 到 GitHub 发布仓库。

本地调试：可将 `WorldbookDirector/` 软链或复制到 ST 的 `data/default-user/extensions/third-party/WorldbookDirector/`。

---

## 功能概要（已实现）

| 模块 | 说明 |
|------|------|
| Swipe 绑定 | 0 楼 Swipe 互斥切换 primary 世界书条目（仅开局阶段） |
| 前缀栏 | 输入框上方横向 chips 中途切换（替代脚本库按钮） |
| 可视化面板 | Swipe 绑定 / 抓取扫描 / 条件绑定 |
| MVU 条件绑定 | 变量达标时开/关条目；监听 `VARIABLE_UPDATE_ENDED`；支持全角色卡 / 仅该聊天 |
| 设为开场白 | 消息楼层按钮，支持多 Swipe 变体追加 |
| 导出 | 写入 `character.extensions.worldbook_swipe_qr_switch` + 独立脚本 |
| **阶段 / 变量 Tab** | 扫描 EJS 分阶段、填值试阶段、改 overview/EJS、新增蓝灯条目、编辑 initvar/stat_data |
| **条件冲突** | 多规则同 UID 按 priority 合并；宿主分阶段条目不参与竞争 |
| **表达式扩展** | `hasKey` / `len` / `stageOf`；规则运算符 exists / between / contains / 字段间 `@` 比较 |

配置存储在 **拓展变量**（`type: 'extension'`），按角色卡名分键。

---

## 待实现需求（已确认 · vNext）

以下为用户确认的可做项，按模块归纳。实现时以本表为验收清单。

### 一、条件绑定增强

| # | 需求 | 说明 |
|---|------|------|
| **1** | **实时诊断** | 每条规则旁显示当前 `getStat` 值、是否满足；保存时保留命中/跳过报告；阶段梯子显示「当前阶段名 + 距下一阈值差值」 |
| **2** | **触发时机** | 支持三种模式（见下「触发时机 UI 文案」）；边沿触发需 `VARIABLE_UPDATE_ENDED` 的 `old_variables` + 聊天变量记上一帧 |
| **5** | **优先级与冲突** | 多规则命中同一 UID 时：优先级字段、面板标红冲突；**宿主分阶段条目不参与竞争** | ✅ Phase 4 |
| **9** | **表达式 API** | `getStatOld`、`delta`；`stageOf`；`hasKey` / `len`；高级表达式 `new Function` | ✅ Phase 5（`stageCrossed` 待后续） |
| **10** | **嵌套结构条件** | 可视化：`exists` / `between` / `contains` / `@字段` 比较 | ✅ Phase 5 核心 |
| **11** | **条件 / 阶段模板库** | 内置：好感五档、030 分阶段骨架、布尔 flag 开条目；可一键填入条件或阶段梯子 |
| **12** | **轮询兜底** | 拓展本体：有阶段梯子或条件规则时，MVU 事件之外轻量轮询（仅比较 stage index / 条件哈希，变化才刷新） |
| **15** | **Schema 校验** | 规则/阶段阈值与 Zod schema 的 min/max/enum 对齐；字段消失或阈值缺口时警告 |

### 二、阶段梯子（Stage Ladder · 新一等公民）

与「条目开关」并列，专门对接写卡常见的 **单条目 EJS 分阶段**（参考 `写卡/zod/030-🔧 MVU-4.1.分阶段角色设定.txt`）。

**范式对比**

| | 分阶段模板（030 / EJS） | 现有条件绑定 |
|--|-------------------------|--------------|
| 结构 | 1 条目内 `if/else` + `getvar('stat_data.xxx')` | N 条目 enable/disable |
| 切换 | 渲染时只输出当前阶段块 | 物理只留一条开着 |
| 条目 | 通常一直 enabled | 随条件 true/false |

**三种工作模式（均已确认）**

| 模式 | 代号 | 场景 | 行为 |
|------|------|------|------|
| **A · 伴生** | `companion` | **存量卡最多** | 不开关宿主 EJS 条目；扫描 + 诊断 + `injectPrompts` 阶段 token；边沿动作作用于卫星条目 / flag / toast |
| **B · 拆分** | `split` | 单独拆某一阶段 | 从梯子生成/绑定独立条目 + 自动条件规则（默认「持续生效」） |
| **C · 创作** | `authoring` | 写新卡 | UI 填阶段 → 生成 030 风格 YAML/EJS 正文 + 梯子配置；可选同时生成 satellite 规则 |

**阶段梯子数据结构（规划）**

```ts
// schema.ts 待增
StageLadderSchema = {
  id: string,
  mode: 'companion' | 'split' | 'authoring',
  scope: 'character' | 'chat',           // 同条件绑定
  variable_path: string,                 // 如 沈白露.好感度
  host_entry_uid: number | null,         // 模式 A/C：EJS 宿主；B 可为 null
  stages: Array<{
    name: string,                        // 四字阶段名
    min: number | null,                  // null = -∞
    max: number | null,                  // null = +∞；末档可仅行为指导
    // 模式 C 可选
    behavior_guidance?: string[],
    change_tendency?: string[],
    // 卫星 / 边沿
    satellite_enable_uids?: number[],
    satellite_disable_uids?: number[],
    satellite_trigger?: 'level' | 'rising' | 'falling',
    edge_actions?: EdgeAction[],         // toast / set_flag / inject_prompt …
  }>,
  inject_prompt_id?: string,             // injectPrompts 稳定 id
  inject_token_template?: string,        // 如 {{name}}阶段={{stageName}}
  priority?: number,
}
```

**从世界书反解析（模式 A 入口）**

扫描 primary 世界书条目 content，识别：

- `角色阶段:` / `associated_variable` / `getvar('stat_data…')` / `get_message_variable::`
- `<%_ if (getvar(...) < N)` 链 → 提取阶段名与阈值
- 可选读取 `stage_names_overview`

**与 030 模板对齐**

- 宿主 EJS 条目：保证「单阶段可见」，拓展 **不** 对其 enable/disable
- 边沿 / 卫星 / injectPrompts：负责跨阶段通知、其它条目、绿灯关键字

### 三、触发时机 UI 文案（前端必须可读）

存储枚举：`level` | `rising` | `falling`。界面 **主标签用中文**，术语作副标题。

| 存储值 | 界面主标签 | 副标题（可选） | 说明摘要 |
|--------|------------|----------------|----------|
| `level` | **持续生效** | 电平 | 条件为真期间一直生效；变假则撤销（现有条件绑定默认行为） |
| `rising` | **刚达到时** | 上升沿 | 从不满足→满足触发 **一次**；需先离开再进入才会再触发 |
| `falling` | **刚离开时** | 下降沿 | 从满足→不满足触发 **一次**；多用于降级 / 回退剧情 |

**面板内固定举例（好感 35，阶段「温柔伪装」[20, 50)）**

- 持续生效：卫星条目「文风-温柔」一直开着，掉到 18 关回去
- 刚达到时：19→21 时 toast / 写 `$flag` **一次**，21→45 不重复
- 刚离开时：21→19 时触发「离开阶段」动作 **一次**

**折叠比喻（「了解更多」）**

> 阶段 = 房间。持续生效 = 在房间里灯一直亮；刚达到时 = 进门铃响一次；刚离开时 = 出门响一次。  
> EJS 主条目 = 房间装修随所在房间自动换，不用开关。

**默认策略**

- 模式 A 宿主：**仅诊断**（无触发模式）
- 卫星条目 / injectPrompts：**持续生效**
- 边沿动作：**刚达到时** / **刚离开时** 可配

### 四、面板结构（规划）

```
条件绑定 Tab
├── 条目开关          ← trigger_mode + 实时诊断 + priority + 冲突提示
├── 阶段 / 变量 Tab   ← 扫描 / 填值 / overview·EJS 编辑 / 新增蓝灯条目
└── 模板库            ← Phase 6：030 五档、好感分档 …
```

独立脚本导出：`STAGE_LADDERS` JSON 与 `CONDITIONAL_BINDINGS` 并列；聊天级梯子存聊天变量（同条件绑定）。

---

## 实现路线图（分步写代码）

按依赖顺序拆分 PR /  commit，每步可单独验收。

### Phase 0 · 基础类型与文档 ✅

- [x] 需求整理写入本 README
- [x] `schema.ts`：预留 `StageLadderSchema`、`trigger_mode`、`EdgeActionSchema`、`stage_ladders`

### Phase 1 · 实时诊断（需求 1）✅

**目标**：不改运行时行为，只增强可观测性。

| 文件 | 工作 | 状态 |
|------|------|------|
| `lib/conditions.ts` | `evaluateBindingConditionDetailed()` 返回每条 rule 的 actual / pass | ✅ |
| `lib/conditional-apply.ts` | 导出 `previewConditionalBindings()` 只读 diff | ✅ |
| `App.vue` | 条件卡片：当前值、✓/✗、触发时机选择、刷新诊断 | ✅ |
| `components/TriggerModeHelp.vue` | 触发时机说明组件 | ✅ |

**验收**：编辑条件时可见实时满足状态；保存仍走现有 apply。边沿触发 runtime 见 Phase 2。

### Phase 2 · 触发时机 runtime（需求 2 + 9 部分） ✅

**目标**：条件绑定与阶段边沿动作支持 level / rising / falling。

| 文件 | 工作 | 状态 |
|------|------|------|
| `schema.ts` | `ConditionalBindingSchema` 增 `trigger_mode`、可选 `edge_actions` | ✅ |
| `lib/mvu-stat-data.ts` | `readMvuStatDataFromMessage(id)`；快照 `last_stat_snapshot` 到聊天变量 | ✅ |
| `lib/conditional-handler.ts` | `VARIABLE_UPDATE_ENDED` 传入 `(new, old)`，更新快照 | ✅ |
| `lib/conditions.ts` | `getStatOld`、`delta`；边沿 eval | ✅ |
| `lib/conditional-apply.ts` | rising/falling 边沿逻辑；`edge_ran` 报告 | ✅ |
| `lib/trigger-mode.ts` + test | `shouldApply*` / `shouldRunEdgeActions` | ✅ |
| `lib/edge-actions.ts` | toast / set_flag / inject_prompt | ✅ |
| `App.vue` | 边沿动作编辑；诊断 `would_apply` / 上一帧状态 | ✅ |
| `lib/standalone-conditional-script.ts` | 同步 trigger + edge_actions | ✅ |

**验收**：配置「刚达到时 + toast」仅在首次进入条件时提示；持续生效行为与现网一致。

### Phase 3 · 阶段扫描与模式 A（需求 1 + 15 + 030 融合） ✅

**目标**：存量 EJS 分阶段卡零迁移可用；**变量可视化** + 世界书条目内编辑。

| 文件 | 工作 | 状态 |
|------|------|------|
| `lib/stage-ladder-parse.ts` + test | overview 与 EJS 合并；区间诊断与修复建议 | ✅ |
| `lib/stage-ejs-extract.ts` | 展开阶段正文 / 条件（按 block 索引） | ✅ |
| `lib/stage-overview-edit.ts` | overview 行 / EJS 条件写回；可选重命名阶段 | ✅ |
| `lib/stage-entry-create.ts` | 新增蓝灯分阶段条目（精简 EJS 模板） | ✅ |
| `lib/stage-interval-diagnose.ts`（合入 parse） | 空隙 / 重叠 / overview-EJS 不一致建议 | ✅ |
| `lib/initvar-block.ts` | 读写开场白 `<initvar>` YAML | ✅ |
| `lib/variable-playground.ts` | 开场白 vs 最新楼层双模式 | ✅ |
| `components/VariablePlayground.vue` | 全部变量；有 overview 才显示 overview 编辑；逐阶段展开 | ✅ |
| `components/StageEntryWizard.vue` | 点击「新增 EJS 阶段」才显示；多变量、多阶段 | ✅ |
| `lib/stage-ladder-handler.ts` | 无 saved config 时直接扫世界书 inject | ✅ |

**验收**：030+overview 混排（如蛇类本能）可解析；无 overview 条目只改 EJS；保存 initvar 保持当前 Swipe；新增条目为蓝灯 constant。

### Phase 4 · 优先级与冲突（需求 5） ✅

| 文件 | 工作 | 状态 |
|------|------|------|
| `lib/conditional-conflicts.ts` + test | 按 priority 合并 UID 变更；`collectStageHostUids` | ✅ |
| `lib/conditional-apply.ts` | apply / preview 使用 priority 合并；输出 `conflicts[]` | ✅ |
| `App.vue` | 优先级字段；冲突标红列表；跳过宿主提示 | ✅ |

**验收**：两条规则对同一 UID 一开一关时，面板顶部显示冲突，运行时按 priority 大者生效；分阶段宿主 UID 不被条件绑定改动。

### Phase 5 · 表达式与嵌套条件（需求 9、10） ✅（核心）

| 文件 | 工作 | 状态 |
|------|------|------|
| `lib/condition-expr-context.ts` | `hasKey`、`len`、`stageOf` / `stageIndex` | ✅ |
| `lib/conditions.ts` | 表达式注入扩展 API | ✅ |
| `lib/condition-builder.ts` + test | `exists` / `between` / `contains`；`@字段` 间比较 | ✅ |
| `schema.ts` | 扩展 `ConditionOperatorSchema` | ✅ |
| `App.vue` | between 输入提示；表达式 placeholder | ✅ |

**验收**：手写表达式可调用 `stageOf('entry-123')`；可视化规则可选「存在」「介于」「包含」；字段间比较用 `@另一字段` 作值。

**未做（留 Phase 6+）**：`stageCrossed`、完整模板库、模式 B/C 拆分与 030 YAML 导出向导。

### Phase 6 · 模板库（需求 11）

| 文件 | 工作 |
|------|------|
| `lib/stage-templates.ts` | 030 五档、好感分档、flag 模板 |
| `App.vue` | 模板库 Tab / 弹窗；一键插入 ladder 或 conditional |

### Phase 7 · 模式 C 创作向导

| 文件 | 工作 |
|------|------|
| `lib/stage-ladder-generate.ts` | 030 YAML/EJS 正文生成 |
| `App.vue` | 表单向导 → 预览 → 写入世界书条目（`updateWorldbookWith`） |

### Phase 8 · 模式 B 拆分

| 文件 | 工作 |
|------|------|
| `lib/stage-ladder-split.ts` | 单阶段拆条目 + 自动生成 conditional_bindings |
| `App.vue` | 阶段行「拆分为独立条目」操作 |

### Phase 9 · 轮询兜底 + 独立脚本对齐（需求 12）

| 文件 | 工作 |
|------|------|
| `lib/conditional-handler.ts` | 拓展侧 debounce + 低频 poll |
| `lib/standalone-conditional-script.ts` | 导出 STAGE_LADDERS + stage 边沿 |
| `settings.ts` / `persistToCharacter` | 持久化 ladders |

### Phase 10 · Schema 持续校验（需求 15）

| 文件 | 工作 |
|------|------|
| `lib/stage-ladder-validate.ts` | 缺口 / 重叠 / 字段不存在 |
| `App.vue` | 保存 / 扫描时集中展示 warnings |

---

## UI 设计规范

### 布局（移动优先）

| 端 | 行为 |
|----|------|
| 手机 `<768px` | `#wb-sq-modal` 底部抽屉，`92dvh` 高；底部 Tab；安全区 `env(safe-area-inset-bottom)` |
| 桌面 `≥768px` | 居中模态，`max-width: 56rem`；抓取页双栏网格 |

### 日间 / 夜间

- Header 切换：**跟随酒馆 / 日间 / 夜间**
- Design tokens：`--wb-bg`、`--wb-surface`、`--wb-accent`（Teal `#0d9488` / `#2dd4bf`）

### 入口

- 扩展菜单 `#extensionsMenu` → **世界书编排器**
- 0 楼 `.mes_buttons` → `fa-layer-group`

样式定义见 [`style.scss`](./style.scss)。

---

## 源码结构

```
src/世界书Swipe与QR切换/
├── index.ts
├── App.vue
├── schema.ts / settings.ts
├── components/
│   ├── EntryActionMultiSelect.vue
│   ├── UidMultiSelect.vue
│   ├── TriggerModeHelp.vue
│   ├── VariablePlayground.vue    # Phase 3 阶段/变量
│   └── StageEntryWizard.vue      # Phase 3 新增 EJS 条目
└── lib/
    ├── conditional-*.ts         # 条件绑定 + Phase 4 冲突
    ├── condition-expr-context.ts # Phase 5 表达式
    ├── mvu-*.ts                 # MVU 扫描 / 读值
    ├── stage-ladder-*.ts        # 阶段梯子 / overview 编辑
    ├── stage-entry-create.ts    # 新增蓝灯条目
    └── worldbook-ops.ts
```

---

## 参考文档

| 文档 | 用途 |
|------|------|
| [`写卡/zod/脚本变量.md`](../../写卡/zod/脚本变量.md) | MVU 事件、`injectPrompts`、old/new 变量 |
| [`写卡/zod/030-🔧 MVU-4.1.分阶段角色设定.txt`](../../写卡/zod/030-🔧 MVU-4.1.分阶段角色设定.txt) | 单条目分阶段 prompt 模板 |
| `@types/iframe/exported.mvu.d.ts` | MVU API |

---

## 与旧脚本的关系

[`基于前缀自动开合世界书条目`](../基于前缀自动开合世界书条目/index.js) 为前身。迁移后请停用旧脚本。

---

*文档版本：拓展 vNext 规划 · 2026-07-26*
