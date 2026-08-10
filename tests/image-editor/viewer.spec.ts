import { test, expect } from '@playwright/test'

/**
 * VitePress Image Editor 插件 - 看图模式测试
 *
 * 测试目标：
 * 1. markdown-it 插件自动识别 .editor.json 文件
 * 2. 看图模式组件正确渲染
 * 3. 明暗色主题自动切换
 * 4. 工具栏功能正常
 */

const BASE_URL = 'http://localhost:5174'
const TEST_PAGE = '/java-world/image-editor-test'

test.describe('Image Editor - markdown-it 自动识别', () => {
  test('页面加载正常', async ({ page }) => {
    await page.goto(TEST_PAGE)
    await page.waitForLoadState('networkidle')

    // 检查页面标题包含测试页标识
    const title = await page.title()
    expect(title).toBeTruthy()

    // 检查主内容区域存在
    const main = page.locator('.vp-doc, main')
    await expect(main.first()).toBeVisible()
  })

  test('.editor.json 图片被替换为编辑器组件', async ({ page }) => {
    await page.goto(TEST_PAGE)
    await page.waitForLoadState('networkidle')

    // 等待组件渲染
    await page.waitForSelector('.ie-container, .ie-loading, .ie-error', { timeout: 10000 })

    // 检查是否存在编辑器组件（不是普通 img 标签）
    const editorComponent = page.locator('.ie-container, .ie-loading, .ie-error')
    const count = await editorComponent.count()
    expect(count).toBeGreaterThanOrEqual(1)

    // 确认不是普通 img 标签
    const editorImg = page.locator('img[src*="architecture.editor.json"]')
    const imgCount = await editorImg.count()
    expect(imgCount).toBe(0) // 应该被替换为组件，不是 img
  })

  test('普通 .svg 图片保持为 img 标签', async ({ page }) => {
    await page.goto(TEST_PAGE)
    await page.waitForLoadState('networkidle')

    // 普通图片应该保持为 img 标签
    const normalImg = page.locator('img[src*="logo.svg"]')
    const count = await normalImg.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })
})

test.describe('Image Editor - 看图模式功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TEST_PAGE)
    await page.waitForLoadState('networkidle')
    // 等待编辑器组件加载完成
    await page.waitForSelector('.ie-container', { timeout: 15000 })
  })

  test('Canvas 画布正确渲染', async ({ page }) => {
    // fabric.js 创建两个 canvas（upper-canvas 和 lower-canvas）
    const canvas = page.locator('.ie-container canvas').first()
    await expect(canvas).toBeVisible()

    // 检查 canvas 有实际尺寸
    const canvasBox = await canvas.boundingBox()
    expect(canvasBox).toBeTruthy()
    expect(canvasBox!.width).toBeGreaterThan(100)
    expect(canvasBox!.height).toBeGreaterThan(100)
  })

  test('浮动工具栏存在', async ({ page }) => {
    // 检查工具栏存在
    const toolbar = page.locator('.ie-viewer-toolbar')
    await expect(toolbar).toBeAttached()

    // 检查工具栏按钮数量（缩小、放大、适应画布、全屏、下载 = 5个）
    const buttons = page.locator('.ie-toolbar-btn')
    const count = await buttons.count()
    expect(count).toBeGreaterThanOrEqual(5)
  })

  test('工具栏在悬停时显示', async ({ page }) => {
    const container = page.locator('.ie-container')
    const toolbar = page.locator('.ie-viewer-toolbar')

    // 悬停前工具栏透明
    const beforeOpacity = await toolbar.evaluate(
      (el) => window.getComputedStyle(el).opacity
    )

    // 悬停容器
    await container.hover()
    await page.waitForTimeout(300) // 等待 transition

    // 悬停后工具栏可见
    const afterOpacity = await toolbar.evaluate(
      (el) => window.getComputedStyle(el).opacity
    )
    expect(afterOpacity).toBe('1')
  })

  test('缩放按钮可点击', async ({ page }) => {
    const container = page.locator('.ie-container')
    await container.hover()
    await page.waitForTimeout(300)

    // 点击放大按钮
    const zoomInBtn = page.locator('.ie-toolbar-btn').nth(1)
    await expect(zoomInBtn).toBeVisible()
    await zoomInBtn.click()

    // 点击后 canvas 仍然存在
    const canvas = page.locator('.ie-container canvas').first()
    await expect(canvas).toBeVisible()
  })
})

test.describe('Image Editor - 明暗色主题', () => {
  test('亮色主题变量正确', async ({ page }) => {
    await page.goto(TEST_PAGE)
    await page.waitForSelector('.ie-container', { timeout: 15000 })

    // 检查 CSS 变量
    const cssVars = await page.locator('.ie-container').evaluate((el) => {
      const style = window.getComputedStyle(el)
      return {
        bg: style.getPropertyValue('--ie-bg').trim(),
        text: style.getPropertyValue('--ie-text').trim(),
        border: style.getPropertyValue('--ie-border').trim(),
      }
    })

    expect(cssVars.bg).toBeTruthy()
    expect(cssVars.text).toBeTruthy()
    expect(cssVars.border).toBeTruthy()
  })

  test('暗色主题切换', async ({ page }) => {
    await page.goto(TEST_PAGE)
    await page.waitForSelector('.ie-container', { timeout: 15000 })

    // 获取亮色主题背景
    const lightBg = await page.locator('.ie-container').evaluate((el) => {
      return window.getComputedStyle(el).getPropertyValue('--ie-bg').trim()
    })

    // 切换到暗色主题
    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
    })
    await page.waitForTimeout(300)

    // 获取暗色主题背景
    const darkBg = await page.locator('.ie-container').evaluate((el) => {
      return window.getComputedStyle(el).getPropertyValue('--ie-bg').trim()
    })

    // 暗色主题背景应该不同
    expect(lightBg).not.toBe(darkBg)
    console.log(`Theme colors: light=${lightBg}, dark=${darkBg}`)
  })
})

test.describe('Image Editor - 响应式布局', () => {
  test('桌面端正常显示', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto(TEST_PAGE)
    await page.waitForSelector('.ie-container', { timeout: 15000 })

    const container = page.locator('.ie-container')
    const box = await container.boundingBox()
    expect(box).toBeTruthy()
    expect(box!.width).toBeGreaterThan(200)
  })

  test('平板端正常显示', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto(TEST_PAGE)
    await page.waitForSelector('.ie-container', { timeout: 15000 })

    const container = page.locator('.ie-container')
    const box = await container.boundingBox()
    expect(box).toBeTruthy()
    expect(box!.width).toBeGreaterThan(100)
  })
})
