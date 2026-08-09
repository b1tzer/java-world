/**
 * SVG 预处理模块 — 将原始 SVG 转为 Fabric.js 可渲染格式
 *
 * 处理链：
 *   1. CSS 变量 → hex 色值
 *   2. <stop style="stop-color:..."> → 直接属性
 *   3. <marker> 解析 → 合成 <polygon> 箭头
 *   4. 提取 viewBox / 宽高
 */

import { VAR_TO_HEX } from './constants.js'

/**
 * 将 CSS 变量替换为 hex 色值
 */
function replaceCssVars(svg) {
  let result = svg
  for (const [varName, hex] of Object.entries(VAR_TO_HEX)) {
    result = result.replaceAll(`var(${varName})`, hex)
  }
  return result
}

/**
 * 将 <stop style="stop-color:..."> 转为直接属性
 * Fabric.js 解析器对 style 属性中的 stop-color 支持有限
 */
function fixStopColors(svg) {
  return svg.replace(
    /<stop(\s[^>]*?)style="stop-color:\s*([^;"]+);\s*stop-opacity:\s*([^"]+)"([^>]*?)>/g,
    '<stop$1stop-color="$2" stop-opacity="$3"$4>'
  )
}

/**
 * 提取原始 viewBox
 */
function extractViewBox(svg) {
  const match = svg.match(/viewBox="([^"]+)"/)
  if (!match) return { viewBox: '', width: 0, height: 0 }
  const parts = match[1].split(/[\s,]+/).map(Number)
  return {
    viewBox: match[1],
    width: parts.length >= 4 ? Math.round(parts[2]) : 0,
    height: parts.length >= 4 ? Math.round(parts[3]) : 0,
  }
}

/**
 * 从 marker 定义中提取关键参数
 */
function parseMarkers(svg) {
  const markers = {}

  // polygon 形式
  const polyRe = /<marker\s+id="([^"]+)"[^>]*markerWidth="([^"]+)"[^>]*markerHeight="([^"]+)"[^>]*refX="([^"]+)"[^>]*refY="([^"]+)"[^>]*>\s*<polygon\s+[^>]*points="([^"]+)"[^>]*fill="([^"]+)"[^>]*\/>\s*<\/marker>/g
  let m
  while ((m = polyRe.exec(svg)) !== null) {
    const [, id, mw, mh, refX, , pts, fill] = m
    const tipX = Math.max(...pts.split(/[\s,]+/).filter((_, i) => i % 2 === 0).map(Number))
    markers[id] = { fill, tipOffset: tipX - parseFloat(refX), markerW: parseFloat(mw), markerH: parseFloat(mh) }
  }

  // path 形式
  const pathRe = /<marker\s+id="([^"]+)"[^>]*markerWidth="([^"]+)"[^>]*markerHeight="([^"]+)"[^>]*refX="([^"]+)"[^>]*refY="([^"]+)"[^>]*>\s*<path\s+[^>]*d="([^"]+)"[^>]*fill="([^"]+)"[^>]*\/>\s*<\/marker>/g
  while ((m = pathRe.exec(svg)) !== null) {
    const [, id, mw, mh, refX, , d, fill] = m
    const nums = d.match(/[\d.]+/g)?.map(Number) || []
    const tipX = Math.max(...nums.filter((_, i) => i % 2 === 0))
    markers[id] = { fill, tipOffset: tipX - parseFloat(refX), markerW: parseFloat(mw), markerH: parseFloat(mh) }
  }

  return markers
}

/**
 * 从 <style> 中解析 CSS 类级 marker-end 规则
 */
function parseClassMarkers(svg) {
  const classMarkers = {}
  const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi
  let sm
  while ((sm = styleRe.exec(svg)) !== null) {
    const ruleRe = /\.([\w-]+)\s*\{[^}]*marker-end:\s*url\(#([^)]+)\)[^}]*\}/g
    let rm
    while ((rm = ruleRe.exec(sm[1])) !== null) {
      classMarkers[rm[1]] = rm[2]
    }
  }
  return classMarkers
}

/**
 * 计算箭头三角的 3 个顶点坐标
 */
function computeArrowPoints(x2, y2, angle, marker, prevX, prevY) {
  const tipOffset = marker.tipOffset || 0
  const halfH = (marker.markerH || 8) / 2
  const sx = halfH * Math.sin(angle)
  const sy = -halfH * Math.cos(angle)
  const tipX = x2 + tipOffset * Math.cos(angle)
  const tipY = y2 + tipOffset * Math.sin(angle)
  return `${tipX.toFixed(1)},${tipY.toFixed(1)} ${(x2 + sx).toFixed(1)},${(y2 + sy).toFixed(1)} ${(x2 - sx).toFixed(1)},${(y2 - sy).toFixed(1)}`
}

/**
 * 为 <line> 注入箭头三角形
 */
function injectLineArrows(svg, markers, classMarkers) {
  return svg.replace(
    /<line\s+([^>]*?)\s*\/>/g,
    (full, attrs) => {
      let markerId = ''
      const inlineMe = attrs.match(/marker-end="url\(#([^)]+)\)"/)
      if (inlineMe) {
        markerId = inlineMe[1]
      } else {
        const classMatch = attrs.match(/class="([^"]+)"/)
        if (classMatch) {
          for (const cls of classMatch[1].split(/\s+/)) {
            if (classMarkers[cls]) { markerId = classMarkers[cls]; break }
          }
        }
      }
      if (!markerId || !markers[markerId]) {
        return full.replace(/\s*marker-end="[^"]*"/, '')
      }

      const x1 = parseFloat((attrs.match(/x1="([^"]+)"/) || [])[1] || '0')
      const y1 = parseFloat((attrs.match(/y1="([^"]+)"/) || [])[1] || '0')
      const x2 = parseFloat((attrs.match(/x2="([^"]+)"/) || [])[1] || '0')
      const y2 = parseFloat((attrs.match(/y2="([^"]+)"/) || [])[1] || '0')
      const angle = Math.atan2(y2 - y1, x2 - x1)
      const points = computeArrowPoints(x2, y2, angle, markers[markerId], x1, y1)
      const cleanAttrs = attrs.replace(/\s*marker-end="[^"]*"/, '')
      return `<line ${cleanAttrs}/><polygon points="${points}" fill="${markers[markerId].fill}"/>`
    }
  )
}

/**
 * 为 <path> 注入箭头三角形
 */
function injectPathArrows(svg, markers) {
  return svg.replace(
    /<path\s+([^>]*?)marker-end="url\(#([^)]+)\)"\s*([^>]*?)\s*\/>/g,
    (full, before, markerId, after) => {
      if (!markers[markerId]) return full.replace(/\s*marker-end="[^"]*"/, '')
      const dMatch = (before + ' ' + after).match(/d="([^"]+)"/)
      if (!dMatch) return full
      const nums = dMatch[1].trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n))
      if (nums.length < 2) return full
      const x2 = nums[nums.length - 2]
      const y2 = nums[nums.length - 1]
      const x1 = nums.length >= 4 ? nums[nums.length - 4] : x2 - 10
      const y1 = nums.length >= 4 ? nums[nums.length - 3] : y2
      const angle = Math.atan2(y2 - y1, x2 - x1)
      const points = computeArrowPoints(x2, y2, angle, markers[markerId], x1, y1)
      const combined = (before + ' ' + after).replace(/\s*marker-end="[^"]*"/, '')
      return `<path ${combined}/><polygon points="${points}" fill="${markers[markerId].fill}"/>`
    }
  )
}

/**
 * 主入口：预处理 SVG 文本，返回 Fabric.js 可直接加载的 SVG
 * @returns {{ svg: string, originalViewBox: string, svgWidth: number, svgHeight: number }}
 */
export function preprocessSvg(rawSvg) {
  let svg = rawSvg.replace(/<\?xml[^?]*\?>\s*/g, '')

  const { viewBox, width, height } = extractViewBox(svg)

  // 1. CSS 变量 → hex
  svg = replaceCssVars(svg)

  // 2. <stop style="stop-color:..."> → 直接属性
  svg = fixStopColors(svg)

  // 3. Marker 解析 → 合成箭头三角形
  const markers = parseMarkers(svg)
  const classMarkers = parseClassMarkers(svg)
  svg = injectLineArrows(svg, markers, classMarkers)
  svg = injectPathArrows(svg, markers)

  return { svg, originalViewBox: viewBox, svgWidth: width, svgHeight: height }
}
