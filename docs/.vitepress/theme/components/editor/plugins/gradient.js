/**
 * 渐变填充插件 — 纯色/线性/径向
 * 依赖：全局 fabric（由 CanvasManager 保证可用）
 */

export function applyGradient(canvas, { type, angle, color1, color2 }) {
  const a = canvas.getActiveObject()
  if (!a) return
  if (type === 'none') {
    a.set('fill', color1)
  } else {
    const radAngle = angle * Math.PI / 180
    const len = Math.max(a.width || 100, a.height || 100) / 2
    const grad = new window.fabric.Gradient({
      type,
      coords: type === 'linear' ? {
        x1: a.width / 2 - len * Math.cos(radAngle),
        y1: a.height / 2 - len * Math.sin(radAngle),
        x2: a.width / 2 + len * Math.cos(radAngle),
        y2: a.height / 2 + len * Math.sin(radAngle),
      } : {
        r1: 0,
        r2: Math.max(a.width || 100, a.height || 100) / 2,
        x1: a.width / 2,
        y1: a.height / 2,
        x2: a.width / 2,
        y2: a.height / 2,
      },
      colorStops: [
        { offset: 0, color: color1 },
        { offset: 1, color: color2 },
      ],
    })
    a.set('fill', grad)
  }
  canvas.renderAll()
}
