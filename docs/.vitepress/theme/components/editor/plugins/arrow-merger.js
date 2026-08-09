/**
 * 箭头合并插件 — 将相邻 line + polygon 合并为 Group
 * Fabric.js 加载 SVG 时可能不自动识别 <g> 包裹的箭头对，需要手动合并
 */

export function mergeArrows(objects) {
  const result = []
  const used = new Set()
  for (let i = 0; i < objects.length; i++) {
    if (used.has(i)) continue
    const obj = objects[i]
    if (obj.type === 'line' && i + 1 < objects.length) {
      const next = objects[i + 1]
      if (next.type === 'polygon' && !used.has(i + 1)) {
        const dist = Math.sqrt(
          ((obj.x2 || 0) - ((next.left || 0) + (next.width || 0) / 2)) ** 2 +
          ((obj.y2 || 0) - ((next.top || 0) + (next.height || 0) / 2)) ** 2
        )
        if (dist < 30) {
          result.push(new window.fabric.Group([obj, next], {
            selectable: true,
            evented: true,
            perPixelTargetFind: false,
            subTargetCheck: true,
          }))
          used.add(i)
          used.add(i + 1)
          continue
        }
      }
    }
    result.push(obj)
    used.add(i)
  }
  return result
}
