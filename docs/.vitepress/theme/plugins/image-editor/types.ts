import type { App, Plugin } from 'vue'
import type MarkdownIt from 'markdown-it'

// 插件配置
export interface ImageEditorOptions {
  /** 文件匹配模式，匹配到的图片语法会自动升级为编辑器 */
  patterns?: RegExp[]
  /** 默认模式：view（看图）或 edit（编辑） */
  defaultMode?: 'view' | 'edit'
  /** 主题：light、dark、auto（跟随 VitePress） */
  theme?: 'light' | 'dark' | 'auto'
  /** 导出格式 */
  exportFormats?: ('png' | 'jpg' | 'svg' | 'json')[]
  /** 画布最大尺寸 */
  maxCanvasSize?: number
}

// 插件实例
export interface ImageEditorPlugin {
  install: (app: App) => void
  extendMarkdown: (md: MarkdownIt) => void
  setup: () => void
}

// 编辑器状态
export interface EditorState {
  canvas: fabric.Canvas | null
  selectedObjects: fabric.Object[]
  canUndo: boolean
  canRedo: boolean
  zoom: number
  canvasWidth: number
  canvasHeight: number
}

// 看图器状态
export interface ViewerState {
  zoom: number
  panX: number
  panY: number
  isFullscreen: boolean
}

// 导出选项
export interface ExportOptions {
  format: 'png' | 'jpg' | 'svg' | 'json'
  quality?: number
  multiplier?: number
}

// 主题变量
export interface ThemeVars {
  '--ie-bg': string
  '--ie-bg-secondary': string
  '--ie-text': string
  '--ie-text-secondary': string
  '--ie-border': string
  '--ie-accent': string
  '--ie-shadow': string
  '--ie-canvas-bg': string
  '--ie-canvas-grid': string
}

// 工具栏项
export interface ToolbarItem {
  id: string
  icon: string
  label: string
  action: () => void
  disabled?: boolean
  active?: boolean
}

// 插件接口（参考 @kuaitu/core）
export interface IPluginTempl {
  static pluginName: string
  static events?: string[]
  static apis?: string[]
  hotkeys?: string[]
  hotkeyEvent?: (name: string, e: KeyboardEvent) => void
  hookImportBefore?: (...args: unknown[]) => Promise<unknown>
  hookImportAfter?: (...args: unknown[]) => Promise<unknown>
  hookSaveBefore?: (...args: unknown[]) => Promise<unknown>
  hookSaveAfter?: (...args: unknown[]) => Promise<unknown>
  destroy?: () => void
}

declare module 'markdown-it' {
  interface MarkdownIt {
    imageEditorPatterns?: RegExp[]
  }
}
