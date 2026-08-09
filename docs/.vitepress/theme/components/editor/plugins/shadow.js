/**
 * 阴影效果插件 — 开/关 + 参数调整
 */

export function toggleShadow(canvas) {
  const a = canvas.getActiveObject()
  if (!a) return false
  if (a.shadow) {
    a.set('shadow', null)
    canvas.renderAll()
    return false
  }
  a.set('shadow', new window.fabric.Shadow({
    color: '#000000', blur: 5, offsetX: 3, offsetY: 3,
  }))
  canvas.renderAll()
  return true
}

export function applyShadow(canvas, { color, blur, offsetX, offsetY }) {
  const a = canvas.getActiveObject()
  if (!a || !a.shadow) return
  a.set('shadow', new window.fabric.Shadow({ color, blur, offsetX, offsetY }))
  canvas.renderAll()
}
