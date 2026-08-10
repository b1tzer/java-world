# VitePress Image Editor 插件架构设计

> 分支：feat/image-editor
> 目标：基于 vue-fabric-editor 的 @kuaitu/core，做成 VitePress 插件
> 两种模式：编辑模式（Edit）+ 看图模式（View）
> 内置功能：明暗色主题自适应

---

## 一、架构总览

```
vitepress-plugin-image-editor/
├── index.ts                  # 插件入口（VitePress plugin）
├── components/
│   ├── ImageEditor.vue       # 编辑模式组件
│   ├── ImageViewer.vue       # 看图模式组件
│   └── ImageEditorWrapper.vue # 自动切换模式的包装组件
├── composables/
│   ├── useEditor.ts          # 编辑器核心逻辑
│   ├── useTheme.ts           # 明暗色主题适配
│   └── useImageStore.ts      # 图片数据存储
├── plugins/                  # 精选的 fabric.js 插件
│   ├── HistoryPlugin.ts      # 撤销/重做
│   ├── ClipImagePlugin.ts    # 图片裁剪
│   ├── FilterPlugin.ts       # 图片滤镜
│   ├── WorkspacePlugin.ts    # 画布工作区
│   └── ExportPlugin.ts       # 导出功能
├── types/
│   └── index.ts              # TypeScript 类型定义
└── styles/
    ├── editor.css            # 编辑器样式
    └── themes.css            # 明暗色主题变量
```

---

## 二、插件注册方式

### 2.1 VitePress Plugin 注册

```typescript
// docs/.vitepress/theme/index.ts
import DefaultTheme from 'vitepress/theme'
import { createImageEditor } from 'vitepress-plugin-image-editor'

const imageEditor = createImageEditor({
  // 配置项
  theme: 'auto',           // 'light' | 'dark' | 'auto'
  defaultMode: 'view',     // 'view' | 'edit'
  exportFormats: ['png', 'jpg', 'svg', 'json'],
  maxCanvasSize: 4096,
  locale: 'zh-CN',
})

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    imageEditor.install(app)  // 注册全局组件
  },
  // VitePress 主题扩展
  setup() {
    imageEditor.setup()       // 初始化主题监听
  }
}
```

### 2.2 Markdown 中使用

```markdown
<!-- 基础用法 - 看图模式 -->
<ImageEditor src="./diagrams/architecture.json" />

<!-- 编辑模式 -->
<ImageEditor src="./diagrams/architecture.json" mode="edit" />

<!-- 带配置 -->
<ImageEditor 
  src="./diagrams/architecture.json" 
  mode="edit"
  :width="800"
  :height="600"
  :toolbar="['draw', 'text', 'shape', 'image']"
/>
```

---

## 三、两种模式

### 3.1 看图模式（View Mode）

**功能：**
- 渲染 fabric.js JSON / SVG / PNG
- 缩放（滚轮 + 按钮）
- 平移（拖拽）
- 全屏查看
- 下载图片
- 自适应容器大小
- **明暗色主题自动切换**（内置）

**UI 布局：**
```
┌─────────────────────────────────┐
│  [−] [+] [⊡ 全屏] [↓ 下载]     │  ← 浮动工具栏
├─────────────────────────────────┤
│                                 │
│         Canvas 画布             │
│                                 │
└─────────────────────────────────┘
```

### 3.2 编辑模式（Edit Mode）

**功能：**
- 完整的图片编辑能力
- 工具栏（左侧）：选择、画笔、文字、形状、图片
- 属性面板（右侧）：填充、描边、阴影、透明度、滤镜
- 图层管理
- 撤销/重做
- 导出（PNG/SVG/JSON）
- 快捷键支持
- **明暗色主题自动切换**（内置）

**UI 布局：**
```
┌──────────────────────────────────────────────┐
│  [↩ 撤销] [↪ 重做] [保存] [导出] [预览]      │  ← 顶部工具栏
├────┬─────────────────────────────┬───────────┤
│ 工 │                             │   属性    │
│ 具 │       Canvas 画布           │   面板    │
│ 栏 │                             │           │
│    │                             │   图层    │
├────┴─────────────────────────────┴───────────┤
│  状态栏：画布尺寸 | 缩放比例 | 选中元素       │
└──────────────────────────────────────────────┘
```

---

## 四、明暗色主题（内置核心功能）

### 4.1 实现原理

```typescript
// composables/useTheme.ts
export function useTheme(options: ThemeOptions) {
  // 监听 VitePress 主题变化
  const isDark = useDark({
    storageKey: 'vitepress-theme-appearance',
    valueDark: 'dark',
    valueLight: 'light',
  })

  // 画布背景色跟随主题
  const canvasBackground = computed(() => 
    isDark.value ? '#1a1a1a' : '#ffffff'
  )

  // 工具栏/面板主题变量
  const themeVars = computed(() => ({
    '--ie-bg': isDark.value ? '#1e1e1e' : '#ffffff',
    '--ie-bg-secondary': isDark.value ? '#252525' : '#f5f5f5',
    '--ie-text': isDark.value ? '#e0e0e0' : '#333333',
    '--ie-border': isDark.value ? '#333333' : '#e0e0e0',
    '--ie-accent': '#2563eb',
    '--ie-canvas-bg': canvasBackground.value,
  }))

  // 同步到 CSS 变量
  watchEffect(() => {
    const el = document.documentElement
    Object.entries(themeVars.value).forEach(([key, val]) => {
      el.style.setProperty(key, val)
    })
  })

  return { isDark, canvasBackground, themeVars }
}
```

### 4.2 画布主题适配

- **看图模式**：画布背景透明，跟随 VitePress 页面背景
- **编辑模式**：画布背景白色（编辑时保持所见即所得）
- **导出时**：始终使用白色背景（不受主题影响）

---

## 五、核心依赖

| 依赖 | 版本 | 用途 |
|---|---|---|
| fabric | 5.3.0 | Canvas 编辑核心 |
| @vueuse/core | ^10.x | useDark、useFullscreen 等 |
| vue | ^3.2 | 组件框架 |

**不直接依赖 @kuaitu/core**，而是：
1. 参考其插件架构设计
2. 精选需要的插件代码（裁剪、滤镜、历史记录等）
3. 自己封装成 VitePress 兼容的组件

---

## 六、精选插件清单

从 vue-fabric-editor 的 34 个插件中，精选 **8 个核心插件**：

| 插件 | 来源 | 改造点 |
|---|---|---|
| WorkspacePlugin | @kuaitu/core | 去掉 #workspace 依赖，改为 props 传入 |
| HistoryPlugin | @kuaitu/core | 去掉 window.beforeunload，适配 SPA |
| SimpleClipImagePlugin | @kuaitu/core | 直接复用 |
| AlignGuidLinePlugin | @kuaitu/core | 直接复用 |
| CopyPlugin | @kuaitu/core | 直接复用 |
| LayerPlugin | @kuaitu/core | 直接复用 |
| FlipPlugin | @kuaitu/core | 直接复用 |
| ExportPlugin | ServersPlugin | 只保留导出相关逻辑 |

**不引入的插件：**
- MaterialPlugin（素材管理，需要后端 API）
- PsdPlugin（PSD 解析，体积大）
- BarCodePlugin / QrCodePlugin（特殊功能，按需引入）
- FontPlugin（字体管理，需要 CDN）
- WaterMarkPlugin（水印，按需引入）

---

## 七、数据流

```
用户操作 → fabric.js Canvas → 事件通知 → Vue 响应式更新 → UI 同步
                                    ↓
                              JSON 序列化 → 存储/导出
```

### 7.1 编辑模式数据流

```
编辑器初始化 → 注册插件 → 加载 JSON → 用户编辑 → 实时保存 JSON
                                    ↓
                              撤销/重做栈
```

### 7.2 看图模式数据流

```
加载 JSON/SVG → 渲染 Canvas → 用户查看（缩放/平移）
                              ↓
                        下载 PNG/SVG
```

---

## 八、文件输出计划

### Phase 1：基础框架
1. `index.ts` — 插件入口
2. `types/index.ts` — 类型定义
3. `styles/themes.css` — 明暗色主题变量
4. `composables/useTheme.ts` — 主题适配

### Phase 2：看图模式
5. `composables/useViewer.ts` — 看图核心逻辑
6. `components/ImageViewer.vue` — 看图组件
7. `plugins/ExportPlugin.ts` — 导出功能

### Phase 3：编辑模式
8. `composables/useEditor.ts` — 编辑器核心
9. `plugins/WorkspacePlugin.ts` — 工作区
10. `plugins/HistoryPlugin.ts` — 撤销重做
11. `plugins/ClipImagePlugin.ts` — 图片裁剪
12. `plugins/FilterPlugin.ts` — 图片滤镜
13. `components/ImageEditor.vue` — 编辑器组件
14. `components/ImageEditorWrapper.vue` — 模式切换包装

### Phase 4：集成
15. 修改 `docs/.vitepress/theme/index.ts` 注册插件
16. 编写使用文档

---

## 九、与现有 SVG 编辑器的关系

| 特性 | SVG 编辑器 | Image Editor 插件 |
|---|---|---|
| 用途 | SVG 图片编辑 | 通用图片编辑（PNG/JPG/SVG） |
| 库 | fabric.js | fabric.js |
| 集成方式 | 独立 HTML 页面 | VitePress 组件插件 |
| 主题 | 无 | 内置明暗色 |
| 复用性 | 低（绑定 HTML） | 高（npm 包，任意 VitePress 项目） |

**建议：** SVG 编辑器可以逐步迁移到 Image Editor 插件，统一技术栈。

---

## 十、风险与对策

| 风险 | 对策 |
|---|---|
| fabric.js 5.3.0 体积大（~300KB） | Vite 按需打包 + gzip |
| 编辑模式在移动端体验差 | 移动端默认看图模式 |
| 字体加载跨域问题 | 使用系统字体 + 可选 CDN |
| 大图片性能问题 | 限制最大尺寸 + Web Worker |
| VitePress SSR 兼容 | 组件使用 `<ClientOnly>` 包裹 |
