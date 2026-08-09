/**
 * 文字格式插件 — 字号/B/I/U/对齐/颜色
 * 支持单选 Textbox 和多选文字批量操作
 */

export function getTextObjects(canvas) {
  const a = canvas.getActiveObject()
  if (!a) return []
  if (a.type === 'textbox' || a.type === 'i-text') return [a]
  if (a.type === 'activeSelection' || a.type === 'group') {
    return (a._objects || []).filter(o => o.type === 'textbox' || o.type === 'i-text')
  }
  return []
}

export function applyFontSize(canvas, size) {
  const texts = getTextObjects(canvas)
  texts.forEach(t => t.set('fontSize', size))
  canvas.renderAll()
}

export function toggleBold(canvas) {
  const texts = getTextObjects(canvas)
  if (!texts.length) return
  const next = texts[0].fontWeight === 'bold' ? 'normal' : 'bold'
  texts.forEach(t => t.set('fontWeight', next))
  canvas.renderAll()
  return next
}

export function toggleItalic(canvas) {
  const texts = getTextObjects(canvas)
  if (!texts.length) return
  const next = texts[0].fontStyle === 'italic' ? 'normal' : 'italic'
  texts.forEach(t => t.set('fontStyle', next))
  canvas.renderAll()
  return next
}

export function toggleUnderline(canvas) {
  const texts = getTextObjects(canvas)
  if (!texts.length) return
  const next = !texts[0].underline
  texts.forEach(t => t.set('underline', next))
  canvas.renderAll()
  return next
}

export function applyTextAlign(canvas, align) {
  const texts = getTextObjects(canvas)
  texts.forEach(t => t.set('textAlign', align))
  canvas.renderAll()
  return align
}

export function applyTextFill(canvas, hex) {
  const texts = getTextObjects(canvas)
  texts.forEach(t => t.set('fill', hex))
  canvas.renderAll()
  return hex
}
