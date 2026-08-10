import type MarkdownIt from 'markdown-it'
import type { ImageEditorOptions } from './types'

/**
 * markdown-it 插件：拦截图片语法，根据文件类型自动升级为编辑器组件
 *
 * 用户继续写标准 Markdown 图片语法：
 *   ![架构图](./diagrams/architecture.editor.json)
 *
 * 匹配到 pattern 的图片会被替换为 Vue 组件标签：
 *   <ImageViewerWrapper src="./diagrams/architecture.editor.json" mode="view" />
 */
export function imageEditorMarkdownIt(md: MarkdownIt, options: ImageEditorOptions) {
  const patterns = options.patterns || [/\.editor\.json$/, /\.fabric\.json$/]
  const defaultMode = options.defaultMode || 'view'

  // 保存原始 image 渲染器
  const defaultRender = md.renderer.rules.image || function (tokens, idx, env, self) {
    return self.renderToken(tokens, idx, env)
  }

  // 重写 image 渲染规则
  md.renderer.rules.image = (tokens, idx, env, self) => {
    const token = tokens[idx]
    const src = token.attrGet('src') || ''
    const alt = token.children?.[0]?.content || ''

    // 检查是否匹配编辑器文件模式
    const matched = patterns.some(pattern => pattern.test(src))

    if (matched) {
      // 返回 Vue 组件标签（VitePress 会渲染为 Vue 组件）
      // 使用 kebab-case 组件名，VitePress 会自动识别
      return `<ImageViewerWrapper src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" mode="${defaultMode}" />\n`
    }

    // 不匹配则使用默认渲染
    return defaultRender(tokens, idx, env, self)
  }
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
