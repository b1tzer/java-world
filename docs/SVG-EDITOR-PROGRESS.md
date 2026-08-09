# SVG 布局优化 — 执行记录

> 分支: `feat/svg-editor`  
> 更新时间: 2026-08-09 02:12

## 一、问题背景

项目有 59 张 AI 生成的 SVG 架构图，其中 16 张存在文字重叠、溢出、尺寸异常等布局问题。  
核心矛盾：**AI 直接写 SVG 坐标容易出错，事后修补又会破坏设计意图。**

## 二、尝试过的方案

### ❌ 方案 1：自动修复脚本 `svg_auto_fix.py`

- 思路：解析 SVG → 检测重叠 → 自动推移元素坐标
- 结果：**失败**。推移一个元素会连锁影响下方元素，越改越乱。单元格高度不一致、对齐全断。
- 教训：SVG 布局牵一发动全身，不能靠改单个属性值修复。

### ❌ 方案 2：D2 声明式图表语言

- 思路：AI 写 D2 声明式语法 → 编译器自动布局 → 输出 SVG
- 结果：**效果不达标**。D2 的字体渲染比手写 SVG 大约 1.8 倍，即使 `--scale=0.55` 补偿，方框和字体的比例仍不理想。嵌套容器、foreignObject 等问题也影响渲染。
- 产出：`build_d2.sh`、`fix_d2_colors.py`（已保留，可作为备选）

### ⏳ 方案 3：可视化拖拽编辑器（当前方案）

- 思路：用 Fabric.js 构建浏览器端 SVG 编辑器，直接可视化拖拽编辑
- 状态：**SvgEditor 画布渲染 + SvgDiagram SVG 显示 — 均通过无头浏览器 CDP 验证**
- 进展：2026-08-09 完成 SvgEditor.vue 七项修复 + SvgDiagram.vue 显示修复（详见 §七）

## 三、当前产出

### 工具文件（`feat/svg-editor` 分支）

| 文件 | 状态 | 说明 |
| :-- | :-- | :-- |
| `docs/.vitepress/theme/components/SvgDiagram.vue` | ✅ | dev 模式悬浮编辑按钮 + SVG 尺寸修复 |
| `docs/.vitepress/theme/components/SvgEditor.vue` | ✅ | Fabric.js 编辑器弹窗（28个CSS变量全覆盖 + 画布渲染修复） |
| `docs/.vitepress/config.mts` | ✅ | 添加 `/__svg-save__` Vite 插件 |
| `docs/.vitepress/theme/index.ts` | ✅ | 注册 SvgEditor 组件 |
| `docs/.vitepress/svg-editor.html` | ✅ | 独立版编辑器（备用） |
| `docs/.vitepress/editor-server.py` | ✅ | 独立 HTTP 服务器 |
| `docs/.vitepress/start-editor.sh` | ✅ | 启动脚本 |

### SVG 手动修复（已回滚到 main 分支原始状态）

曾经修复了 13 个 SVG 的文字重叠问题，但因 D2 方案效果不达标，已全部回滚到 `a7607fd`。

## 四、SVG 布局诊断结果

`svg_layout_checker.py` 扫描结果（main 分支原始状态）：

| 指标 | 数值 |
| :-- | :-- |
| 🔴 错误文件 | 16 |
| 🟡 警告文件 | 40 |
| 🟢 无问题 | 3 |
| 文字重叠 | 252 处 |
| 尺寸异常 | 48 处 |
| 文字溢出 | 30 处 |

## 五、下一步计划

1. **逐个手动修复 SVG** — 用可视化编辑器拖拽调整 16 张有布局问题的 SVG
2. **验证明暗模式** — 确认 CSS 变量在亮/暗主题下正确切换
3. **合并回 main** — 解决 `config.mts` 冲突后合并

## 六、关键教训

- SVG 布局不能靠程序自动修复，位置关系是牵一发动全身的
- D2/Mermaid 等声明式工具的渲染效果与手写 SVG 差距大
- 正确方向是：**可视化编辑器 + 手动拖拽 + 自动 CSS 变量转换**
- 编辑器必须集成到 `npm run dev` 工作流中，不能是独立工具

## 七、2026-08-09 画布渲染修复记录

### 根因分析

对全部 59 张 SVG 的 CSS 变量使用情况做全量扫描，发现 SvgEditor.vue 的 `CSS_COLORS` 映射表只覆盖了 21/28 个变量。缺失的 7 个变量导致对应元素的 `fill` / `stroke` 值为非法色值（如 `var(--diagram-stroke-2)`），Fabric.js 将其渲染为透明。

此外还存在梯度 `<stop>` 元素的 `style` 属性解析兼容性、画布初始化时序等问题。

### 修复清单

| # | 问题 | 修复 |
|:-:|:--|:--|
| 1 | CSS 变量映射缺失 7 个 | 补齐 `--diagram-stroke-1/2`、`--diagram-surface-3`、`--diagram-accent-bg-1b/2b/3b`、`--diagram-ghost` |
| 2 | `<stop style="stop-color:...">` 不被 Fabric.js 识别 | 正则预处理转为直接属性 `stop-color="..."` |
| 3 | 不存在的 `marker-end="url(#arrow)"` 引用 | 正则移除，避免 Fabric.js 解析报错 |
| 4 | `nextTick()` 不足以保证 layout 完成 | 增加 `requestAnimationFrame` + 尺寸 fallback（800×600）|
| 5 | Fabric.js CDN 加载无超时 | 5s 超时 + `onerror` 处理 |
| 6 | fetch SVG 无错误处理 | try-catch + 状态码检查 |
| 7 | 多次开关编辑器 canvas 泄漏 | `onUnmounted` 中 `dispose()` 清理 |

### 2026-08-09 补充：SvgDiagram SVG 不显示修复

**问题**：SvgEditor 修复完成后，用户反馈"部署后图片根本不显示"。无头浏览器验证发现 SVG computed width/height 为 0px + `overflow: hidden`，导致全部内容被裁剪不可见。

**根因**：`SvgDiagram.vue` 的 CSS 规则 `.svg-container :deep(svg) { max-width: 100%; height: auto; }` 只设置了 `max-width` 约束，在 flex 容器 + `v-html` 中间层 `<div>` 的嵌套结构下，SVG 无法解析内在尺寸。Chrome 将该 SVG 的 computed width 计算为 0px，结合 `overflow: hidden`（UA stylesheet），全部子元素被剪裁。

**验证**：使用 Chrome DevTools Protocol 无头浏览器，先确认 computed width=0/height=0/overflow=hidden，修复后确认 computed width/height 恢复为正常值。

**修复**（`SvgDiagram.vue`，两轮迭代）：

| 轮次 | 修改 | 效果 |
|:--|:--|:--|
| ~~第1轮~~ | ~~`width: 100%`~~ | ❌ 字形缩至 0.68x，12px 字体实际约 8px，无法看清 |
| **第2轮** | `:deep(> div) { display: contents }` | ✅ 让 `v-html` 中间层在盒模型中透明，SVG 以 viewBox 原生宽度渲染 |

### 2026-08-09 补充：箭头修复

**问题**：编辑模式下箭头三角形丢失，线头和箭头分离，拖动时不同步。

**根因**：SVG 文件通过 `<marker>` 元素定义箭头并通过 `marker-end` 引用，但 Fabric.js 不支持 `<marker>`。之前的预处理粗暴删除了 `marker-end` 属性，箭头三角形全部丢失。

受影响文件（6张）：`vt-decision-tree.svg`、`tcp-segment.svg`、`ddd战略设计.svg`、`security-auth-flow.svg`、`spring-bean-lifecycle.svg`、`spring-mvc-flow.svg`。

**修复**（`SvgEditor.vue`，四步预处理）：

1. 解析 `<marker>` 定义 → 提取 `id / points / fill`
2. 解析 `<style>` 中 CSS 类的 `marker-end` 规则（如 `.arrow { marker-end: url(#arrowhead) }`）
3. 扫描每条 `<line>`：根据 inline `marker-end` 或 CSS class 确定对应 marker，在终点合成方向正确的三角形 `<polygon>`，用 `<g>` 包裹
4. 同理处理 `<path mark-end="...">`

Fabric.js 解析 `<g>` 时自动创建 `fabric.Group` → 线条与箭头成为整体，选中拖动同步。

**验证**：Node.js 脚本对两类 SVG 离线验证：
- `vt-decision-tree.svg`（inline marker-end 模式）：9 根箭头线 → 9 个 `<g>`，0 个残留 `marker-end` ✅
- `security-auth-flow.svg`（CSS 类 `.arrow` 模式）：9 个 `.arrow` 线条 → 9 个 `<g>`，0 个残留 `marker-end` ✅

### 2026-08-09 补充：保存端点验证

**验证内容**：`/__svg-save__` 端点的保存功能和安全检查。

| 测试 | 结果 |
|:--|:--|
| POST 修改后的 SVG 到 `/__svg-save__` | ✅ HTTP 200，文件即刻写入，内容含 `data-edited="true"` 标记 |
| POST 非 SVG 文件（`.php`） | ✅ HTTP 403 `Forbidden: only SVG files in public/diagrams/ are allowed` |
| 测试后文件清理 | ✅ `test-save.svg` 已自动删除 |
