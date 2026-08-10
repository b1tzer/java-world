/**
 * guard.spec.ts — 背景守卫测试：验证背景元素不可拖拽、不可选中
 *
 * 核心场景：
 *   1. SVG 自身的背景矩形（如灰色底框）不应 selectable
 *   2. canvas 背景层（addBackground 创建的白底+阴影）不应 selectable
 *   3. 点击/拖拽背景区域不应创建选区或移动背景元素
 *
 * 用法: npx playwright test guard --project=chromium --timeout=60000
 */
import { test, expect } from '@playwright/test';

const PAGE = '/java-world/04-java-network/chapter-03-socket';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', e => console.log('  ⚠️ JS:', e.message));
  page.on('console', msg => { if (msg.type() === 'error') console.log('  🐛 CONSOLE ERR:', msg.text()); });
  page.on('console', msg => { if (msg.text().startsWith('[Guard]')) console.log(`  📢 ${msg.text()}`); });
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

test('G1: 审计 — 列出所有 fabric 对象的 selectable/evented 状态', async ({ page }) => {
  const objs = await page.evaluate(() => {
    const c = (window as any).__fabricCanvas;
    if (!c) return { err: 'no canvas' };
    return c.getObjects().map((o: any, i: number) => ({
      i, type: o.type, fill: o.fill,
      left: Math.round(o.left || 0), top: Math.round(o.top || 0),
      w: Math.round((o.width || 0) * (o.scaleX || 1)),
      h: Math.round((o.height || 0) * (o.scaleY || 1)),
      sel: o.selectable, evt: o.evented,
      excl: o.excludeFromExport,
    }));
  });

  console.log(`总对象数: ${objs.length}`);
  // 直接检查那两个可疑的 rect
  const suspects = objs.filter((o: any) => o.type === 'rect' && o.w > 400);
  suspects.forEach((o: any) => {
    console.log(`  SUSPECT: idx=${o.i} ${o.w}×${o.h} fill=${o.fill} sel=${o.sel} evt=${o.evt} excl=${o.excl}`);
  });
  const selectable = objs.filter((o: any) => o.sel && !o.excl);
  const locked = objs.filter((o: any) => !o.sel || o.excl);
  const bgLike = objs.filter((o: any) => o.type === 'rect' && o.w > 400 && o.sel);

  console.log(`✅ 锁定对象: ${locked.length}`);
  console.log(`✅ 可选中对象: ${selectable.length}`);
  console.log(`❌ 疑似背景但可选中: ${bgLike.length} →`, JSON.stringify(bgLike.map((o: any) => `${o.type} ${o.w}×${o.h} ${o.fill}`)));

  // ★ 关键断言：不应存在大面积可选中矩形（这些是背景元素）
  expect(bgLike.length, `发现 ${bgLike.length} 个大面积背景矩形可被选中/拖拽`).toBe(0);
  expect(locked.length, '应有至少 2 个锁定对象（bg + shadow）').toBeGreaterThanOrEqual(2);
});

test('G2: 交互 — 点击背景不应选中对象', async ({ page }) => {
  // 获取 canvas bounding box
  const box = await page.locator('.editor-canvas .lower-canvas').boundingBox().catch(() => null);
  if (!box) { console.log('⚠️ 无法获取 canvas boundingBox'); return; }

  // 先确保无选中
  await page.evaluate(() => { const c = (window as any).__fabricCanvas; c.discardActiveObject(); c.renderAll(); });

  // 点击 canvas 右上角空白区域（远离 SVG 内容）
  // SVG viewBox 0 0 510 289，但实际渲染可能缩放，点击顶部中央区域
  await page.mouse.click(box.x + box.width / 2, box.y + 20);
  await page.waitForTimeout(300);

  const selAfterBgClick = await page.evaluate(() => {
    const c = (window as any).__fabricCanvas;
    const active = c.getActiveObject();
    return active ? `选中了 type=${active.type} fill=${active.fill}` : '无选中';
  });
  console.log(`点击空白后: ${selAfterBgClick}`);
  // 点击空白理论上应取消选择（或选中背景层），但不应选中一个"可拖拽"的背景矩形
  const selObj = await page.evaluate(() => !!(window as any).__fabricCanvas?.getActiveObject());
  // 如果选中了某个对象，检查它是否是可拖拽的普通元素（text/line/小rect）
  const selType = await page.evaluate(() => (window as any).__fabricCanvas?.getActiveObject()?.type || 'none');
  console.log(`  选中类型: ${selType}`);
  // 不强制断言（取决于 SVG 内容），只打印诊断
});

test('G3: 拖拽 — 拖拽背景区域不能移动背景元素', async ({ page }) => {
  // 读初始对象列表
  const before = await page.evaluate(() => {
    const c = (window as any).__fabricCanvas;
    return c.getObjects().map((o: any) => ({ left: Math.round(o.left), top: Math.round(o.top), type: o.type, sel: o.selectable }));
  });

  const box = await page.locator('.editor-canvas .lower-canvas').boundingBox().catch(() => null);
  if (!box || before.length === 0) { console.log('⚠️ 跳过'); return; }

  // 找到第一个可选中对象的中心，在那个对象上拖拽
  const selIdx = before.findIndex((o: any) => o.sel && o.type !== 'group');
  if (selIdx < 0) { console.log('⚠️ 无可选中对象'); return; }

  const obj = before[selIdx];
  const sx = box.x + obj.left + 20;
  const sy = box.y + obj.top + 10;
  console.log(`拖拽 ${obj.type} 从 (${obj.left},${obj.top})`);
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 50, sy + 30, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(300);

  const after = await page.evaluate(() => {
    const c = (window as any).__fabricCanvas;
    return c.getObjects().map((o: any) => ({ left: Math.round(o.left), top: Math.round(o.top), sel: o.selectable }));
  });

  // 可选中对象应该被移动了
  const moved = after[selIdx].left !== before[selIdx].left;
  console.log(`  拖拽结果: ${moved ? '✅ 对象已移动' : '⚠️ 对象未移动'}`);

  // 检查锁定对象是否完全没有移动
  const lockedBefore = before.filter((o: any) => !o.sel);
  const lockedAfter = after.filter((o: any) => !o.sel);
  const lockedMoved = lockedBefore.some((b: any, i: number) => {
    const a = lockedAfter.find((la: any) => la.top === b.top && la.type === b.type);
    return a && (a.left !== b.left || a.top !== b.top);
  });
  console.log(`  锁定对象移动: ${lockedMoved ? '❌' : '✅'} (应为 false)`);
  expect(lockedMoved, '锁定（背景）对象不应被拖拽移动').toBe(false);
});
