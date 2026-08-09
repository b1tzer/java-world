# SVG 编辑器功能增强 — 任务清单

> 创建时间：2026-08-09
> 最后更新：2026-08-09
> 分支：feat/svg-editor

## 一、调研结论

### 已有轮子

| 项目 | 地址 | 能力 | 可用度 |
|:--|:--|:--|:--|
| **vue-fabric-editor** | nihaojob/vue-fabric-editor | 文字格式、图层、组合、对齐分布、辅助线、标尺、快捷键、右键菜单 | ⭐⭐⭐⭐⭐ |
| **Fabric.js 5.x** | fabricjs.com | 内置旋转手柄、z-index、group/ungroup、Textbox 样式、渐变、阴影、opacity | ⭐⭐⭐⭐ |

### 方案评估

| 方案 | 描述 | 优点 | 缺点 | 结论 |
|:--|:--|:--|:--|:--|
| A. 全面引入 vue-fabric-editor | 用它的完整编辑器替换 SvgEditor | 功能最全，开箱即用 | 它是图片编辑器，不是 SVG 编辑器；需要大量改造适配我们的 SVG 加载/保存流程 | ❌ 不采用 |
| B. 参考 vue-fabric-editor，逐步实现 | 研究它的源码，提取关键模式，自己实现 | 可控性强，适配我们的 SVG 流程 | 工作量大 | ✅ 采用 |
| C. 只用 Fabric.js 内置 API | 大部分功能 Fabric.js 已内置，直接调用 | 最轻量，无额外依赖 | 需要自己写 UI | ✅ 配合 B |

**决定：方案 B+C** — Fabric.js 已内置大部分核心能力（旋转、group、z-index、Textbox 样式），只需写 UI 绑定调用。参考 vue-fabric-editor 的 UI 设计模式。

## 二、任务清单

### 第一阶段 — P0（核心编辑能力）

- [x] **T1: 文字格式工具栏**
  - 状态：✅ 完成
  - 内容：字号选择、加粗、斜体、下划线、文字颜色、文字对齐（左/中/右）
  - 快捷键：Ctrl+B/I/U
  - Fabric.js API：`textbox.setFontSize()`, `textbox.setBold()`, `textbox.setFill()`, `textbox.setTextAlign()` 等
  - 参考：vue-fabric-editor `src/components/font.vue`

- [x] **T2: 层级控制**
  - 状态：✅ 完成
  - 内容：上移一层、下移一层、置顶、置底
  - Fabric.js API：`canvas.bringForward()`, `canvas.sendBackwards()`, `canvas.bringToFront()`, `canvas.sendToBack()`

- [x] **T3: 等间距分布**
  - 状态：✅ 完成
  - 内容：水平等间距分布、垂直等间距分布
  - 实现：计算选中元素的总宽度/高度，重新分配间距
  - 需要 3 个以上选中元素才生效

- [x] **T4: 边框粗细和样式**
  - 状态：✅ 完成
  - 内容：stroke-width 选择器（0.5-5）、实线/虚线切换
  - Fabric.js API：`object.set('strokeWidth', n)`, `object.set('strokeDashArray', [n, n])`

### 第二阶段 — P1（交互增强）

- [x] **T5: 旋转支持**
  - 状态：✅ 完成
  - 内容：选中时显示旋转手柄，拖拽旋转，精确角度输入框
  - Fabric.js API：默认已启用旋转控制点 + `object.rotate(angle)`

- [x] **T6: 组合/取消组合**
  - 状态：✅ 完成
  - 内容：Ctrl+G 组合、Ctrl+Shift+G 取消组合，工具栏按钮
  - Fabric.js API：`activeSelection.toGroup()`, `group.toActiveSelection()`

- [x] **T7: 画布缩放和平移**
  - 状态：✅ 完成
  - 内容：Ctrl+滚轮缩放、空格+拖拽平移画布
  - Fabric.js API：`canvas.zoomToPoint()`, `canvas.relativePan()`

- [x] **T8: 对齐辅助线**
  - 状态：✅ 完成
  - 内容：拖动元素时显示水平/垂直参考线，接近时自动吸附（阈值5px）
  - Fabric.js API：`canvas.on('object:moving')` + `canvas.on('after:render')` 自定义绘制

### 第三阶段 — P2（视觉效果）

- [x] **T9: 透明度控制**
  - 状态：✅ 完成
  - 内容：透明度滑块（0-100%）
  - Fabric.js API：`object.set('opacity', 0-1)`

- [x] **T10: 渐变填充**
  - 状态：✅ 完成
  - 内容：纯色/线性渐变/径向渐变，双色选择+角度控制
  - Fabric.js API：`new fabric.Gradient({type: 'linear', ...})`

- [x] **T11: 阴影效果**
  - 状态：✅ 完成
  - 内容：阴影开关+颜色+模糊+X/Y偏移
  - Fabric.js API：`object.set('shadow', new fabric.Shadow({...}))`

## 三、进度记录

| 日期 | 进展 |
|:--|:--|
| 2026-08-09 | 调研完成，任务清单建立，当前处于第一阶段 T1 待开始 |
| 2026-08-09 | T1 文字格式工具栏完成：字号/B/I/U/文字颜色/文字对齐 + Ctrl+B/I/U 快捷键 |
| 2026-08-09 | T2 层级控制完成：上移/下移/置顶/置底 |
| 2026-08-09 | T3 等间距分布完成：水平/垂直等间距分布 |
| 2026-08-09 | T4 边框粗细样式完成：stroke-width 选择器 + 虚线切换 |
| 2026-08-09 | **第一阶段 P0 全部完成** |
| 2026-08-09 | T5 旋转支持完成：旋转手柄 + 精确角度输入框 |
| 2026-08-09 | T6 组合/取消组合完成：Ctrl+G / Ctrl+Shift+G + 工具栏按钮 |
| 2026-08-09 | T7 画布缩放平移完成：Ctrl+滚轮缩放 + 空格拖拽平移 |
| 2026-08-09 | T8 对齐辅助线完成：拖动时参考线 + 5px 自动吸附 |
| 2026-08-09 | **第二阶段 P1 全部完成** |
| 2026-08-09 | T9 透明度控制完成：滑块 0-100% |
| 2026-08-09 | T10 渐变填充完成：纯色/线性/径向渐变 + 双色 + 角度 |
| 2026-08-09 | T11 阴影效果完成：开关+颜色+模糊+偏移 |
| 2026-08-09 | **第三阶段 P2 全部完成，全部任务完成** |
