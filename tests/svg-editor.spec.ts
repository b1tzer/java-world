import { test, expect } from '@playwright/test'

async function waitForSvg(page: any) {
  await page.waitForSelector('.VPContent', { timeout: 15000 })
  await page.waitForSelector('.svg-container', { timeout: 15000 })
  await page.waitForSelector('.svg-container svg', { timeout: 15000 })
  // 滚动到第二个 SVG 容器，避免被顶部导航栏遮挡
  await page.evaluate(() => {
    const containers = document.querySelectorAll('.svg-container')
    if (containers[1]) containers[1].scrollIntoView({ block: 'center' })
  })
  await page.waitForTimeout(500)
}

test.describe('SvgEditor UI 运行时验证', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/java-world/01-java-language/chapter-01-type-system')
    await waitForSvg(page)
  })

  test('1. SVG 图表正确渲染（尺寸不为 0）', async ({ page }) => {
    const svg = page.locator('.svg-container svg').first()
    await expect(svg).toBeVisible()
    const box = await svg.boundingBox()
    console.log(`[SVG 尺寸] width=${box?.width}, height=${box?.height}`)
    expect(box).not.toBeNull()
    expect(box!.width).toBeGreaterThan(0)
    expect(box!.height).toBeGreaterThan(0)
  })

  test('2. 悬浮显示编辑按钮', async ({ page }) => {
    const container = page.locator('.svg-container').nth(1)
    await container.hover()
    const btn = container.locator('.svg-edit-btn')
    await expect(btn).toBeVisible({ timeout: 5000 })
    const text = await btn.textContent()
    console.log(`[编辑按钮] text="${text}"`)
    expect(text).toContain('编辑 SVG')
  })

  test('3. 点击编辑按钮打开编辑器弹窗', async ({ page }) => {
    const container = page.locator('.svg-container').nth(1)
    await container.hover()
    await container.locator('.svg-edit-btn').click({ force: true })
    const editor = page.locator('.editor-overlay')
    await expect(editor).toBeVisible({ timeout: 10000 })
    console.log('[编辑器] 弹窗已打开')
  })

  test('4. 编辑器工具栏按钮完整', async ({ page }) => {
    const container = page.locator('.svg-container').nth(1)
    await container.hover()
    await container.locator('.svg-edit-btn').click({ force: true })
    await page.waitForSelector('.editor-overlay')

    const toolbar = page.locator('.editor-toolbar')
    await expect(toolbar).toBeVisible()

    const buttons = toolbar.locator('button')
    const count = await buttons.count()
    console.log(`[工具栏] 按钮总数: ${count}`)

    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i)
      const title = await btn.getAttribute('title') || ''
      const text = await btn.textContent()
      console.log(`  按钮 ${i}: title="${title}", text="${text?.trim()}"`)
    }

    // 按钮检查：data-tip 属性的按钮
    const expectedTips = ['撤销', '重做', '复制', '粘贴', '删除', '适应画布']
    for (const t of expectedTips) {
      const btn = toolbar.locator(`button[data-tip="${t}"]`)
      const exists = await btn.count()
      console.log(`[按钮检查] "${t}": ${exists > 0 ? '✅' : '❌'}`)
      expect(exists).toBeGreaterThan(0)
    }
    // "保存"按钮用 textContent 而非 data-tip
    const saveBtn = toolbar.locator('button').filter({ hasText: '保存' })
    expect(await saveBtn.count()).toBeGreaterThan(0)
    console.log(`[按钮检查] "保存": ✅ (text match)`)
  })

  test('5. 画布正确初始化', async ({ page }) => {
    const container = page.locator('.svg-container').nth(1)
    await container.hover()
    await container.locator('.svg-edit-btn').click({ force: true })
    await page.waitForSelector('.editor-overlay')

    await page.waitForFunction(() => {
      const loading = document.querySelector('.loading')
      return !loading || loading.offsetParent === null
    }, { timeout: 15000 })

    // Fabric.js 创建 upper-canvas 和 lower-canvas，取第一个
    const canvas = page.locator('.editor-canvas canvas').first()
    await expect(canvas).toBeVisible()

    const box = await canvas.boundingBox()
    console.log(`[画布] width=${box?.width}, height=${box?.height}`)
    expect(box).not.toBeNull()
    expect(box!.width).toBeGreaterThan(0)
    expect(box!.height).toBeGreaterThan(0)
  })

  test('6. 缩放级别显示', async ({ page }) => {
    const container = page.locator('.svg-container').nth(1)
    await container.hover()
    await container.locator('.svg-edit-btn').click({ force: true })
    await page.waitForSelector('.editor-overlay')

    await page.waitForFunction(() => !document.querySelector('.loading'), { timeout: 15000 })

    const zoomInfo = page.locator('.editor-toolbar .info').first()
    const text = await zoomInfo.textContent()
    console.log(`[缩放] 当前级别: ${text}`)
    expect(text).toMatch(/\d+%/)
  })

  test('7. 关闭编辑器', async ({ page }) => {
    const container = page.locator('.svg-container').nth(1)
    await container.hover()
    await container.locator('.svg-edit-btn').click({ force: true })
    await page.waitForSelector('.editor-overlay')

    const closeBtn = page.locator('.editor-toolbar button').last()
    await closeBtn.click()

    const editor = page.locator('.editor-overlay')
    await expect(editor).not.toBeVisible({ timeout: 5000 })
    console.log('[关闭] 编辑器已关闭')
  })

  test('8. Escape 键关闭编辑器', async ({ page }) => {
    const container = page.locator('.svg-container').nth(1)
    await container.hover()
    await container.locator('.svg-edit-btn').click({ force: true })
    await page.waitForSelector('.editor-overlay')

    await page.keyboard.press('Escape')

    const editor = page.locator('.editor-overlay')
    await expect(editor).not.toBeVisible({ timeout: 5000 })
    console.log('[Escape] 编辑器已关闭')
  })

  test('9. 颜色选择器存在', async ({ page }) => {
    const container = page.locator('.svg-container').nth(1)
    await container.hover()
    await container.locator('.svg-edit-btn').click({ force: true })
    await page.waitForSelector('.editor-overlay')

    const colorInputs = page.locator('.color-row input[type="color"]')
    const count = await colorInputs.count()
    console.log(`[颜色] 选择器数量: ${count}`)
    expect(count).toBe(2)
  })

  test('10. 对齐按钮组完整', async ({ page }) => {
    const container = page.locator('.svg-container').nth(1)
    await container.hover()
    await container.locator('.svg-edit-btn').click({ force: true })
    await page.waitForSelector('.editor-overlay')

    const alignGroup = page.locator('.align-group button')
    const count = await alignGroup.count()
    console.log(`[对齐] 按钮数量: ${count}`)

    const titles = []
    for (let i = 0; i < count; i++) {
      const t = await alignGroup.nth(i).getAttribute('title')
      titles.push(t)
    }
    console.log(`[对齐] 按钮: ${titles.join(', ')}`)
    expect(count).toBe(6)
  })
})
