/**
 * 层级控制插件 — 上移/下移/置顶/置底
 */

export function forward(canvas) {
  const a = canvas.getActiveObject()
  if (a) { canvas.bringForward(a); canvas.renderAll() }
}

export function backward(canvas) {
  const a = canvas.getActiveObject()
  if (a) { canvas.sendBackwards(a); canvas.renderAll() }
}

export function toFront(canvas) {
  const a = canvas.getActiveObject()
  if (a) { canvas.bringToFront(a); canvas.renderAll() }
}

export function toBack(canvas) {
  const a = canvas.getActiveObject()
  if (a) { canvas.sendToBack(a); canvas.renderAll() }
}
