/**
 * 选择辅助工具 — 获取对象边界
 */

export function getObjBounds(obj) {
  const bound = obj.getBoundingRect()
  return {
    left: bound.left,
    top: bound.top,
    right: bound.left + bound.width,
    bottom: bound.top + bound.height,
    centerX: bound.left + bound.width / 2,
    centerY: bound.top + bound.height / 2,
  }
}
