import type MarkdownIt from 'markdown-it'
import type { ImageEditorOptions } from './types'

/**
 * markdown-it 插件：拦截图片语法，根据文件类型自动升级为编辑器组件
 *
 * 工作原理：
 * 1. 重写 image 渲染规则
 * 2. 匹配 pattern 的图片返回 Vue 组件 HTML
 * 3. 不匹配的图片使用 markdown-it 默认渲染
 * 4. 自动处理 VitePress 的 base 路径
 */
export function imageEditorMarkdownIt(md: MarkdownIt, options: ImageEditorOptions) {
  const patterns = options.patterns || [/\.editor\.json$/, /\.fabric\.json$/]
  const defaultMode = options.defaultMode || 'view'

  // 获取 VitePress 的 base 路径
  // 在 markdown-it 阶段，可以通过 env 或 options 获取
  const base = options.base || '/'

  // 重写渲染器
  md.renderer.rules.image = function (tokens, idx, options, env, self) {
    const token = tokens[idx]
    const src = token.attrGet('src') || ''
    const alt = token.children?.[0]?.content || ''
    const matched = patterns.some(pattern => pattern.test(src))

    if (matched) {
      // 处理路径：加上 base 路径
      let resolvedSrc = src
      if (src.startsWith('/') && !src.startsWith(base)) {
        // 绝对路径但没有 base 前缀，加上
        resolvedSrc = base.endsWith('/') ? base + src.slice(1) : base + src
      }

      // 返回 Vue 组件 HTML
      return `<image-viewer-wrapper src="${escapeAttr(resolvedSrc)}" alt="${escapeAttr(alt)}" mode="${defaultMode}"></image-viewer-wrapper>`
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
