/**
 * SVG 后处理模块 — 将 Fabric.js toSVG() 输出还原为原始 SVG 格式
 *
 * 处理链：
 *   1. 展开 Group transform → 绝对坐标
 *   2. rgb() → hex
 *   3. hex → CSS 变量
 *   4. 恢复 viewBox，移除 width/height
 *   5. 清理 Fabric.js 冗余头部信息
 */

import { CSS_COLORS } from './constants.js'

/**
 * 主入口：清理 Fabric.js 输出的 SVG
 */
export function cleanFabricSvg(svg) {
  let s = svg

  // 1. 移除 Fabric.js 冗余头部
  s = s.replace(/<\?xml[^?]*\?>\s*/g, '')
  s = s.replace(/<!DOCTYPE[^>]*>\s*/g, '')
  s = s.replace(/<desc>[^<]*<\/desc>\s*/g, '')
  s = s.replace(/<defs>\s*<\/defs>\s*/g, '')
  s = s.replace(/ xmlns:xlink="[^"]*"/g, '')
  s = s.replace(/ version="[^"]*"/g, '')
  s = s.replace(/ xml:space="preserve"/g, '')

  // 2. 展开 Group transform → 绝对坐标
  s = unwrapGroups(s)

  // 3. 清理多余空白
  s = s.replace(/\n\s*\n/g, '\n')

  return s.trim()
}

/**
 * 展开 Fabric.js Group 的矩阵平移
 * Fabric.js 将每个元素包裹在 <g transform="matrix(1 0 0 1 tx ty)"> 中
 */
function unwrapGroups(svg) {
  return svg.replace(
    /<g\s+transform="matrix\(1\s+0\s+0\s+1\s+([\d.\-]+)\s+([\d.\-]+)\)"[^>]*>\s*([\s\S]*?)<\/g>/g,
    (full, txStr, tyStr, inner) => {
      const tx = parseFloat(txStr)
      const ty = parseFloat(tyStr)
      const trimmed = inner.trim()

      // <text><tspan> 结构
      const textMatch = trimmed.match(
        /^(<text[^>]*>)\s*<tspan\s+x="([\d.\-]+)"\s+y="([\d.\-]+)"[^>]*>([\s\S]*?)<\/tspan>\s*<\/text>$/
      )
      if (textMatch) {
        const [, origAttrs, lx, ly, content] = textMatch
        const absX = tx + parseFloat(lx), absY = ty + parseFloat(ly)
        let attrs = origAttrs
          .replace(/\s+xml:space="preserve"/g, '')
          .replace(/^<text/, `<text x="${absX.toFixed(1)}" y="${absY.toFixed(1)}"`)
          .replace(/>$/, '')
        return `${attrs}>${content}</text>`
      }

      // <rect> 结构
      const rectMatch = trimmed.match(/^(<rect[^>]*?)\s+style="[^"]*"([^>]*\/>)\s*$/)
      if (rectMatch) {
        return trimmed
          .replace(/ x="([\d.\-]+)"/, (m, v) => ` x="${(tx + parseFloat(v)).toFixed(1)}"`)
          .replace(/ y="([\d.\-]+)"/, (m, v) => ` y="${(ty + parseFloat(v)).toFixed(1)}"`)
      }

      // <line> 结构
      const lineMatch = trimmed.match(/^(<line[^>]*?)\s+style="[^"]*"([^>]*\/>)\s*$/)
      if (lineMatch) {
        return trimmed
          .replace(/ x1="([\d.\-]+)"/, (m, v) => ` x1="${(tx + parseFloat(v)).toFixed(1)}"`)
          .replace(/ y1="([\d.\-]+)"/, (m, v) => ` y1="${(ty + parseFloat(v)).toFixed(1)}"`)
          .replace(/ x2="([\d.\-]+)"/, (m, v) => ` x2="${(tx + parseFloat(v)).toFixed(1)}"`)
          .replace(/ y2="([\d.\-]+)"/, (m, v) => ` y2="${(ty + parseFloat(v)).toFixed(1)}"`)
      }

      // <polygon> 结构
      const polyMatch = trimmed.match(/^(<polygon[^>]*?)\s+style="[^"]*"([^>]*\/>)\s*$/)
      if (polyMatch) {
        return trimmed.replace(/ points="([^"]+)"/, (m, pts) => {
          const newPts = pts.trim().split(/\s+/).map(pair => {
            const [x, y] = pair.split(',').map(Number)
            return `${(tx + x).toFixed(1)},${(ty + y).toFixed(1)}`
          }).join(' ')
          return ` points="${newPts}"`
        })
      }

      return full
    }
  )
}

/**
 * rgb() → hex 转换
 */
export function rgbToHex(svg) {
  return svg.replace(
    /rgb\((\d+),\s*(\d+),\s*(\d+)\)/gi,
    (_, r, g, b) => '#' + [r, g, b].map(x => parseInt(x).toString(16).padStart(2, '0').toUpperCase()).join('')
  )
}

/**
 * hex → CSS 变量还原
 */
export function hexToCssVars(svg) {
  let result = svg
  for (const [hex, info] of Object.entries(CSS_COLORS)) {
    result = result.replace(new RegExp(hex, 'gi'), `var(${info})`)
  }
  return result
}

/**
 * 恢复原始 viewBox 并移除 Fabric.js 添加的 width/height
 */
export function restoreViewBox(svg, originalViewBox) {
  if (!originalViewBox) return svg
  let result = svg.replace(/viewBox="[^"]*"/, `viewBox="${originalViewBox}"`)
  result = result.replace(/\s+width="[^"]*"/, '').replace(/\s+height="[^"]*"/, '')
  return result
}

/**
 * 移除 Fabric.js 自动添加的画布背景 rect
 */
export function removeCanvasBg(svg) {
  return svg.replace(/<rect\s+x="0"\s+y="0"\s+width="100%"\s+height="100%"\s+fill="#F5F5F5"\s*\/?>\s*(?:<\/rect>)?\s*/gi, '')
}
