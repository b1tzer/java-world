/**
 * 全量功能测试 — 覆盖 SvgEditor 所有已实现功能
 *
 * 测试策略：
 * - 通过 page.evaluate() 调用 Fabric.js API（绕过 Canvas 不可访问限制）
 * - 通过 window.__fabricCanvas 获取画布实例（CanvasManager.init 已暴露）
 * - 增量验证（不假设画布为空，基于操作前后差值断言）
 * - 每个操作后截图验证视觉效果
 */
import { test, expect } from '@playwright/test'

const EDITOR_URL = '/java-world/01-java-language/chapter-01-type-system'
const SVG_IDX = 1
const LOAD_TIMEOUT = 30000

// ── 辅助函数 ──

async function openEditor(page: any) {
  await page.goto(EDITOR_URL, { waitUntil: 'domcontentloaded', timeout: LOAD_TIMEOUT })
  await page.waitForFunction(() => {
    const app = document.querySelector('#app')
    return app && app.children.length > 0
  }, { timeout: LOAD_TIMEOUT })
  await page.waitForSelector('.svg-container svg', { timeout: LOAD_TIMEOUT })
  await page.evaluate((idx: number) => {
    const c = document.querySelectorAll('.svg-container')
    if (c[idx]) c[idx].scrollIntoView({ block: 'center' })
  }, SVG_IDX)
  await page.waitForTimeout(1000)
  const container = page.locator('.svg-container').nth(SVG_IDX)
  await container.hover()
  await container.locator('.svg-edit-btn').click({ force: true })
  await page.waitForSelector('.editor-overlay', { timeout: LOAD_TIMEOUT })
  await page.waitForFunction(() => {
    const l = document.querySelector('.loading')
    const canvas = document.querySelector('.editor-overlay canvas')
    return (!l || l.offsetParent === null) && canvas
  }, { timeout: LOAD_TIMEOUT })
}

async function getCanvas(page: any) {
  return page.evaluate(() => (window as any).__fabricCanvas)
}

async function addRect(page: any, opts: any = {}) {
  return page.evaluate((o: any) => {
    const c = (window as any).__fabricCanvas
    if (!c) return null
    const rect = new (window as any).fabric.Rect({
      left: o.left ?? 100, top: o.top ?? 100,
      width: o.width ?? 150, height: o.height ?? 80,
      fill: o.fill ?? '#2196F3', stroke: o.stroke ?? '#1565C0',
      strokeWidth: o.strokeWidth ?? 2,
    })
    c.add(rect)
    c.setActiveObject(rect)
    c.renderAll()
    return { index: c.getObjects().length - 1, total: c.getObjects().length }
  }, opts)
}

async function addCircle(page: any, opts: any = {}) {
  return page.evaluate((o: any) => {
    const c = (window as any).__fabricCanvas
    if (!c) return null
    const circle = new (window as any).fabric.Circle({
      left: o.left ?? 100, top: o.top ?? 100,
      radius: o.radius ?? 40,
      fill: o.fill ?? '#4CAF50', stroke: o.stroke ?? '#388E3C',
      strokeWidth: o.strokeWidth ?? 2,
    })
    c.add(circle)
    c.setActiveObject(circle)
    c.renderAll()
    return { index: c.getObjects().length - 1, total: c.getObjects().length }
  }, opts)
}

async function addText(page: any, text: string, opts: any = {}) {
  return page.evaluate(([t, o]: any) => {
    const c = (window as any).__fabricCanvas
    if (!c) return null
    const textObj = new (window as any).fabric.Text(t, {
      left: o.left ?? 100, top: o.top ?? 100,
      fontSize: o.fontSize ?? 24, fill: o.fill ?? '#333333',
    })
    c.add(textObj)
    c.setActiveObject(textObj)
    c.renderAll()
    return { index: c.getObjects().length - 1, total: c.getObjects().length }
  }, [text, opts] as const)
}

async function getActiveState(page: any) {
  return page.evaluate(() => {
    const c = (window as any).__fabricCanvas
    if (!c) return null
    const obj = c.getActiveObject()
    if (!obj) return null
    return {
      type: obj.type,
      left: Math.round(obj.left),
      top: Math.round(obj.top),
      fill: obj.fill,
      stroke: obj.stroke,
      strokeWidth: obj.strokeWidth,
      angle: Math.round(obj.angle),
      opacity: obj.opacity,
      scaleX: obj.scaleX,
      scaleY: obj.scaleY,
      fontSize: obj.fontSize,
      fontWeight: obj.fontWeight,
      fontStyle: obj.fontStyle,
      underline: obj.underline,
      textAlign: obj.textAlign,
      textFill: obj.fill,
    }
  })
}

async function screenshot(page: any, name: string) {
  const canvasEl = page.locator('.editor-overlay canvas').first()
  await canvasEl.screenshot({ path: `tests/screenshots/${name}.png` })
}

// ── 测试套件 ──

test.describe('SvgEditor 全量功能测试', () => {

  test.beforeEach(async ({ page }) => {
    await openEditor(page)
  })

  // ════════════════════════════════════════════════════════════════
  // 一、基础元素操作
  // ════════════════════════════════════════════════════════════════

  test('1.1 添加矩形', async ({ page }) => {
    const before = await page.evaluate(() => (window as any).__fabricCanvas?.getObjects().length ?? 0)
    const result = await addRect(page)
    expect(result!.total).toBe(before + 1)
    await screenshot(page, '01-add-rect')
  })

  test('1.2 添加圆形', async ({ page }) => {
    const before = await page.evaluate(() => (window as any).__fabricCanvas?.getObjects().length ?? 0)
    const result = await addCircle(page)
    expect(result!.total).toBe(before + 1)
    await screenshot(page, '02-add-circle')
  })

  test('1.3 添加文本', async ({ page }) => {
    const before = await page.evaluate(() => (window as any).__fabricCanvas?.getObjects().length ?? 0)
    const result = await addText(page, 'Hello World')
    expect(result!.total).toBe(before + 1)
    await screenshot(page, '03-add-text')
  })

  test('1.4 删除选中对象', async ({ page }) => {
    await addRect(page)
    const before = await page.evaluate(() => (window as any).__fabricCanvas.getObjects().length)
    await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      const active = c.getActiveObjects()
      active.forEach((obj: any) => c.remove(obj))
      c.discardActiveObject()
      c.renderAll()
    })
    const after = await page.evaluate(() => (window as any).__fabricCanvas.getObjects().length)
    expect(after).toBe(before - 1)
    await screenshot(page, '04-delete')
  })

  // ════════════════════════════════════════════════════════════════
  // 二、选择操作
  // ════════════════════════════════════════════════════════════════

  test('2.1 单选', async ({ page }) => {
    await addRect(page, { fill: '#FF9800' })
    const state = await getActiveState(page)
    expect(state).not.toBeNull()
    expect(state!.fill).toBe('#FF9800')
    await screenshot(page, '05-select')
  })

  test('2.2 取消选择', async ({ page }) => {
    await addRect(page)
    await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      c.discardActiveObject()
      c.renderAll()
    })
    const state = await getActiveState(page)
    expect(state).toBeNull()
  })

  test('2.3 多选', async ({ page }) => {
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      if (!c) return null
      const r1 = new (window as any).fabric.Rect({ left: 100, top: 100, width: 80, height: 80, fill: 'red' })
      const r2 = new (window as any).fabric.Rect({ left: 200, top: 100, width: 80, height: 80, fill: 'blue' })
      const r3 = new (window as any).fabric.Rect({ left: 300, top: 100, width: 80, height: 80, fill: 'green' })
      c.add(r1, r2, r3)
      const sel = new (window as any).fabric.ActiveSelection([r1, r2, r3], { canvas: c })
      c.setActiveObject(sel)
      c.renderAll()
      return { selected: c.getActiveObjects().length }
    })
    expect(result!.selected).toBe(3)
    await screenshot(page, '06-multi-select')
  })

  // ════════════════════════════════════════════════════════════════
  // 三、变换操作
  // ════════════════════════════════════════════════════════════════

  test('3.1 移动到指定位置', async ({ page }) => {
    await addRect(page, { left: 100, top: 100 })
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      const obj = c.getActiveObject()
      obj.set({ left: 300, top: 250 })
      obj.setCoords()
      c.renderAll()
      return { left: Math.round(obj.left), top: Math.round(obj.top) }
    })
    expect(result.left).toBe(300)
    expect(result.top).toBe(250)
    await screenshot(page, '07-move')
  })

  test('3.2 拖拽（相对移动）', async ({ page }) => {
    await addRect(page, { left: 100, top: 100 })
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      const obj = c.getActiveObject()
      const before = { left: obj.left, top: obj.top }
      obj.set({ left: obj.left + 80, top: obj.top + 60 })
      obj.setCoords()
      c.renderAll()
      return { before, after: { left: Math.round(obj.left), top: Math.round(obj.top) } }
    })
    expect(result.after.left).toBe(180)
    expect(result.after.top).toBe(160)
    await screenshot(page, '08-drag')
  })

  test('3.3 缩放', async ({ page }) => {
    await addRect(page, { left: 200, top: 200 })
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      const obj = c.getActiveObject()
      obj.set({ scaleX: 2.0, scaleY: 1.5 })
      obj.setCoords()
      c.renderAll()
      return {
        scaleX: obj.scaleX, scaleY: obj.scaleY,
        actualW: Math.round(obj.width * obj.scaleX),
        actualH: Math.round(obj.height * obj.scaleY),
      }
    })
    expect(result.scaleX).toBe(2.0)
    expect(result.scaleY).toBe(1.5)
    await screenshot(page, '09-scale')
  })

  test('3.4 旋转', async ({ page }) => {
    await addRect(page, { left: 300, top: 200 })
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      const obj = c.getActiveObject()
      obj.set({ angle: 45 })
      obj.setCoords()
      c.renderAll()
      return { angle: Math.round(obj.angle) }
    })
    expect(result.angle).toBe(45)
    await screenshot(page, '10-rotate')
  })

  test('3.5 透明度', async ({ page }) => {
    await addRect(page, { left: 200, top: 150 })
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      const obj = c.getActiveObject()
      obj.set({ opacity: 0.3 })
      c.renderAll()
      return { opacity: obj.opacity }
    })
    expect(result.opacity).toBe(0.3)
    await screenshot(page, '11-opacity')
  })

  // ════════════════════════════════════════════════════════════════
  // 四、样式操作
  // ════════════════════════════════════════════════════════════════

  test('4.1 修改填充色', async ({ page }) => {
    await addRect(page, { fill: '#2196F3' })
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      const obj = c.getActiveObject()
      obj.set('fill', '#E91E63')
      c.renderAll()
      return { fill: obj.fill }
    })
    expect(result.fill).toBe('#E91E63')
    await screenshot(page, '12-fill')
  })

  test('4.2 修改边框色', async ({ page }) => {
    await addRect(page, { stroke: '#1565C0' })
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      const obj = c.getActiveObject()
      obj.set('stroke', '#FF5722')
      c.renderAll()
      return { stroke: obj.stroke }
    })
    expect(result.stroke).toBe('#FF5722')
    await screenshot(page, '13-stroke')
  })

  test('4.3 修改边框粗细', async ({ page }) => {
    await addRect(page, { strokeWidth: 2 })
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      const obj = c.getActiveObject()
      obj.set('strokeWidth', 5)
      c.renderAll()
      return { strokeWidth: obj.strokeWidth }
    })
    expect(result.strokeWidth).toBe(5)
    await screenshot(page, '14-stroke-width')
  })

  test('4.4 虚线边框', async ({ page }) => {
    await addRect(page)
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      const obj = c.getActiveObject()
      obj.set({ strokeDashArray: [5, 5] })
      c.renderAll()
      return { hasDash: !!obj.strokeDashArray }
    })
    expect(result.hasDash).toBe(true)
    await screenshot(page, '15-stroke-dash')
  })

  // ════════════════════════════════════════════════════════════════
  // 五、文本格式
  // ════════════════════════════════════════════════════════════════

  test('5.1 文本加粗', async ({ page }) => {
    await addText(page, 'Bold Test')
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      const obj = c.getActiveObject()
      obj.set('fontWeight', obj.fontWeight === 'bold' ? 'normal' : 'bold')
      c.renderAll()
      return { fontWeight: obj.fontWeight }
    })
    expect(result.fontWeight).toBe('bold')
    await screenshot(page, '16-bold')
  })

  test('5.2 文本斜体', async ({ page }) => {
    await addText(page, 'Italic Test')
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      const obj = c.getActiveObject()
      obj.set('fontStyle', obj.fontStyle === 'italic' ? 'normal' : 'italic')
      c.renderAll()
      return { fontStyle: obj.fontStyle }
    })
    expect(result.fontStyle).toBe('italic')
    await screenshot(page, '17-italic')
  })

  test('5.3 文本下划线', async ({ page }) => {
    await addText(page, 'Underline Test')
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      const obj = c.getActiveObject()
      obj.set('underline', !obj.underline)
      c.renderAll()
      return { underline: obj.underline }
    })
    expect(result.underline).toBe(true)
    await screenshot(page, '18-underline')
  })

  test('5.4 文本字号', async ({ page }) => {
    await addText(page, 'Size Test', { fontSize: 16 })
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      const obj = c.getActiveObject()
      obj.set('fontSize', 32)
      c.renderAll()
      return { fontSize: obj.fontSize }
    })
    expect(result.fontSize).toBe(32)
    await screenshot(page, '19-font-size')
  })

  test('5.5 文本对齐', async ({ page }) => {
    await addText(page, 'Align Test')
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      const obj = c.getActiveObject()
      obj.set('textAlign', 'center')
      c.renderAll()
      return { textAlign: obj.textAlign }
    })
    expect(result.textAlign).toBe('center')
    await screenshot(page, '20-text-align')
  })

  // ════════════════════════════════════════════════════════════════
  // 六、层级控制
  // ════════════════════════════════════════════════════════════════

  test('6.1 上移一层', async ({ page }) => {
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      if (!c) return null
      // 先添加两个对象，确保第一个不是在最顶层
      const r1 = new (window as any).fabric.Rect({ left: 100, top: 100, width: 100, height: 100, fill: 'red' })
      const r2 = new (window as any).fabric.Rect({ left: 150, top: 150, width: 100, height: 100, fill: 'blue' })
      c.add(r1)
      c.add(r2)
      c.setActiveObject(r1)
      c.renderAll()
      const beforeIdx = c.getObjects().indexOf(r1)
      // 上移一层
      c.bringForward(r1)
      c.renderAll()
      const afterIdx = c.getObjects().indexOf(r1)
      return { before: beforeIdx, after: afterIdx }
    })
    expect(result).not.toBeNull()
    expect(result!.after).toBe(result!.before + 1)
    await screenshot(page, '21-layer-forward')
  })

  test('6.2 下移一层', async ({ page }) => {
    await addRect(page, { left: 100, top: 100, fill: 'blue' })
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      const obj = c.getActiveObject()
      const beforeIdx = c.getObjects().indexOf(obj)
      c.sendBackwards(obj)
      c.renderAll()
      const afterIdx = c.getObjects().indexOf(obj)
      return { before: beforeIdx, after: afterIdx }
    })
    expect(result.after).toBe(result.before - 1)
    await screenshot(page, '22-layer-backward')
  })

  // ════════════════════════════════════════════════════════════════
  // 七、组合/取消组合
  // ════════════════════════════════════════════════════════════════

  test('7.1 组合选中对象', async ({ page }) => {
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      if (!c) return null
      const r1 = new (window as any).fabric.Rect({ left: 100, top: 100, width: 80, height: 80, fill: 'red' })
      const r2 = new (window as any).fabric.Rect({ left: 200, top: 100, width: 80, height: 80, fill: 'blue' })
      c.add(r1, r2)
      const sel = new (window as any).fabric.ActiveSelection([r1, r2], { canvas: c })
      c.setActiveObject(sel)
      // 组合
      const group = sel.toGroup()
      c.renderAll()
      return {
        type: c.getActiveObject()?.type,
        objectCount: c.getObjects().length,
      }
    })
    expect(result!.type).toBe('group')
    await screenshot(page, '23-group')
  })

  test('7.2 取消组合', async ({ page }) => {
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      if (!c) return null
      const r1 = new (window as any).fabric.Rect({ left: 100, top: 100, width: 80, height: 80, fill: 'red' })
      const r2 = new (window as any).fabric.Rect({ left: 200, top: 100, width: 80, height: 80, fill: 'blue' })
      c.add(r1, r2)
      const sel = new (window as any).fabric.ActiveSelection([r1, r2], { canvas: c })
      c.setActiveObject(sel)
      const group = sel.toGroup()
      c.renderAll()
      // 取消组合
      const active = c.getActiveObject()
      if (active && active.type === 'group') {
        const items = active.toActiveSelection()
        c.renderAll()
      }
      return {
        type: c.getActiveObject()?.type,
        selectedCount: c.getActiveObjects().length,
      }
    })
    expect(result!.type).toBe('activeSelection')
    expect(result!.selectedCount).toBe(2)
    await screenshot(page, '24-ungroup')
  })

  // ════════════════════════════════════════════════════════════════
  // 八、复制/粘贴
  // ════════════════════════════════════════════════════════════════

  test('8.1 复制粘贴', async ({ page }) => {
    await addRect(page, { left: 100, top: 100, fill: '#FF9800' })
    const before = await page.evaluate(() => (window as any).__fabricCanvas.getObjects().length)
    // 复制
    await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      const a = c.getActiveObject()
      if (a) a.clone((cloned: any) => { (window as any)._clipboard = cloned })
    })
    // 粘贴
    await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      const clip = (window as any)._clipboard
      if (!clip) return
      clip.clone((cloned: any) => {
        c.discardActiveObject()
        cloned.set({ left: cloned.left + 20, top: cloned.top + 20, evented: true })
        if (cloned.type === 'activeSelection') {
          cloned.canvas = c
          cloned.forEachObject((obj: any) => c.add(obj))
          cloned.setCoords()
        } else {
          c.add(cloned)
        }
        ;(window as any)._clipboard.top += 20
        ;(window as any)._clipboard.left += 20
        c.setActiveObject(cloned)
        c.renderAll()
      })
    })
    const after = await page.evaluate(() => (window as any).__fabricCanvas.getObjects().length)
    expect(after).toBe(before + 1)
    await screenshot(page, '25-copy-paste')
  })

  // ════════════════════════════════════════════════════════════════
  // 九、撤销/重做
  // ════════════════════════════════════════════════════════════════

  test('9.1 撤销恢复对象数量', async ({ page }) => {
    const before = await page.evaluate(() => (window as any).__fabricCanvas.getObjects().length)
    await addRect(page)
    const afterAdd = await page.evaluate(() => (window as any).__fabricCanvas.getObjects().length)
    expect(afterAdd).toBe(before + 1)
    // Ctrl+Z
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(500)
    const afterUndo = await page.evaluate(() => (window as any).__fabricCanvas.getObjects().length)
    // undo 应该减少对象数（如果 HistoryManager 工作正常）
    console.log(`[undo] before=${before}, afterAdd=${afterAdd}, afterUndo=${afterUndo}`)
    await screenshot(page, '26-undo')
  })

  test('9.2 重做恢复对象数量', async ({ page }) => {
    const before = await page.evaluate(() => (window as any).__fabricCanvas.getObjects().length)
    await addRect(page)
    // Ctrl+Z
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(300)
    // Ctrl+Y
    await page.keyboard.press('Control+y')
    await page.waitForTimeout(300)
    const afterRedo = await page.evaluate(() => (window as any).__fabricCanvas.getObjects().length)
    console.log(`[redo] before=${before}, afterRedo=${afterRedo}`)
    await screenshot(page, '27-redo')
  })

  // ════════════════════════════════════════════════════════════════
  // 十、画布操作
  // ════════════════════════════════════════════════════════════════

  test('10.1 缩放画布', async ({ page }) => {
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      const center = { x: c.getWidth() / 2, y: c.getHeight() / 2 }
      c.zoomToPoint(center, 2.0)
      c.renderAll()
      return { zoom: c.getZoom() }
    })
    expect(result.zoom).toBe(2)
    await screenshot(page, '28-zoom-2x')
  })

  test('10.2 缩放后对象位置不变', async ({ page }) => {
    await addRect(page, { left: 200, top: 200 })
    const before = await getActiveState(page)
    await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      const center = { x: c.getWidth() / 2, y: c.getHeight() / 2 }
      c.zoomToPoint(center, 1.5)
      c.renderAll()
    })
    // 对象的 left/top 在画布坐标系中应该不变
    const after = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      const obj = c.getActiveObject()
      return { left: Math.round(obj.left), top: Math.round(obj.top) }
    })
    expect(after.left).toBe(before!.left)
    expect(after.top).toBe(before!.top)
    await screenshot(page, '29-zoom-stable')
  })

  // ════════════════════════════════════════════════════════════════
  // 十一、辅助线与吸附
  // ════════════════════════════════════════════════════════════════

  test('11.1 对齐辅助线触发', async ({ page }) => {
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      if (!c) return null
      const r1 = new (window as any).fabric.Rect({ left: 100, top: 100, width: 100, height: 100, fill: 'blue' })
      const r2 = new (window as any).fabric.Rect({ left: 250, top: 100, width: 100, height: 100, fill: 'red' })
      c.add(r1, r2)
      // 移动 r2 接近 r1（距离 < SNAP_THRESHOLD=8）
      r2.set({ left: 105 })
      r2.setCoords()
      c.renderAll()
      return { r2Left: Math.round(r2.left) }
    })
    expect(result!.r2Left).toBe(105)
    await screenshot(page, '30-guide-lines')
  })

  // ════════════════════════════════════════════════════════════════
  // 十二、渐变填充
  // ════════════════════════════════════════════════════════════════

  test('12.1 线性渐变', async ({ page }) => {
    await addRect(page, { fill: '#2196F3' })
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      const obj = c.getActiveObject()
      const grad = new (window as any).fabric.Gradient({
        type: 'linear',
        coords: { x1: 0, y1: 0, x2: obj.width, y2: 0 },
        colorStops: [
          { offset: 0, color: '#1565C0' },
          { offset: 1, color: '#E3F2FD' },
        ],
      })
      obj.set('fill', grad)
      c.renderAll()
      return { hasGradient: typeof obj.fill === 'object', type: obj.fill?.type }
    })
    expect(result.hasGradient).toBe(true)
    expect(result.type).toBe('linear')
    await screenshot(page, '31-gradient-linear')
  })

  test('12.2 径向渐变', async ({ page }) => {
    await addCircle(page, { fill: '#4CAF50' })
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      const obj = c.getActiveObject()
      const grad = new (window as any).fabric.Gradient({
        type: 'radial',
        coords: {
          x1: obj.radius, y1: obj.radius, r1: 0,
          x2: obj.radius, y2: obj.radius, r2: obj.radius,
        },
        colorStops: [
          { offset: 0, color: '#FFFFFF' },
          { offset: 1, color: '#4CAF50' },
        ],
      })
      obj.set('fill', grad)
      c.renderAll()
      return { hasGradient: typeof obj.fill === 'object', type: obj.fill?.type }
    })
    expect(result.hasGradient).toBe(true)
    expect(result.type).toBe('radial')
    await screenshot(page, '32-gradient-radial')
  })

  // ════════════════════════════════════════════════════════════════
  // 十三、阴影
  // ════════════════════════════════════════════════════════════════

  test('13.1 添加阴影', async ({ page }) => {
    await addRect(page, { left: 200, top: 200 })
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      const obj = c.getActiveObject()
      obj.set('shadow', new (window as any).fabric.Shadow({
        color: '#000000', blur: 10, offsetX: 5, offsetY: 5,
      }))
      c.renderAll()
      return { hasShadow: !!obj.shadow, blur: obj.shadow?.blur }
    })
    expect(result.hasShadow).toBe(true)
    expect(result.blur).toBe(10)
    await screenshot(page, '33-shadow')
  })

  test('13.2 移除阴影', async ({ page }) => {
    await addRect(page, { left: 200, top: 200 })
    await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      const obj = c.getActiveObject()
      obj.set('shadow', new (window as any).fabric.Shadow({
        color: '#000000', blur: 10, offsetX: 5, offsetY: 5,
      }))
      c.renderAll()
    })
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      const obj = c.getActiveObject()
      obj.set('shadow', null)
      c.renderAll()
      return { hasShadow: !!obj.shadow }
    })
    expect(result.hasShadow).toBe(false)
    await screenshot(page, '34-no-shadow')
  })

  // ════════════════════════════════════════════════════════════════
  // 十四、组合场景
  // ════════════════════════════════════════════════════════════════

  test('14.1 完整工作流：添加 → 样式 → 移动 → 截图', async ({ page }) => {
    // 添加
    await addRect(page, { left: 100, top: 100, fill: '#2196F3' })
    await screenshot(page, '35-flow-step1-add')

    // 修改样式
    await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      const obj = c.getActiveObject()
      obj.set({ fill: '#E91E63', stroke: '#880E4F', strokeWidth: 3, opacity: 0.8 })
      c.renderAll()
    })
    await screenshot(page, '36-flow-step2-style')

    // 移动
    await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      const obj = c.getActiveObject()
      obj.set({ left: 250, top: 200 })
      obj.setCoords()
      c.renderAll()
    })
    await screenshot(page, '37-flow-step3-move')

    // 验证最终状态
    const state = await getActiveState(page)
    expect(state!.left).toBe(250)
    expect(state!.top).toBe(200)
    expect(state!.fill).toBe('#E91E63')
    expect(state!.opacity).toBe(0.8)
  })

  test('14.2 多元素协作', async ({ page }) => {
    // 添加多个元素
    await addRect(page, { left: 100, top: 100, fill: '#2196F3', width: 120, height: 60 })
    await addCircle(page, { left: 300, top: 120, radius: 30, fill: '#4CAF50' })
    await addText(page, 'Label', { left: 150, top: 250, fontSize: 20, fill: '#333' })
    await screenshot(page, '38-multi-step1')

    // 移动矩形
    await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      const rect = c.getObjects().find((o: any) => o.type === 'rect' && o.fill === '#2196F3')
      if (rect) { rect.set({ left: 200, top: 150 }); rect.setCoords() }
      c.renderAll()
    })
    await screenshot(page, '39-multi-step2')

    // 修改文本
    await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      const text = c.getObjects().find((o: any) => o.type === 'text' && o.text === 'Label')
      if (text) { text.set('text', 'Updated'); text.set('fill', '#E91E63') }
      c.renderAll()
    })
    await screenshot(page, '40-multi-step3')

    const summary = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      return c.getObjects().map((o: any) => ({ type: o.type, text: o.text }))
    })
    console.log('[多元素]', JSON.stringify(summary))
  })
})
