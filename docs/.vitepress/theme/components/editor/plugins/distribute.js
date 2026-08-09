/**
 * 等间距分布插件 — 水平/垂直
 */

function getMultiSelectObjs(canvas) {
  const sel = canvas.getActiveObject()
  if (!sel || !sel._objects || sel._objects.length < 3) return []
  return sel._objects
}

export function distributeHorizontal(canvas) {
  const objs = getMultiSelectObjs(canvas)
  if (!objs.length) return
  objs.sort((a, b) => a.left - b.left)
  const first = objs[0].left
  const lastObj = objs[objs.length - 1]
  const last = lastObj.left + lastObj.width * (lastObj.scaleX || 1)
  const totalWidth = objs.reduce((s, o) => s + o.width * (o.scaleX || 1), 0)
  const gap = (last - first - totalWidth) / (objs.length - 1)
  let x = first
  for (const o of objs) {
    o.set('left', x)
    x += o.width * (o.scaleX || 1) + gap
  }
  canvas.renderAll()
}

export function distributeVertical(canvas) {
  const objs = getMultiSelectObjs(canvas)
  if (!objs.length) return
  objs.sort((a, b) => a.top - b.top)
  const first = objs[0].top
  const lastObj = objs[objs.length - 1]
  const last = lastObj.top + lastObj.height * (lastObj.scaleY || 1)
  const totalHeight = objs.reduce((s, o) => s + o.height * (o.scaleY || 1), 0)
  const gap = (last - first - totalHeight) / (objs.length - 1)
  let y = first
  for (const o of objs) {
    o.set('top', y)
    y += o.height * (o.scaleY || 1) + gap
  }
  canvas.renderAll()
}
