import type MarkdownIt from 'markdown-it'
import type { ImageEditorOptions } from './types'

/**
 * markdown-it 插件：拦截图片语法，根据文件类型自动升级为编辑器组件
 *
 * 工作原理：
 * 1. 重写 image 渲染规则
 * 2. 匹配 pattern 的图片返回 Vue 组件 HTML
 * 3. 不匹配的图片使用 markdown-it 默认渲染
 */
export function imageEditorMarkdownIt(md: MarkdownIt, options: ImageEditorOptions) {
  const patterns = options.patterns || [/\.editor\.json$/, /\.fabric\.json$/]
  const defaultMode = options.defaultMode || 'view'

  // 重写渲染器
  md.renderer.rules.image = function (tokens, idx, options, env, self) {
    const token = tokens[idx]
    const src = token.attrGet('src') || ''
    const alt = token.children?.[0]?.content || ''
    const matched = patterns.some(pattern => pattern.test(src))

    if (matched) {
      // 返回 Vue 组件 HTML
      return `<image-viewer-wrapper src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" mode="${defaultMode}"></image-viewer-wrapper>`
    }

    // 非编辑器图片，使用默认渲染
    return self.renderToken(tokens, idx, env)
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
