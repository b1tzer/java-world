# SVG 布局优化 — 执行记录

> 分支: `feat/svg-editor`  
> 更新时间: 2026-08-08 22:00

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
- 状态：**基础框架完成，待调试验证**
- 问题：画布不显示 SVG 元素（待修复）

## 三、当前产出

### 工具文件（`feat/svg-editor` 分支）

| 文件 | 状态 | 说明 |
| :-- | :-- | :-- |
| `docs/.vitepress/theme/components/SvgDiagram.vue` | ✅ | 增加 dev 模式悬浮编辑按钮 |
| `docs/.vitepress/theme/components/SvgEditor.vue` | ⚠️ | Fabric.js 编辑器弹窗（画布渲染待修复） |
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

1. **修复 SvgEditor.vue 画布渲染问题** — 用无头 Chrome 验证
2. **逐个手动修复 SVG** — 用可视化编辑器拖拽调整，保存时自动转换 CSS 变量
3. **验证明暗模式** — 确认 CSS 变量在亮/暗主题下正确切换

## 六、关键教训

- SVG 布局不能靠程序自动修复，位置关系是牵一发动全身的
- D2/Mermaid 等声明式工具的渲染效果与手写 SVG 差距大
- 正确方向是：**可视化编辑器 + 手动拖拽 + 自动 CSS 变量转换**
- 编辑器必须集成到 `npm run dev` 工作流中，不能是独立工具
