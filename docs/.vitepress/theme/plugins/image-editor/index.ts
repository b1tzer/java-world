import type { App } from 'vue'
import type MarkdownIt from 'markdown-it'
import type { ImageEditorOptions, ImageEditorPlugin } from './types'
import { imageEditorMarkdownIt } from './markdown-it'
import ImageViewerWrapper from './components/ImageViewerWrapper.vue'
import ImageViewer from './components/ImageViewer.vue'
import './styles/editor.css'

/**
 * 创建 VitePress Image Editor 插件
 *
 * @example
 * ```typescript
 * // docs/.vitepress/theme/index.ts
 * import { createImageEditor } from './plugins/image-editor'
 *
 * const imageEditor = createImageEditor({
 *   patterns: [/\.editor\.json$/, /\.fabric\.json$/],
 *   defaultMode: 'view',
 * })
 *
 * export default {
 *   extends: DefaultTheme,
 *   enhanceApp({ app }) {
 *     imageEditor.install(app)
 *   },
 *   extendsMarkdown(md) {
 *     imageEditor.extendMarkdown(md)
 *   }
 * }
 * ```
 */
export function createImageEditor(options: ImageEditorOptions = {}): ImageEditorPlugin {
  const {
    patterns = [/\.editor\.json$/, /\.fabric\.json$/],
    defaultMode = 'view',
    theme = 'auto',
  } = options

  return {
    /**
     * 注册 Vue 全局组件
     */
    install(app: App) {
      // 注册包装组件（markdown-it 插件会生成这个标签）
      app.component('ImageViewerWrapper', ImageViewerWrapper)
      // 注册独立使用的组件
      app.component('ImageViewer', ImageViewer)
    },

    /**
     * 注册 markdown-it 插件
     * 拦截图片语法，根据文件后缀自动升级为编辑器组件
     */
    extendMarkdown(md: MarkdownIt) {
      imageEditorMarkdownIt(md, { patterns, defaultMode })
    },

    /**
     * 初始化主题监听（可选，在 setup 中调用）
     */
    setup() {
      // 主题监听已在 useTheme composable 中通过 MutationObserver 实现
      // 这里可以做其他全局初始化
    },
  }
}

// 导出组件供独立使用
export { ImageViewer, ImageViewerWrapper }

// 导出 composables
export { useTheme } from './composables/useTheme'

// 导出类型
export type {
  ImageEditorOptions,
  ImageEditorPlugin,
  EditorState,
  ViewerState,
  ExportOptions,
  ThemeVars,
  ToolbarItem,
} from './types'
