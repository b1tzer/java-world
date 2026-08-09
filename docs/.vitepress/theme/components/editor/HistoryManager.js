/**
 * 历史管理器 — 撤销/重做栈
 *
 * 职责：
 *   - 保存/恢复画布状态（基于 toJSON）
 *   - 撤销（undo）/ 重做（redo）
 *   - 限制栈深度防止内存溢出
 */

const MAX_STACK = 30

export class HistoryManager {
  constructor() {
    this._undoStack = []
    this._redoStack = []
    this._onStateChange = null // 外部回调
  }

  /**
   * 保存当前画布状态
   * @param {fabric.Canvas} canvas
   * @param {Function} beforeSave - 保存前回调（用于移除背景等）
   * @param {Function} afterSave - 保存后回调（用于恢复背景等）
   */
  save(canvas, beforeSave, afterSave) {
    if (!canvas) return
    if (beforeSave) beforeSave()
    this._undoStack.push(canvas.toJSON(['selectable', 'evented']))
    if (this._undoStack.length > MAX_STACK) this._undoStack.shift()
    this._redoStack = []
    if (afterSave) afterSave()
    this._notify()
  }

  /**
   * 撤销
   * @param {fabric.Canvas} canvas
   * @param {Function} afterLoad - loadFromJSON 完成后的回调
   */
  undo(canvas, afterLoad) {
    if (!canvas || this._undoStack.length < 2) return
    this._redoStack.push(this._undoStack.pop())
    const state = this._undoStack[this._undoStack.length - 1]
    canvas.loadFromJSON(state, () => {
      if (afterLoad) afterLoad()
      canvas.renderAll()
    })
    this._notify()
  }

  /**
   * 重做
   * @param {fabric.Canvas} canvas
   * @param {Function} afterLoad
   */
  redo(canvas, afterLoad) {
    if (!canvas || !this._redoStack.length) return
    const state = this._redoStack.pop()
    this._undoStack.push(state)
    canvas.loadFromJSON(state, () => {
      if (afterLoad) afterLoad()
      canvas.renderAll()
    })
    this._notify()
  }

  canUndo() { return this._undoStack.length >= 2 }
  canRedo() { return this._redoStack.length > 0 }

  onStateChange(fn) { this._onStateChange = fn }
  _notify() { if (this._onStateChange) this._onStateChange() }

  reset() {
    this._undoStack = []
    this._redoStack = []
  }
}
