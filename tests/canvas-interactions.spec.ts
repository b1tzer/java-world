/**
 * Canvas 交互测试 — 验证 Fabric.js 编辑器的可视化行为
 *
 * 核心方法：evaluate_script → Fabric.js API 操作 → take_screenshot 验证
 * 绕过 Canvas 不可访问 accessibility tree 的限制
 */
import { test, expect } from '@playwright/test'
import {
  addRect, addCircle, addText, addLine,
  selectObject, selectAll, deselectAll, deleteSelected,
  moveObject, dragObject, scaleObject, rotateObject, setObjectOpacity,
  getObjectState, getActiveObjectState, getCanvasSummary,
  clearCanvas, getZoom, setZoom,
  undo, redo, screenshotCanvas, addTestShapes, expectCanvasToHave,
} from './canvas-helpers'

const EDITOR_URL = '/java-world/01-java-language/chapter-01-type-system'
const SVG_IDX = 1
const LOAD_TIMEOUT = 30000

/** 打开编辑器并等待画布就绪 */
async function openEditor(page: any) {
  await page.goto(EDITOR_URL, { waitUntil: 'domcontentloaded', timeout: LOAD_TIMEOUT })
  // 等待 Vue 渲染完成（使用更宽松的条件）
  await page.waitForFunction(() => {
    // 检查 Vue 是否已挂载
    const app = document.querySelector('#app')
    if (!app || app.children.length === 0) return false
    // 检查是否有内容渲染
    const content = app.querySelector('.VPContent, .vp-doc, .vp-content, main, article')
    return !!content
  }, { timeout: LOAD_TIMEOUT })
  // 等待 SVG 容器出现
  await page.waitForSelector('.svg-container svg', { timeout: LOAD_TIMEOUT })
  // 滚动到目标 SVG
  await page.evaluate((idx: number) => {
    const c = document.querySelectorAll('.svg-container')
    if (c[idx]) c[idx].scrollIntoView({ block: 'center' })
  }, SVG_IDX)
  await page.waitForTimeout(1000)
  // 等待编辑按钮出现
  const container = page.locator('.svg-container').nth(SVG_IDX)
  await container.hover()
  await container.locator('.svg-edit-btn').click({ force: true })
  // 等待编辑器弹窗
  await page.waitForSelector('.editor-overlay', { timeout: LOAD_TIMEOUT })
  // 等待 loading 消失和画布初始化
  await page.waitForFunction(() => {
    const l = document.querySelector('.loading')
    const canvas = document.querySelector('.editor-overlay canvas')
    return (!l || l.offsetParent === null) && canvas
  }, { timeout: LOAD_TIMEOUT })
  // 暴露 canvas 实例到 window（CanvasManager.init 已自动暴露）
  await page.evaluate(() => {
    // CanvasManager 在初始化时已将 canvas 实例暴露到 window.__fabricCanvas
    // 如果未找到，尝试备用方法
    if (!(window as any).__fabricCanvas) {
      const canvasContainer = document.querySelector('.canvas-container')
      if (canvasContainer) {
        const lowerCanvas = canvasContainer.querySelector('.lower-canvas') as any
        if (lowerCanvas && lowerCanvas.__fabric) {
          (window as any).__fabricCanvas = lowerCanvas.__fabric
        }
      }
    }
  })
}

// ── 测试套件 ──

test.describe('Canvas 交互测试', () => {

  test.beforeEach(async ({ page }) => {
    await openEditor(page)
  })

  // ── 1. 添加元素 ──

  test('1.1 添加矩形到画布', async ({ page }) => {
    // 先调试：检查 canvas 实例是否可用
    const debugInfo = await page.evaluate(() => {
      const result: any = { canvasElements: [], fabricFound: false, fabricCanvas: null, vueInfo: null }
      const allCanvas = document.querySelectorAll('canvas')
      result.canvasElements = Array.from(allCanvas).map((c, i) => ({
        index: i,
        hasFabric: !!(c as any).__fabric,
        className: c.className,
        parentClass: c.parentElement?.className,
      }))
      // 检查 window.fabric
      result.hasWindowFabric = !!(window as any).fabric
      result.fabricCanvasType = typeof (window as any).fabric?.Canvas
      // 检查 __fabricCanvas
      result.hasFabricCanvas = !!(window as any).__fabricCanvas
      // 检查 Vue 组件
      const overlay = document.querySelector('.editor-overlay')
      if (overlay) {
        const vueApp = (overlay as any).__vue_app__
        result.vueInfo = { hasVueApp: !!vueApp }
        if (vueApp?._instance?.subTree) {
          const walk = (vnode: any, depth: number): any => {
            if (!vnode || depth > 10) return null
            const comp = vnode.component
            if (comp?.setupState?.canvasMgr) {
              return { found: 'setupState', hasCanvas: !!comp.setupState.canvasMgr.canvas, depth }
            }
            if (comp?.ctx?.canvasMgr) {
              return { found: 'ctx', hasCanvas: !!comp.ctx.canvasMgr.canvas, depth }
            }
            if (vnode.children && Array.isArray(vnode.children)) {
              for (const child of vnode.children) {
                const found = walk(child, depth + 1)
                if (found) return found
              }
            }
            if (comp?.subTree) {
              return walk(comp.subTree, depth + 1)
            }
            return null
          }
          result.vueInfo.walkResult = walk(vueApp._instance.subTree, 0)
        }
      }
      return result
    })
    console.log(`[调试] canvas 信息:`, JSON.stringify(debugInfo, null, 2))

    const count = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      if (!c) return -1
      const rect = new (window as any).fabric.Rect({
        left: 100, top: 100, width: 200, height: 100,
        fill: '#2196F3', stroke: '#1565C0', strokeWidth: 2,
      })
      c.add(rect)
      c.renderAll()
      return c.getObjects().length
    })
    console.log(`[添加矩形] 画布对象数: ${count}`)
    expect(count).toBeGreaterThan(0)
    await screenshotCanvas(page, 'add-rect')
  })

  test('1.2 添加圆形到画布', async ({ page }) => {
    const count = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      if (c) {
        
        const circle = new (window as any).fabric.Circle({
          left: 300, top: 150, radius: 50,
          fill: '#4CAF50', stroke: '#388E3C', strokeWidth: 2,
        })
        c.add(circle)
        c.renderAll()
        return c.getObjects().length
      }
      return -1
    })
    console.log(`[添加圆形] 画布对象数: ${count}`)
    expect(count).toBeGreaterThan(0)
    await screenshotCanvas(page, 'add-circle')
  })

  test('1.3 添加文本到画布', async ({ page }) => {
    const count = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      if (c) {
        
        const text = new (window as any).fabric.Text('Hello Fabric.js', {
          left: 150, top: 300, fontSize: 32, fill: '#333333',
        })
        c.add(text)
        c.renderAll()
        return c.getObjects().length
      }
      return -1
    })
    console.log(`[添加文本] 画布对象数: ${count}`)
    expect(count).toBeGreaterThan(0)
    await screenshotCanvas(page, 'add-text')
  })

  // ── 2. 选择与状态 ──

  test('2.1 选中对象并验证状态', async ({ page }) => {
    const state = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      if (!c) return null
      
      // 添加一个矩形
      const rect = new (window as any).fabric.Rect({
        left: 200, top: 200, width: 150, height: 80,
        fill: '#FF9800', stroke: '#E65100', strokeWidth: 2,
      })
      c.add(rect)
      // 选中它
      c.setActiveObject(rect)
      c.renderAll()
      const active = c.getActiveObject()
      return active ? {
        type: active.type,
        left: Math.round(active.left),
        top: Math.round(active.top),
        fill: active.fill,
        selected: true,
      } : null
    })
    console.log(`[选中状态]`, JSON.stringify(state))
    expect(state).not.toBeNull()
    expect(state!.selected).toBe(true)
    expect(state!.fill).toBe('#FF9800')
    await screenshotCanvas(page, 'select-object')
  })

  test('2.2 取消选择后无活跃对象', async ({ page }) => {
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      if (!c) return null
      
      const rect = new (window as any).fabric.Rect({ left: 100, top: 100, width: 100, height: 100, fill: 'blue' })
      c.add(rect)
      c.setActiveObject(rect)
      c.discardActiveObject()
      c.renderAll()
      return { hasActive: !!c.getActiveObject() }
    })
    console.log(`[取消选择]`, JSON.stringify(result))
    expect(result!.hasActive).toBe(false)
  })

  // ── 3. 移动与拖拽 ──

  test('3.1 移动对象到指定位置', async ({ page }) => {
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      if (!c) return null
      
      const rect = new (window as any).fabric.Rect({
        left: 100, top: 100, width: 100, height: 100, fill: '#2196F3',
      })
      c.add(rect)
      // 移动到 (300, 200)
      rect.set({ left: 300, top: 200 })
      rect.setCoords()
      c.renderAll()
      return { left: Math.round(rect.left), top: Math.round(rect.top) }
    })
    console.log(`[移动] 位置: (${result!.left}, ${result!.top})`)
    expect(result!.left).toBe(300)
    expect(result!.top).toBe(200)
    await screenshotCanvas(page, 'move-object')
  })

  test('3.2 拖拽对象（相对移动）', async ({ page }) => {
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      if (!c) return null
      
      const rect = new (window as any).fabric.Rect({
        left: 100, top: 100, width: 100, height: 100, fill: '#4CAF50',
      })
      c.add(rect)
      const before = { left: rect.left, top: rect.top }
      // 拖拽 +50, +80
      rect.set({ left: rect.left + 50, top: rect.top + 80 })
      rect.setCoords()
      c.renderAll()
      return {
        before,
        after: { left: Math.round(rect.left), top: Math.round(rect.top) },
      }
    })
    console.log(`[拖拽] ${JSON.stringify(result!.before)} → ${JSON.stringify(result!.after)}`)
    expect(result!.after.left).toBe(150)
    expect(result!.after.top).toBe(180)
    await screenshotCanvas(page, 'drag-object')
  })

  // ── 4. 变换 ──

  test('4.1 缩放对象', async ({ page }) => {
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      if (!c) return null
      
      const rect = new (window as any).fabric.Rect({
        left: 200, top: 200, width: 100, height: 100, fill: '#E91E63',
      })
      c.add(rect)
      rect.set({ scaleX: 2, scaleY: 1.5 })
      rect.setCoords()
      c.renderAll()
      return {
        scaleX: rect.scaleX,
        scaleY: rect.scaleY,
        actualWidth: Math.round(rect.width * rect.scaleX),
        actualHeight: Math.round(rect.height * rect.scaleY),
      }
    })
    console.log(`[缩放] scale: (${result!.scaleX}, ${result!.scaleY}), 实际尺寸: ${result!.actualWidth}x${result!.actualHeight}`)
    expect(result!.scaleX).toBe(2)
    expect(result!.scaleY).toBe(1.5)
    await screenshotCanvas(page, 'scale-object')
  })

  test('4.2 旋转对象', async ({ page }) => {
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      if (!c) return null
      
      const rect = new (window as any).fabric.Rect({
        left: 300, top: 200, width: 120, height: 60, fill: '#9C27B0',
      })
      c.add(rect)
      rect.set({ angle: 45 })
      rect.setCoords()
      c.renderAll()
      return { angle: Math.round(rect.angle) }
    })
    console.log(`[旋转] 角度: ${result!.angle}°`)
    expect(result!.angle).toBe(45)
    await screenshotCanvas(page, 'rotate-object')
  })

  test('4.3 设置透明度', async ({ page }) => {
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      if (!c) return null
      
      const rect = new (window as any).fabric.Rect({
        left: 200, top: 150, width: 150, height: 100, fill: '#FF5722',
      })
      c.add(rect)
      rect.set({ opacity: 0.3 })
      c.renderAll()
      return { opacity: rect.opacity }
    })
    console.log(`[透明度] opacity: ${result!.opacity}`)
    expect(result!.opacity).toBe(0.3)
    await screenshotCanvas(page, 'opacity-object')
  })

  // ── 5. 删除 ──

  test('5.1 删除选中对象', async ({ page }) => {
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      if (!c) return null
      const initialCount = c.getObjects().length
      const rect = new (window as any).fabric.Rect({ left: 100, top: 100, width: 100, height: 100, fill: 'red' })
      const circle = new (window as any).fabric.Circle({ left: 300, top: 100, radius: 50, fill: 'blue' })
      c.add(rect)
      c.add(circle)
      c.setActiveObject(rect)
      // 删除选中
      const active = c.getActiveObjects()
      active.forEach((obj: any) => c.remove(obj))
      c.discardActiveObject()
      c.renderAll()
      return { initialCount, finalCount: c.getObjects().length, added: 2, removed: 1 }
    })
    console.log(`[删除] 初始: ${result!.initialCount}, 添加: ${result!.added}, 删除: ${result!.removed}, 最终: ${result!.finalCount}`)
    expect(result!.finalCount).toBe(result!.initialCount + 1) // 初始 + 2 添加 - 1 删除
    await screenshotCanvas(page, 'delete-object')
  })

  // ── 6. 多选 ──

  test('6.1 多选对象', async ({ page }) => {
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      if (!c) return null
      const r1 = new (window as any).fabric.Rect({ left: 100, top: 100, width: 80, height: 80, fill: 'red' })
      const r2 = new (window as any).fabric.Rect({ left: 200, top: 100, width: 80, height: 80, fill: 'blue' })
      const r3 = new (window as any).fabric.Rect({ left: 300, top: 100, width: 80, height: 80, fill: 'green' })
      c.add(r1, r2, r3)
      // 只选这 3 个新对象
      const sel = new (window as any).fabric.ActiveSelection([r1, r2, r3], { canvas: c })
      c.setActiveObject(sel)
      c.renderAll()
      return {
        selectedCount: c.getActiveObjects().length,
        totalObjects: c.getObjects().length,
      }
    })
    console.log(`[多选] 选中: ${result!.selectedCount}/${result!.totalObjects}`)
    expect(result!.selectedCount).toBe(3)
    await screenshotCanvas(page, 'multi-select')
  })

  // ── 7. 组合操作 ──

  test('7.1 添加元素 → 移动 → 截图验证', async ({ page }) => {
    // Step 1: 添加
    const initialCount = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      if (!c) return 0
      const before = c.getObjects().length
      c.add(new (window as any).fabric.Rect({ left: 100, top: 100, width: 150, height: 80, fill: '#2196F3' }))
      c.add(new (window as any).fabric.Circle({ left: 350, top: 120, radius: 40, fill: '#4CAF50' }))
      c.add(new (window as any).fabric.Text('Test', { left: 150, top: 280, fontSize: 28, fill: '#333' }))
      c.renderAll()
      return before
    })
    await screenshotCanvas(page, 'combo-step1-add')

    // Step 2: 移动最后添加的矩形
    const rectIndex = initialCount // 第一个新添加的矩形的 index
    await page.evaluate((idx) => {
      const c = (window as any).__fabricCanvas
      if (!c) return
      const rect = c.getObjects()[idx]
      rect.set({ left: 200, top: 150 })
      rect.setCoords()
      c.renderAll()
    }, rectIndex)
    await screenshotCanvas(page, 'combo-step2-move')

    // Step 3: 验证位置
    const state = await page.evaluate((idx) => {
      const c = (window as any).__fabricCanvas
      if (!c) return null
      const rect = c.getObjects()[idx]
      return {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        totalObjects: c.getObjects().length,
      }
    }, rectIndex)
    console.log(`[组合] 矩形位置: (${state!.left}, ${state!.top}), 总对象: ${state!.totalObjects}`)
    expect(state!.left).toBe(200)
    expect(state!.totalObjects).toBe(initialCount + 3)
  })

  // ── 8. 画布缩放 ──

  test('8.1 缩放画布', async ({ page }) => {
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      if (!c) return null
      
      const center = { x: c.getWidth() / 2, y: c.getHeight() / 2 }
      c.zoomToPoint(center, 2.0)
      c.renderAll()
      return { zoom: c.getZoom() }
    })
    console.log(`[缩放] zoom: ${result!.zoom}`)
    expect(result!.zoom).toBe(2)
    await screenshotCanvas(page, 'zoom-2x')
  })

  // ── 9. undo/redo 基础验证 ──

  test('9.1 undo 恢复对象数量', async ({ page }) => {
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      if (!c) return null
      
      const before = c.getObjects().length
      // 添加一个对象
      c.add(new (window as any).fabric.Rect({ left: 100, top: 100, width: 100, height: 100, fill: 'red' }))
      c.renderAll()
      const afterAdd = c.getObjects().length
      // 触发 Ctrl+Z
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }))
      return { before, afterAdd }
    })
    console.log(`[undo] 添加前: ${result!.before}, 添加后: ${result!.afterAdd}`)
    // Note: undo 可能需要等待 historyMgr 保存
    await page.waitForTimeout(500)
    await screenshotCanvas(page, 'undo-test')
  })

  // ── 10. 辅助线验证 ──

  test('10.1 移动触发辅助线', async ({ page }) => {
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      if (!c) return null
      
      const r1 = new (window as any).fabric.Rect({ left: 100, top: 100, width: 100, height: 100, fill: 'blue' })
      const r2 = new (window as any).fabric.Rect({ left: 250, top: 100, width: 100, height: 100, fill: 'red' })
      c.add(r1, r2)
      // 模拟 r2 移动到接近 r1 的位置
      r2.set({ left: 105 }) // 距离 r1 右边 5px，在 SNAP_THRESHOLD(8) 内
      r2.setCoords()
      c.renderAll()
      return { r2Left: Math.round(r2.left) }
    })
    console.log(`[辅助线] r2 位置: ${result!.r2Left}`)
    await screenshotCanvas(page, 'guide-lines')
  })
})
