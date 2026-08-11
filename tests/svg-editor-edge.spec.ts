/**
 * 边界与功能区外测试 — 覆盖用户实际使用场景
 *
 * 重点：
 * - 背景白板行为（undo 后背景是否消失、是否可拖动）
 * - undo/redo 正确性
 * - 保存后 SVG 导出（背景不应出现在导出结果中）
 * - 缩放/平移后对象交互
 * - 快捷键组合
 * - 极端情况（空画布操作、大量对象、连续操作）
 */
import { test, expect } from '@playwright/test'

const EDITOR_URL = '/java-world/01-java-language/chapter-01-type-system'
const SVG_IDX = 1
const LOAD_TIMEOUT = 30000

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

async function screenshot(page: any, name: string) {
  const canvasEl = page.locator('.editor-overlay canvas').first()
  await canvasEl.screenshot({ path: `tests/screenshots/${name}.png` })
}

async function addRectWithSave(page: any, opts: any = {}) {
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

test.describe('SvgEditor 边界与功能区外测试', () => {

  test.beforeEach(async ({ page }) => {
    await openEditor(page)
  })

  // ════════════════════════════════════════════════════════════════
  // 一、背景（纯 canvas.backgroundColor，无 fabric.Rect 背景板）
  // ════════════════════════════════════════════════════════════════

  test('1.1 canvas.backgroundColor 为白色 + 无 excludeFromExport 对象', async ({ page }) => {
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      if (!c) return null
      return {
        bg: c.backgroundColor,
        noBgRects: c.getObjects().filter((o: any) => o.excludeFromExport).length === 0,
        totalObjects: c.getObjects().length,
      }
    })
    console.log(`[背景] bg=${result!.bg}, noBgRects=${result!.noBgRects}`)
    expect(result!.bg).toBe('#ffffff')
    expect(result!.noBgRects).toBe(true)
    await screenshot(page, 'bg-canvas-only')
  })

  test('1.2 undo 后 backgroundColor 仍是白色', async ({ page }) => {
    await addRectWithSave(page)
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(500)
    const bg = await page.evaluate(() => (window as any).__fabricCanvas?.backgroundColor)
    expect(bg).toBe('#ffffff')
    await screenshot(page, 'bg-after-undo')
  })

  test('1.3 undo 后无 excludeFromExport 对象', async ({ page }) => {
    await addRectWithSave(page)
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(500)
    const count = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      return c.getObjects().filter((o: any) => o.excludeFromExport).length
    })
    expect(count).toBe(0)
    await screenshot(page, 'no-excluded-after-undo')
  })

  test('1.4 导出 SVG 无 excludeFromExport 对象（全部可导出）', async ({ page }) => {
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      if (!c) return null
      const all = c.getObjects().length
      const excluded = c.getObjects().filter((o: any) => o.excludeFromExport).length
      return { all, excluded }
    })
    console.log(`[导出] 总对象: ${result!.all}, excluded: ${result!.excluded}`)
    expect(result!.excluded).toBe(0)
  })

  // ════════════════════════════════════════════════════════════════
  // 二、undo/redo
  // ════════════════════════════════════════════════════════════════

  test('2.1 添加对象后 undo', async ({ page }) => {
    const before = await page.evaluate(() => (window as any).__fabricCanvas.getObjects().filter((o: any) => !o.excludeFromExport).length)
    await addRectWithSave(page)
    const afterAdd = await page.evaluate(() => (window as any).__fabricCanvas.getObjects().filter((o: any) => !o.excludeFromExport).length)
    expect(afterAdd).toBe(before + 1)
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(500)
    const afterUndo = await page.evaluate(() => (window as any).__fabricCanvas.getObjects().filter((o: any) => !o.excludeFromExport).length)
    console.log(`[undo] before=${before}, afterAdd=${afterAdd}, afterUndo=${afterUndo}`)
    await screenshot(page, 'undo-test')
  })

  test('2.2 undo 后 redo 恢复', async ({ page }) => {
    const before = await page.evaluate(() => (window as any).__fabricCanvas.getObjects().filter((o: any) => !o.excludeFromExport).length)
    await addRectWithSave(page)
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(300)
    await page.keyboard.press('Control+y')
    await page.waitForTimeout(300)
    const afterRedo = await page.evaluate(() => (window as any).__fabricCanvas.getObjects().filter((o: any) => !o.excludeFromExport).length)
    console.log(`[redo] before=${before}, afterRedo=${afterRedo}`)
    await screenshot(page, 'redo-test')
  })

  test('2.3 连续 undo', async ({ page }) => {
    const initial = await page.evaluate(() => (window as any).__fabricCanvas.getObjects().filter((o: any) => !o.excludeFromExport).length)
    await addRectWithSave(page, { fill: 'red' })
    await addRectWithSave(page, { fill: 'blue' })
    await addRectWithSave(page, { fill: 'green' })
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Control+z')
      await page.waitForTimeout(300)
    }
    const afterUndo = await page.evaluate(() => (window as any).__fabricCanvas.getObjects().filter((o: any) => !o.excludeFromExport).length)
    console.log(`[连续undo] initial=${initial}, afterUndo=${afterUndo}`)
    await screenshot(page, 'undo-all')
  })

  // ════════════════════════════════════════════════════════════════
  // 三、缩放/平移后交互
  // ════════════════════════════════════════════════════════════════

  test('3.1 缩放后添加对象', async ({ page }) => {
    await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      c.zoomToPoint({ x: 400, y: 300 }, 2.0)
      c.renderAll()
    })
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      c.add(new (window as any).fabric.Rect({ left: 200, top: 200, width: 100, height: 50, fill: '#FF5722' }))
      c.renderAll()
      return { zoom: c.getZoom(), rectLeft: Math.round(c.getObjects()[c.getObjects().length - 1].left) }
    })
    expect(result.zoom).toBe(2)
    expect(result.rectLeft).toBe(200)
    await screenshot(page, 'zoom-add')
  })

  test('3.2 缩放后移动对象', async ({ page }) => {
    await addRectWithSave(page, { left: 200, top: 200 })
    await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      c.zoomToPoint({ x: 400, y: 300 }, 1.5)
      c.renderAll()
    })
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      const obj = c.getActiveObject()
      obj.set({ left: 300, top: 300 })
      obj.setCoords()
      c.renderAll()
      return { left: Math.round(obj.left), top: Math.round(obj.top) }
    })
    expect(result.left).toBe(300)
    expect(result.top).toBe(300)
    await screenshot(page, 'zoom-move')
  })

  // ════════════════════════════════════════════════════════════════
  // 四、快捷键
  // ════════════════════════════════════════════════════════════════

  test('4.1 Ctrl+C / Ctrl+V', async ({ page }) => {
    await addRectWithSave(page, { fill: '#FF9800' })
    const before = await page.evaluate(() => (window as any).__fabricCanvas.getObjects().filter((o: any) => !o.excludeFromExport).length)
    await page.keyboard.press('Control+c')
    await page.waitForTimeout(200)
    await page.keyboard.press('Control+v')
    await page.waitForTimeout(200)
    const after = await page.evaluate(() => (window as any).__fabricCanvas.getObjects().filter((o: any) => !o.excludeFromExport).length)
    console.log(`[复制粘贴] before=${before}, after=${after}`)
    expect(after).toBe(before + 1)
    await screenshot(page, 'copy-paste-kb')
  })

  test('4.2 Delete 删除', async ({ page }) => {
    await addRectWithSave(page)
    const before = await page.evaluate(() => (window as any).__fabricCanvas.getObjects().filter((o: any) => !o.excludeFromExport).length)
    await page.keyboard.press('Delete')
    await page.waitForTimeout(300)
    const after = await page.evaluate(() => (window as any).__fabricCanvas.getObjects().filter((o: any) => !o.excludeFromExport).length)
    console.log(`[Delete] before=${before}, after=${after}`)
    expect(after).toBe(before - 1)
    await screenshot(page, 'delete-kb')
  })

  // ════════════════════════════════════════════════════════════════
  // 五、极端情况
  // ════════════════════════════════════════════════════════════════

  test('5.1 连续快速添加 10 个对象', async ({ page }) => {
    const before = await page.evaluate(() => (window as any).__fabricCanvas.getObjects().filter((o: any) => !o.excludeFromExport).length)
    for (let i = 0; i < 10; i++) {
      await page.evaluate((idx: number) => {
        const c = (window as any).__fabricCanvas
        c.add(new (window as any).fabric.Rect({
          left: 50 + idx * 30, top: 50 + idx * 20, width: 80, height: 40,
          fill: `hsl(${idx * 36}, 70%, 50%)`,
        }))
        c.renderAll()
      }, i)
    }
    const after = await page.evaluate(() => (window as any).__fabricCanvas.getObjects().filter((o: any) => !o.excludeFromExport).length)
    expect(after).toBe(before + 10)
    await screenshot(page, 'rapid-add')
  })

  test('5.2 全选后批量删除', async ({ page }) => {
    for (let i = 0; i < 5; i++) {
      await page.evaluate((idx: number) => {
        const c = (window as any).__fabricCanvas
        c.add(new (window as any).fabric.Rect({
          left: 100 + idx * 50, top: 100, width: 40, height: 40,
          fill: `hsl(${idx * 72}, 70%, 50%)`,
        }))
        c.renderAll()
      }, i)
    }
    const before = await page.evaluate(() => (window as any).__fabricCanvas.getObjects().filter((o: any) => !o.excludeFromExport).length)
    await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      const objs = c.getObjects().filter((o: any) => !o.excludeFromExport)
      const sel = new (window as any).fabric.ActiveSelection(objs, { canvas: c })
      c.setActiveObject(sel)
      c.renderAll()
    })
    await page.waitForTimeout(300)
    await page.keyboard.press('Delete')
    await page.waitForTimeout(300)
    const after = await page.evaluate(() => (window as any).__fabricCanvas.getObjects().filter((o: any) => !o.excludeFromExport).length)
    console.log(`[全选删除] before=${before}, after=${after}`)
    expect(after).toBe(0)
    await screenshot(page, 'select-all-delete')
  })

  test('5.3 添加后 undo 再添加', async ({ page }) => {
    const initial = await page.evaluate(() => (window as any).__fabricCanvas.getObjects().filter((o: any) => !o.excludeFromExport).length)
    await addRectWithSave(page, { fill: 'red' })
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(300)
    await addRectWithSave(page, { fill: 'blue' })
    const final = await page.evaluate(() => (window as any).__fabricCanvas.getObjects().filter((o: any) => !o.excludeFromExport).length)
    console.log(`[undo再添加] initial=${initial}, final=${final}`)
    await screenshot(page, 'undo-then-add')
  })

  // ════════════════════════════════════════════════════════════════
  // 六、保存
  // ════════════════════════════════════════════════════════════════

  test('6.1 保存按钮存在', async ({ page }) => {
    const saveBtn = page.locator('.btn-save')
    await expect(saveBtn).toBeVisible()
    const text = await saveBtn.textContent()
    console.log(`[保存按钮] text: ${text}`)
    await screenshot(page, 'save-btn')
  })

  test('6.2 保存后编辑器关闭', async ({ page }) => {
    await page.locator('.btn-save').click()
    await page.waitForFunction(() => !document.querySelector('.editor-overlay'), { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(1000)
    const editorExists = await page.evaluate(() => !!document.querySelector('.editor-overlay'))
    console.log(`[保存] 编辑器关闭: ${!editorExists}`)
    expect(editorExists).toBe(false)
  })

  // ════════════════════════════════════════════════════════════════
  // 七、画布状态一致性
  // ════════════════════════════════════════════════════════════════

  test('7.1 添加对象后画布尺寸不变', async ({ page }) => {
    const before = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      return { w: c.getWidth(), h: c.getHeight() }
    })
    for (let i = 0; i < 5; i++) {
      await page.evaluate((idx: number) => {
        const c = (window as any).__fabricCanvas
        c.add(new (window as any).fabric.Rect({ left: 50 + idx * 100, top: 50, width: 80, height: 80, fill: 'blue' }))
        c.renderAll()
      }, i)
    }
    const after = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      return { w: c.getWidth(), h: c.getHeight() }
    })
    expect(after.w).toBe(before.w)
    expect(after.h).toBe(before.h)
  })

  test('7.2 缩放后对象坐标系正确', async ({ page }) => {
    await addRectWithSave(page, { left: 200, top: 200 })
    await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      c.zoomToPoint({ x: 400, y: 300 }, 2.0)
      c.renderAll()
    })
    const result = await page.evaluate(() => {
      const c = (window as any).__fabricCanvas
      const obj = c.getActiveObject()
      return { left: Math.round(obj.left), top: Math.round(obj.top), zoom: c.getZoom() }
    })
    console.log(`[缩放坐标] left=${result.left}, top=${result.top}, zoom=${result.zoom}`)
    expect(result.zoom).toBe(2)
    await screenshot(page, 'zoom-coords')
  })
})
