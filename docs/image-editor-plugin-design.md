# VitePress Image Editor 插件架构设计

> 分支：feat/image-editor
> 方案：markdown-it 插件拦截图片语法，根据文件类型自动升级渲染
> 两种模式：编辑模式（Edit）+ 看图模式（View）
> 内置功能：明暗色主题自适应

---

## 一、核心思路：零侵入，自动识别

用户继续写标准 Markdown 图片语法，markdown-it 插件拦截渲染，根据后缀自动升级：

```markdown
![架构图](./diagrams/architecture.editor.json)   → 自动渲染为可交互编辑器
![流程图](./diagrams/flow.svg)                     → 可选：升级为可交互 SVG
![截图](./images/screenshot.png)                   → 普通图片，不干预
```

| 文件后缀 | 渲染行为 |
|---|---|
| `.png`、`.jpg`、`.webp`、`.gif` | 普通 `<img>`（不干预） |
| `.svg` | 普通 `<img>`（可选升级） |
| `.editor.json` / `.fabric.json` | 自动升级为 fabric.js 编辑器/查看器 |

---

## 二、目录结构

```
docs/.vitepress/theme/
├── plugins/
│   └── image-editor/
│       ├── index.ts                  # 插件入口（createImageEditor）
│       ├── markdown-it.ts            # markdown-it 插件（拦截图片语法）
│       ├── components/
│       │   ├── ImageEditor.vue       # 编辑模式组件
│       │   ├── ImageViewer.vue       # 看图模式组件
│       │   └── ImageEditorWrapper.vue # 模式切换包装
│       ├── composables/
│       │   ├── useEditor.ts          # 编辑器核心逻辑
│       │   ├── useViewer.ts          # 看图核心逻辑
│       │   ├── useTheme.ts           # 明暗色主题适配
│       │   └── useImageStore.ts      # 图片数据存储
│       ├── fabric-plugins/           # 精选的 fabric.js 插件
│       │   ├── WorkspacePlugin.ts    # 画布工作区
│       │   ├── HistoryPlugin.ts      # 撤销/重做
│       │   ├── ClipImagePlugin.ts    # 图片裁剪
│       │   ├── FilterPlugin.ts       # 图片滤镜
│       │   ├── AlignPlugin.ts        # 对齐辅助线
│       │   └── ExportPlugin.ts       # 导出功能
│       ├── types.ts                  # 类型定义
│       └── styles/
│           ├── editor.css            # 编辑器样式
│           └── themes.css            # 明暗色主题变量
```

---

## 三、注册方式

### 3.1 VitePress 主题注册（唯一需要改的文件）

```typescript
// docs/.vitepress/theme/index.ts
import DefaultTheme from 'vitepress/theme'
import { createImageEditor } from './plugins/image-editor'

const imageEditor = createImageEditor({
  patterns: [/\.editor\.json$/, /\.fabric\.json$/],
  defaultMode: 'view',
  theme: 'auto',
})

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    imageEditor.install(app)   // 注册全局组件
  },
  extendsMarkdown(md) {
    imageEditor.extendMarkdown(md)  // 注册 markdown-it 插件
  }
}
```

### 3.2 用户使用（零新语法）

```markdown
<!-- 编辑器 JSON 文件，自动渲染为可交互编辑器 -->
![架构图](./diagrams/architecture.editor.json)

<!-- 普通图片，不受影响 -->
![截图](./images/screenshot.png)
```

---

## 四、markdown-it 插件实现原理

```typescript
// markdown-it.ts
export function imageEditorMarkdownIt(md: MarkdownIt, options: Options) {
  // 保存原始 image 渲染器
  const defaultRender = md.renderer.rules.image!

  // 重写 image 渲染规则
  md.renderer.rules.image = (tokens, idx, env, self) => {
    const token = tokens[idx]
    const src = token.attrGet('src') || ''

    // 检查是否匹配编辑器文件模式
    if (options.patterns.some(pattern => pattern.test(src))) {
      // 返回 Vue 组件标签（VitePress 会渲染为 Vue 组件）
      return `<ImageViewerWrapper src="${src}" mode="${options.defaultMode}" />\n`
    }

    // 不匹配则使用默认渲染
    return defaultRender(tokens, idx, env, self)
  }
}
```

---

## 五、两种模式

### 5.1 看图模式（View Mode）— 默认

- 渲染 fabric.js JSON
- 缩放（滚轮 + 按钮）
- 平移（拖拽）
- 全屏查看
- 下载图片
- 明暗色主题自动切换

```
┌─────────────────────────────────┐
│  [−] [+] [⊡ 全屏] [↓ 下载]     │  ← 浮动工具栏
├─────────────────────────────────┤
│         Canvas 画布             │
└─────────────────────────────────┘
```

### 5.2 编辑模式（Edit Mode）

- 完整编辑能力
- 工具栏 + 属性面板 + 图层
- 撤销/重做、导出
- 快捷键支持
- 明暗色主题自动切换

```
┌──────────────────────────────────────────────┐
│  [↩ 撤销] [↪ 重做] [保存] [导出] [预览]      │
├────┬─────────────────────────────┬───────────┤
│ 工 │       Canvas 画布           │   属性    │
│ 具 │                             │   面板    │
│ 栏 │                             │           │
├────┴─────────────────────────────┴───────────┤
│  画布尺寸 | 缩放比例 | 选中元素               │
└──────────────────────────────────────────────┘
```

---

## 六、明暗色主题（内置）

```typescript
// composables/useTheme.ts
export function useTheme() {
  const isDark = useDark({
    storageKey: 'vitepress-theme-appearance',
  })

  const themeVars = computed(() => ({
    '--ie-bg': isDark.value ? '#1e1e1e' : '#ffffff',
    '--ie-bg-secondary': isDark.value ? '#252525' : '#f5f5f5',
    '--ie-text': isDark.value ? '#e0e0e0' : '#333333',
    '--ie-border': isDark.value ? '#333333' : '#e0e0e0',
    '--ie-accent': '#2563eb',
  }))

  // 画布背景
  const canvasBackground = computed(() =>
    isDark.value ? '#1a1a1a' : '#ffffff'
  )

  return { isDark, themeVars, canvasBackground }
}
```

---

## 七、精选插件清单

从 vue-fabric-editor 的 34 个插件中精选 6 个：

| 插件 | 用途 | 来源 |
|---|---|---|
| WorkspacePlugin | 画布工作区、缩放 | 参考 @kuaitu/core |
| HistoryPlugin | 撤销/重做 | 参考 @kuaitu/core |
| ClipImagePlugin | 图片裁剪 | 参考 SimpleClipImagePlugin |
| AlignPlugin | 对齐辅助线 | 参考 AlignGuidLinePlugin |
| FilterPlugin | 图片滤镜 | fabric.js 内置 |
| ExportPlugin | 导出 PNG/SVG/JSON | 参考 ServersPlugin |

---

## 八、依赖

| 依赖 | 版本 | 用途 |
|---|---|---|
| fabric | 5.3.0 | Canvas 编辑核心 |
| @vueuse/core | ^10.x | useDark、useFullscreen |
| vue | ^3.2 | 组件框架 |
| markdown-it | VitePress 内置 | Markdown 解析 |

---

## 九、与现有 SVG 编辑器的关系

| 特性 | SVG 编辑器 | Image Editor 插件 |
|---|---|---|
| 集成方式 | 独立 HTML 页面 | VitePress 主题插件 |
| 使用方式 | 打开独立页面 | Markdown 中自动识别 |
| 主题 | 无 | 内置明暗色 |
| 复用性 | 低 | 高（npm 包） |

SVG 编辑器可以逐步迁移到 Image Editor 插件。
