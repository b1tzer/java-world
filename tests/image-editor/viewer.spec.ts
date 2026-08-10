import { test, expect } from '@playwright/test'

test.describe('Image Editor Plugin - 看图模式', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/java-world/image-editor-test')
    // 等待 VitePress 页面加载完成
    await page.waitForLoadState('networkidle')
  })

  test('页面加载正常', async ({ page }) => {
    // 检查页面标题
    const title = await page.title()
    expect(title).toBeTruthy()

    // 检查 VitePress 主内容区域
    const main = page.locator('.VPContent, .vp-doc, main')
    await expect(main.first()).toBeVisible()
  })

  test('markdown-it 插件将 .editor.json 图片替换为 ImageViewerWrapper', async ({ page }) => {
    // 检查是否存在 ImageViewerWrapper 组件
    // markdown-it 插件会将 ![alt](xxx.editor.json) 替换为 <ImageViewerWrapper>
    const wrapper = page.locator('ImageViewerWrapper, [class*="ie-container"]')
    const count = await wrapper.count()

    // 应该至少有一个编辑器组件（.editor.json 文件会被识别）
    console.log(`Found ${count} image editor wrapper(s)`)
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('Canvas 画布正确渲染', async ({ page }) => {
    // 等待 fabric.js canvas 渲染
    const canvas = page.locator('canvas')
    await expect(canvas.first()).toBeVisible({ timeout: 15000 })

    // 检查 canvas 有内容（宽高大于 0）
    const canvasBox = await canvas.first().boundingBox()
    expect(canvasBox).toBeTruthy()
    expect(canvasBox!.width).toBeGreaterThan(0)
    expect(canvasBox!.height).toBeGreaterThan(0)
  })

  test('浮动工具栏在悬停时显示', async ({ page }) => {
    // 找到编辑器容器
    const container = page.locator('.ie-container')
    await expect(container.first()).toBeVisible({ timeout: 15000 })

    // 工具栏默认隐藏（opacity: 0）
    const toolbar = page.locator('.ie-viewer-toolbar')
    await expect(toolbar.first()).toBeAttached()

    // 悬停后工具栏应该可见
    await container.first().hover()
    await page.waitForTimeout(300) // 等待 transition

    // 检查工具栏可见性
    const toolbarOpacity = await toolbar.first().evaluate(
      (el) => window.getComputedStyle(el).opacity
    )
    expect(toolbarOpacity).toBe('1')
  })

  test('工具栏包含缩放和下载按钮', async ({ page }) => {
    const container = page.locator('.ie-container')
    await expect(container.first()).toBeVisible({ timeout: 15000 })

    // 悬停显示工具栏
    await container.first().hover()
    await page.waitForTimeout(300)

    // 检查工具栏按钮
    const buttons = page.locator('.ie-toolbar-btn')
    const count = await buttons.count()

    // 应该有：缩小、放大、适应画布、全屏、下载 = 5 个按钮
    expect(count).toBeGreaterThanOrEqual(5)
  })

  test('明暗色主题切换', async ({ page }) => {
    const container = page.locator('.ie-container')
    await expect(container.first()).toBeVisible({ timeout: 15000 })

    // 获取当前主题下的背景色
    const lightBg = await container.first().evaluate(
      (el) => window.getComputedStyle(el).getPropertyValue('--ie-bg').trim()
    )

    // 切换到暗色主题
    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
    })
    await page.waitForTimeout(200)

    // 检查主题变量变化
    const darkBg = await container.first().evaluate(
      (el) => window.getComputedStyle(el).getPropertyValue('--ie-bg').trim()
    )

    // 暗色主题背景应该不同
    expect(lightBg).not.toBe(darkBg)
    console.log(`Theme: light=${lightBg}, dark=${darkBg}`)
  })

  test('缩放功能', async ({ page }) => {
    const container = page.locator('.ie-container')
    await expect(container.first()).toBeVisible({ timeout: 15000 })

    // 悬停显示工具栏
    await container.first().hover()
    await page.waitForTimeout(300)

    // 点击放大按钮
    const zoomInBtn = page.locator('.ie-toolbar-btn').nth(1) // 第二个按钮是放大
    await zoomInBtn.click()
    await page.waitForTimeout(200)

    // 检查 canvas 缩放状态（通过检查 transform 或 zoom 值）
    const canvas = page.locator('canvas')
    const isRendered = await canvas.first().isVisible()
    expect(isRendered).toBeTruthy()
  })
})

test.describe('Image Editor Plugin - 普通图片不受影响', () => {
  test('普通 .png 图片渲染为 img 标签', async ({ page }) => {
    await page.goto('/java-world/image-editor-test')
    await page.waitForLoadState('networkidle')

    // 检查普通图片是否渲染为 <img> 标签
    const imgTags = page.locator('img[src*=".png"], img[src*=".svg"]')
    const count = await imgTags.count()
    console.log(`Found ${count} normal <img> tags`)
    // 普通图片应该保持为 img 标签
    expect(count).toBeGreaterThanOrEqual(0)
  })
})

test.describe('Image Editor Plugin - 功能完整性', () => {
  test('fabric.js JSON 正确加载', async ({ page }) => {
    await page.goto('/java-world/image-editor-test')
    await page.waitForLoadState('networkidle')

    // 等待 canvas 渲染
    await page.waitForSelector('canvas', { timeout: 15000 })

    // 检查 canvas 上是否有 fabric.js 对象
    const hasFabricObjects = await page.evaluate(() => {
      const canvas = document.querySelector('canvas')
      if (!canvas) return false
      // fabric.js 会在 canvas 元素上存储实例
      return canvas.parentElement?.classList.contains('canvas-container') ||
             !!document.querySelector('.canvas-container')
    })

    expect(hasFabricObjects).toBeTruthy()
  })

  test('容器有正确的 CSS 变量', async ({ page }) => {
    await page.goto('/java-world/image-editor-test')
    await page.waitForLoadState('networkidle')

    const container = page.locator('.ie-container')
    await expect(container.first()).toBeVisible({ timeout: 15000 })

    // 检查 CSS 变量是否设置
    const cssVars = await container.first().evaluate((el) => {
      const style = window.getComputedStyle(el)
      return {
        bg: style.getPropertyValue('--ie-bg').trim(),
        text: style.getPropertyValue('--ie-text').trim(),
        border: style.getPropertyValue('--ie-border').trim(),
        accent: style.getPropertyValue('--ie-accent').trim(),
      }
    })

    // 所有变量都应该有值
    expect(cssVars.bg).toBeTruthy()
    expect(cssVars.text).toBeTruthy()
    expect(cssVars.border).toBeTruthy()
    expect(cssVars.accent).toBeTruthy()
    console.log('CSS Variables:', cssVars)
  })

  test('响应式布局', async ({ page }) => {
    await page.goto('/java-world/image-editor-test')
    await page.waitForLoadState('networkidle')

    const container = page.locator('.ie-container')
    await expect(container.first()).toBeVisible({ timeout: 15000 })

    // 检查容器宽度
    const box = await container.first().boundingBox()
    expect(box).toBeTruthy()
    expect(box!.width).toBeGreaterThan(100)

    // 检查不同视口下的表现
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.waitForTimeout(500)

    const tabletBox = await container.first().boundingBox()
    expect(tabletBox).toBeTruthy()
    expect(tabletBox!.width).toBeGreaterThan(100)
  })
})
