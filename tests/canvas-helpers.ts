/**
 * Canvas 测试辅助函数
 * 通过 page.evaluate() 调用 Fabric.js API，绕过 Canvas 不可访问的限制
 */
import { Page } from '@playwright/test'

// ── 获取全局 canvas 实例 ──

/** 获取 Fabric.js canvas 实例（SvgEditor 挂载在 window.__fabricCanvas 上） */
export async function getCanvas(page: Page) {
  return page.evaluate(() => {
    const c = (window as any).__fabricCanvas
    if (!c) throw new Error('Canvas not found. Is the editor open?')
    return { objectCount: c.getObjects().length, width: c.getWidth(), height: c.getHeight() }
  })
}

// ── 添加元素 ──

export interface ShapeOptions {
  left?: number
  top?: number
  fill?: string
  stroke?: string
  strokeWidth?: number
  width?: number
  height?: number
  radius?: number
  text?: string
  fontSize?: number
  scaleX?: number
  scaleY?: number
  angle?: number
  opacity?: number
}

/** 添加矩形 */
export async function addRect(page: Page, opts: ShapeOptions = {}) {
  return page.evaluate((o) => {
    const c = (window as any).__fabricCanvas
    const rect = new (window as any).fabric.Rect({
      left: o.left ?? 100, top: o.top ?? 100,
      width: o.width ?? 200, height: o.height ?? 100,
      fill: o.fill ?? '#2196F3', stroke: o.stroke ?? '#1565C0',
      strokeWidth: o.strokeWidth ?? 2,
    })
    c.add(rect)
    c.setActiveObject(rect)
    c.renderAll()
    return c.getObjects().length - 1 // 返回 index
  }, opts)
}

/** 添加圆形 */
export async function addCircle(page: Page, opts: ShapeOptions = {}) {
  return page.evaluate((o) => {
    const c = (window as any).__fabricCanvas
    const circle = new (window as any).fabric.Circle({
      left: o.left ?? 100, top: o.top ?? 100,
      radius: o.radius ?? 50,
      fill: o.fill ?? '#4CAF50', stroke: o.stroke ?? '#388E3C',
      strokeWidth: o.strokeWidth ?? 2,
    })
    c.add(circle)
    c.setActiveObject(circle)
    c.renderAll()
    return c.getObjects().length - 1
  }, opts)
}

/** 添加文本 */
export async function addText(page: Page, text: string, opts: ShapeOptions = {}) {
  return page.evaluate(([t, o]) => {
    const c = (window as any).__fabricCanvas
    const textObj = new (window as any).fabric.Text(t, {
      left: o.left ?? 100, top: o.top ?? 100,
      fontSize: o.fontSize ?? 24, fill: o.fill ?? '#333333',
    })
    c.add(textObj)
    c.setActiveObject(textObj)
    c.renderAll()
    return c.getObjects().length - 1
  }, [text, opts] as const)
}

/** 添加直线 */
export async function addLine(page: Page, x1: number, y1: number, x2: number, y2: number, opts: ShapeOptions = {}) {
  return page.evaluate(([a, b, c2, d, o]) => {
    const c = (window as any).__fabricCanvas
    const line = new (window as any).fabric.Line([a, b, c2, d], {
      stroke: o.stroke ?? '#333333', strokeWidth: o.strokeWidth ?? 2,
    })
    c.add(line)
    c.renderAll()
    return c.getObjects().length - 1
  }, [x1, y1, x2, y2, opts] as const)
}

// ── 选择与操作 ──

/** 选中指定 index 的对象 */
export async function selectObject(page: Page, index: number) {
  return page.evaluate((idx) => {
    const c = (window as any).__fabricCanvas
    const obj = c.getObjects()[idx]
    if (!obj) throw new Error(`Object at index ${idx} not found`)
    c.setActiveObject(obj)
    c.renderAll()
    return true
  }, index)
}

/** 选中所有对象 */
export async function selectAll(page: Page) {
  return page.evaluate(() => {
    const c = (window as any).__fabricCanvas
    c.discardActiveObject()
    const sel = new (window as any).fabric.ActiveSelection(c.getObjects(), { canvas: c })
    c.setActiveObject(sel)
    c.renderAll()
    return c.getActiveObjects().length
  })
}

/** 取消选择 */
export async function deselectAll(page: Page) {
  return page.evaluate(() => {
    const c = (window as any).__fabricCanvas
    c.discardActiveObject()
    c.renderAll()
  })
}

/** 删除选中对象 */
export async function deleteSelected(page: Page) {
  return page.evaluate(() => {
    const c = (window as any).__fabricCanvas
    const active = c.getActiveObjects()
    active.forEach((obj: any) => c.remove(obj))
    c.discardActiveObject()
    c.renderAll()
    return c.getObjects().length
  })
}

// ── 移动与变换 ──

/** 移动指定对象 */
export async function moveObject(page: Page, index: number, left: number, top: number) {
  return page.evaluate(([idx, l, t]) => {
    const c = (window as any).__fabricCanvas
    const obj = c.getObjects()[idx]
    if (!obj) throw new Error(`Object at index ${idx} not found`)
    obj.set({ left: l, top: t })
    obj.setCoords()
    c.renderAll()
    return { left: obj.left, top: obj.top }
  }, [index, left, top] as const)
}

/** 拖拽对象（模拟从当前位置移动 dx, dy） */
export async function dragObject(page: Page, index: number, dx: number, dy: number) {
  return page.evaluate(([idx, ddx, ddy]) => {
    const c = (window as any).__fabricCanvas
    const obj = c.getObjects()[idx]
    if (!obj) throw new Error(`Object at index ${idx} not found`)
    obj.set({ left: obj.left + ddx, top: obj.top + ddy })
    obj.setCoords()
    c.renderAll()
    return { left: obj.left, top: obj.top }
  }, [index, dx, dy] as const)
}

/** 缩放对象 */
export async function scaleObject(page: Page, index: number, scaleX: number, scaleY: number) {
  return page.evaluate(([idx, sx, sy]) => {
    const c = (window as any).__fabricCanvas
    const obj = c.getObjects()[idx]
    if (!obj) throw new Error(`Object at index ${idx} not found`)
    obj.set({ scaleX: sx, scaleY: sy })
    obj.setCoords()
    c.renderAll()
    return { scaleX: obj.scaleX, scaleY: obj.scaleY }
  }, [index, scaleX, scaleY] as const)
}

/** 旋转对象 */
export async function rotateObject(page: Page, index: number, angle: number) {
  return page.evaluate(([idx, a]) => {
    const c = (window as any).__fabricCanvas
    const obj = c.getObjects()[idx]
    if (!obj) throw new Error(`Object at index ${idx} not found`)
    obj.set({ angle: a })
    obj.setCoords()
    c.renderAll()
    return obj.angle
  }, [index, angle] as const)
}

/** 设置对象透明度 */
export async function setObjectOpacity(page: Page, index: number, opacity: number) {
  return page.evaluate(([idx, o]) => {
    const c = (window as any).__fabricCanvas
    const obj = c.getObjects()[idx]
    if (!obj) throw new Error(`Object at index ${idx} not found`)
    obj.set({ opacity: o })
    c.renderAll()
    return obj.opacity
  }, [index, opacity] as const)
}

// ── 状态读取 ──

/** 获取指定对象的状态 */
export async function getObjectState(page: Page, index: number) {
  return page.evaluate((idx) => {
    const c = (window as any).__fabricCanvas
    const obj = c.getObjects()[idx]
    if (!obj) return null
    return {
      type: obj.type,
      left: Math.round(obj.left),
      top: Math.round(obj.top),
      width: Math.round(obj.width * (obj.scaleX ?? 1)),
      height: Math.round(obj.height * (obj.scaleY ?? 1)),
      fill: obj.fill,
      stroke: obj.stroke,
      strokeWidth: obj.strokeWidth,
      angle: Math.round(obj.angle),
      opacity: obj.opacity,
      scaleX: obj.scaleX,
      scaleY: obj.scaleY,
      visible: obj.visible,
      selectable: obj.selectable,
    }
  }, index)
}

/** 获取当前选中对象的状态 */
export async function getActiveObjectState(page: Page) {
  return page.evaluate(() => {
    const c = (window as any).__fabricCanvas
    const obj = c.getActiveObject()
    if (!obj) return null
    return {
      type: obj.type,
      left: Math.round(obj.left),
      top: Math.round(obj.top),
      width: Math.round(obj.width * (obj.scaleX ?? 1)),
      height: Math.round(obj.height * (obj.scaleY ?? 1)),
      fill: obj.fill,
      stroke: obj.stroke,
      angle: Math.round(obj.angle),
      opacity: obj.opacity,
    }
  })
}

/** 获取画布上所有对象的摘要 */
export async function getCanvasSummary(page: Page) {
  return page.evaluate(() => {
    const c = (window as any).__fabricCanvas
    return {
      objectCount: c.getObjects().length,
      objects: c.getObjects().map((obj: any, i: number) => ({
        index: i,
        type: obj.type,
        left: Math.round(obj.left),
        top: Math.round(obj.top),
      })),
      hasActiveObject: !!c.getActiveObject(),
      zoom: c.getZoom(),
    }
  })
}

// ── 画布操作 ──

/** 清空画布 */
export async function clearCanvas(page: Page) {
  return page.evaluate(() => {
    const c = (window as any).__fabricCanvas
    c.clear()
    c.renderAll()
    return c.getObjects().length
  })
}

/** 获取画布缩放比 */
export async function getZoom(page: Page) {
  return page.evaluate(() => {
    const c = (window as any).__fabricCanvas
    return c.getZoom()
  })
}

/** 缩放画布 */
export async function setZoom(page: Page, zoom: number) {
  return page.evaluate((z) => {
    const c = (window as any).__fabricCanvas
    const center = { x: c.getWidth() / 2, y: c.getHeight() / 2 }
    c.zoomToPoint(center, z)
    c.renderAll()
    return c.getZoom()
  }, zoom)
}

// ── undo/redo ──

/** 触发撤销 */
export async function undo(page: Page) {
  return page.evaluate(() => {
    const c = (window as any).__fabricCanvas
    // 尝试调用 HistoryManager 的 undo
    const historyMgr = (window as any).__historyMgr
    if (historyMgr && historyMgr.undo) {
      historyMgr.undo()
      c.renderAll()
      return c.getObjects().length
    }
    // fallback: Ctrl+Z
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))
    return c.getObjects().length
  })
}

/** 触发重做 */
export async function redo(page: Page) {
  return page.evaluate(() => {
    const c = (window as any).__fabricCanvas
    const historyMgr = (window as any).__historyMgr
    if (historyMgr && historyMgr.redo) {
      historyMgr.redo()
      c.renderAll()
      return c.getObjects().length
    }
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true }))
    return c.getObjects().length
  })
}

// ── 截图 ──

/** 截取画布区域 */
export async function screenshotCanvas(page: Page, name: string) {
  const canvasEl = page.locator('canvas').first()
  await canvasEl.screenshot({ path: `tests/screenshots/${name}.png` })
}

// ── 组合操作 ──

/** 添加多个测试元素 */
export async function addTestShapes(page: Page) {
  const rectIdx = await addRect(page, { left: 100, top: 100, fill: '#2196F3', width: 150, height: 80 })
  const circleIdx = await addCircle(page, { left: 300, top: 100, fill: '#4CAF50', radius: 40 })
  const textIdx = await addText(page, 'Hello', { left: 100, top: 250, fontSize: 32, fill: '#333' })
  return { rectIdx, circleIdx, textIdx }
}

/** 验证画布状态 */
export async function expectCanvasToHave(page: Page, count: number) {
  const summary = await getCanvasSummary(page)
  if (summary.objectCount !== count) {
    throw new Error(`Expected ${count} objects, got ${summary.objectCount}`)
  }
  return true
}
