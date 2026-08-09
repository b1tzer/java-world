/**
 * 对齐插件 — 对多选元素执行 6 种对齐操作
 * 依赖：Fabric.js canvas API
 */

function getMultiSelectObjs(canvas) {
  const sel = canvas.getActiveObject()
  if (!sel || !sel._objects || sel._objects.length < 2) return []
  return sel._objects
}

export function alignLeft(canvas) {
  const objs = getMultiSelectObjs(canvas)
  if (!objs.length) return
  const min = Math.min(...objs.map(o => o.left))
  objs.forEach(o => o.set('left', min))
  canvas.renderAll()
}

export function alignRight(canvas) {
  const objs = getMultiSelectObjs(canvas)
  if (!objs.length) return
  const max = Math.max(...objs.map(o => o.left + o.width * (o.scaleX || 1)))
  objs.forEach(o => o.set('left', max - o.width * (o.scaleX || 1)))
  canvas.renderAll()
}

export function alignCenterH(canvas) {
  const objs = getMultiSelectObjs(canvas)
  if (!objs.length) return
  const avg = objs.reduce((s, o) => s + o.left + o.width * (o.scaleX || 1) / 2, 0) / objs.length
  objs.forEach(o => o.set('left', avg - o.width * (o.scaleX || 1) / 2))
  canvas.renderAll()
}

export function alignTop(canvas) {
  const objs = getMultiSelectObjs(canvas)
  if (!objs.length) return
  const min = Math.min(...objs.map(o => o.top))
  objs.forEach(o => o.set('top', min))
  canvas.renderAll()
}

export function alignBottom(canvas) {
  const objs = getMultiSelectObjs(canvas)
  if (!objs.length) return
  const max = Math.max(...objs.map(o => o.top + o.height * (o.scaleY || 1)))
  objs.forEach(o => o.set('top', max - o.height * (o.scaleY || 1)))
  canvas.renderAll()
}

export function alignCenterV(canvas) {
  const objs = getMultiSelectObjs(canvas)
  if (!objs.length) return
  const avg = objs.reduce((s, o) => s + o.top + o.height * (o.scaleY || 1) / 2, 0) / objs.length
  objs.forEach(o => o.set('top', avg - o.height * (o.scaleY || 1) / 2))
  canvas.renderAll()
}

// 等宽/等高（svg-editor.html 独有功能，一并放入）
export function sameWidth(canvas) {
  const objs = getMultiSelectObjs(canvas)
  if (!objs.length) return
  const w = objs[0].width * (objs[0].scaleX || 1)
  objs.forEach(o => o.set('scaleX', w / o.width))
  canvas.renderAll()
}

export function sameHeight(canvas) {
  const objs = getMultiSelectObjs(canvas)
  if (!objs.length) return
  const h = objs[0].height * (objs[0].scaleY || 1)
  objs.forEach(o => o.set('scaleY', h / o.height))
  canvas.renderAll()
}
