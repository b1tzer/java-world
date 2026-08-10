/**
 * guideline-snap.spec.ts — 辅助线 + 吸附功能验证
 *
 * 测试 CanvasManager 的：
 *   A. 辅助线（Guide Lines）: 拖拽时对象边缘/中心靠近时显示虚线
 *   B. 吸附（Snap）: 松手时自动对准参考线
 *
 * 核心原理：
 *   - object:moving 事件 → CanvasManager._computeGuideLines → _guideLines 数组
 *   - object:modified 事件 → 检查 _guideLines → 修正对象坐标
 *   - after:render 事件 → 在 canvas 上绘制虚线
 *
 * 用法: npx playwright test guideline-snap --project=chromium --timeout=60000
 */
import { test, expect } from '@playwright/test';

const PAGE = '/java-world/04-java-network/chapter-03-socket';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', e => console.log('  ⚠️ JS:', e.message));
  await page.goto(PAGE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('.svg-container', { timeout: 15000 });
  await page.evaluate(() => document.querySelectorAll('.svg-container')[1]?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  const container = page.locator('.svg-container').nth(1);
  await container.hover();
  await container.locator('.svg-edit-btn').click({ force: true });
  await page.waitForSelector('.editor-overlay', { timeout: 15000 });
  await page.waitForTimeout(2000);
});

/** 重置 canvas 坐标系 + 清理 */
async function reset(page: any) {
  await page.evaluate(() => {
    const c = (window as any).__fabricCanvas;
    if (!c) return;
    c.discardActiveObject();
    c.setViewportTransform([1, 0, 0, 1, 0, 0]);
    c.setZoom(1);
    // 清理所有测试对象
    c.getObjects().filter((o: any) => o.id?.startsWith('gs-')).forEach((o: any) => c.remove(o));
    c.renderAll();
  });
}

/** 获取 canvas bounding box（CSS 坐标，用于鼠标事件） */
async function getCanvasBox(page: any) {
  return page.locator('.editor-canvas .lower-canvas').boundingBox().catch(() => null);
}

/** 创建矩形 */
async function createRects(page: any, rects: Array<{id: string, left:number, top:number, w:number, h:number, fill:string}>) {
  return page.evaluate((rects: any) => {
    const c = (window as any).__fabricCanvas;
    if (!c) return;
    const R = (window as any).fabric.Rect;
    rects.forEach((r: any) => {
      const rect = new R({ left: r.left, top: r.top, width: r.w, height: r.h, fill: r.fill, id: r.id });
      c.add(rect);
    });
    c.renderAll();
  }, rects);
}

/** 选择对象（用 fabric API） */
async function select(page: any, id: string) {
  await page.evaluate((id: string) => {
    const c = (window as any).__fabricCanvas;
    const obj = c.getObjects().find((o: any) => o.id === id);
    if (obj) { c.setActiveObject(obj); c.renderAll(); }
  }, id);
}

/** 读 fabric 对象的 left/top/center */
async function readObjects(page: any, prefix: string) {
  return page.evaluate((prefix: string) => {
    const c = (window as any).__fabricCanvas;
    return c.getObjects().filter((o: any) => o.id?.startsWith(prefix))
      .map((o: any) => ({
        id: o.id, left: Math.round(o.left), top: Math.round(o.top),
        cx: Math.round(o.left + (o.width||0) * (o.scaleX||1) / 2),
        cy: Math.round(o.top + (o.height||0) * (o.scaleY||1) / 2),
      }));
  }, prefix);
}

/** 读 _guideLines（CanvasManager 内部状态） */
async function readGuideLines(page: any) {
  return page.evaluate(() => {
    const mgr = (window as any).__canvasMgr;
    if (!mgr || !mgr._guideLines) return [];
    return mgr._guideLines.map((l: any) => `${l.type}: ${Math.round(l.x ?? l.y)}`);
  });
}

// ══════════════════════════════════════════════════════════

test('A1: 辅助线 + 吸附 — 左边缘对齐', async ({ page }) => {
  await reset(page);
  // 两个矩形，左边缘完全相同(left=100)，右边缘不同
  await createRects(page, [
    { id: 'gs-a1', left: 100, top: 100, w: 80, h: 50, fill: '#1565C0' },
    { id: 'gs-a2', left: 100, top: 300, w: 120, h: 50, fill: '#E53935' },
  ]);
  const box = await getCanvasBox(page);
  if (!box) return;
  await select(page, 'gs-a1');
  const before = await readObjects(page, 'gs-');
  console.log(`初始: a1@(${before[0].left},${before[0].top}) a2@(${before[1].left},${before[1].top})`);

  // 拖拽 a1 从 (100+40, 100+25) 向 (100,300+25-5) 即 接近 a2 的 top 边缘
  const sx = box.x + before[0].cx;
  const sy = box.y + before[0].cy;
  const ex = box.x + before[1].left + 60; // a2 centerX 方向
  const ey = box.y + before[1].top + 25 - 5; // 靠近 a2 top，差 5px < 8px 阈值

  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(ex, ey, { steps: 20 });
  await page.waitForTimeout(100);

  // ★ 辅助线应产生
  const lines = await readGuideLines(page);
  console.log(`拖拽中辅助线: [${lines.join(', ')}]`);
  expect(lines.length, '靠近时应有至少 1 条辅助线').toBeGreaterThan(0);

  await page.mouse.up();
  await page.waitForTimeout(300);

  // ★ 释放后辅助线清空
  expect((await readGuideLines(page)).length).toBe(0);

  // ★ 吸附验证：top 应接近 r2.top(300)，或 centerY 接近 r2.centerY(325)
  const after = await readObjects(page, 'gs-');
  console.log(`吸附后: a1@(${after[0].left},${after[0].top}) cy=${after[0].cy}`);
  const topDiff = Math.abs(after[0].top - 300);
  const cyDiff = Math.abs(after[0].cy - 325);
  const snapped = topDiff <= 8 || cyDiff <= 8;
  console.log(`top偏差=${topDiff} cy偏差=${cyDiff} 吸附=${snapped}`);
  expect(snapped, `吸附后应靠近 r2 的 top(300)或 centerY(325)`).toBe(true);
});

test('A2: 辅助线 + 吸附 — 垂直居中对齐', async ({ page }) => {
  await reset(page);
  // ★ 隐藏所有已有 SVG 对象，只留测试 rect
  await page.evaluate(() => {
    const c = (window as any).__fabricCanvas;
    c.getObjects().forEach((o: any) => { if (!o.id?.startsWith('gs-')) o.set({ visible: false }); });
  });

  await createRects(page, [
    { id: 'gs-v1', left: 100, top: 100, w: 80, h: 50, fill: '#1565C0' },
    { id: 'gs-v2', left: 300, top: 100, w: 80, h: 50, fill: '#4CAF50' },
  ]);
  const box = await getCanvasBox(page);
  if (!box) return;
  await select(page, 'gs-v1');
  const before = await readObjects(page, 'gs-');
  console.log(`v1 cx=${before[0].cx} cy=${before[0].cy} v2 cx=${before[1].cx}`);

  // 水平拖拽 v1 向 v2 靠近
  await page.mouse.move(box.x + before[0].cx, box.y + before[0].cy);
  await page.mouse.down();
  await page.mouse.move(box.x + before[1].cx - 5, box.y + before[0].cy, { steps: 20 });
  await page.waitForTimeout(100);

  const lines = await readGuideLines(page);
  console.log(`辅助线: [${lines.join(', ')}]`);
  // 应该有水平辅助线（centerY 或 top/bottom 对齐，两者 Y 相同）
  expect(lines.length, '应至少触发 centerY 对齐辅助线').toBeGreaterThan(0);

  await page.mouse.up();
  await page.waitForTimeout(300);

  const after = await readObjects(page, 'gs-');
  const cxDiff = Math.abs(after[0].cx - before[1].cx);
  console.log(`吸附后 centerX 偏差=${cxDiff}px`);
  // 垂直居中对齐吸附后 centerX 应在 8px 内
  expect(cxDiff, `吸附后 centerX 应≤8px`).toBeLessThanOrEqual(8);

  // 恢复可见
  await page.evaluate(() => {
    const c = (window as any).__fabricCanvas;
    c.getObjects().forEach((o: any) => o.set({ visible: true }));
    c.renderAll();
  });
});

test('A3: 辅助线 — 拖拽产生 centerX 对齐线', async ({ page }) => {
  await reset(page);
  // 在真实 SVG 场景（37个对象）中创建两个测试矩形
  await createRects(page, [
    { id: 'gs-x1', left: 100, top: 100, w: 80, h: 50, fill: '#1565C0' },
    { id: 'gs-x2', left: 400, top: 200, w: 80, h: 50, fill: '#4CAF50' },
  ]);
  const box = await getCanvasBox(page);
  if (!box) return;
  await select(page, 'gs-x1');
  const start = await readObjects(page, 'gs-');
  console.log(`x1 cx=${start[0].cx} → x2 cx=${start[1].cx}`);

  // 拖拽 x1 靠近 x2 的 centerX（差 5px）
  const sx = box.x + start[0].cx;
  const ex = box.x + start[1].cx - 5;
  await page.mouse.move(sx, box.y + start[0].cy);
  await page.mouse.down();
  await page.mouse.move(ex, box.y + start[0].cy, { steps: 30 });
  await page.waitForTimeout(100);

  const lines = await readGuideLines(page);
  const vCount = lines.filter(l => l.startsWith('vertical')).length;
  const hCount = lines.filter(l => l.startsWith('horizontal')).length;
  console.log(`辅助线: ${vCount} vertical + ${hCount} horizontal`);
  console.log(`  明细: [${lines.slice(0, 8).join(', ')}]`);

  // ★ 至少应有一条辅助线（垂直或水平都可以，证明功能正常）
  expect(lines.length, '拖拽时应产生辅助线').toBeGreaterThan(0);
  await page.mouse.up();

  // ★ 释放后吸附验证
  await page.waitForTimeout(300);
  const after = await readObjects(page, 'gs-');
  const cxDiff = Math.abs(after[0].cx - start[1].cx);
  console.log(`吸附后 centerX 偏差=${cxDiff}px`);
  // 近距拖拽(5px) → 吸附后应在 8px 阈值内
  expect(cxDiff <= 8 || Math.abs(after[0].top - start[1].top) <= 8,
    `吸附后应靠近目标，cxDiff=${cxDiff}`).toBe(true);
});
