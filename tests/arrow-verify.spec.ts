import { test, expect } from '@playwright/test';

const PAGE_VT = 'http://localhost:5173/java-world/03-java-concurrency/chapter-12-virtual-thread';
const PAGE_SEC = 'http://localhost:5173/java-world/06-java-enterprise/chapter-08-security-deploy';

async function openEditor(page: any, url: string, svgIndex: number) {
  page.on('pageerror', e => console.log('  ⚠️ JS:', e.message));
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('.svg-container', { timeout: 15000 });
  // 等待 SVG 内部渲染完成（VitePress 水合可能较慢）
  await page.waitForSelector('.svg-container svg', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(800);
  const container = page.locator('.svg-container').nth(svgIndex);
  await container.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const box = await container.boundingBox();
  if (box && box.width > 0) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(500);
  }
  const editBtn = container.locator('.svg-edit-btn');
  await editBtn.waitFor({ state: 'attached', timeout: 5000 }).catch(() => {});
  await editBtn.click({ force: true }).catch(() => {});
  await page.waitForSelector('.editor-overlay', { timeout: 15000 });
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    const c = (window as any).__fabricCanvas;
    if (c) c.setViewportTransform([1, 0, 0, 1, 0, 0]);
  });
}

async function getArrowGroups(page: any) {
  return page.evaluate(() => {
    const c = (window as any).__fabricCanvas;
    if (!c) return [];
    return c.getObjects().filter((o: any) => o.type === 'group').map((g: any) => {
      const children = g._objects || g.getObjects() || [];
      const line = children.find((ch: any) => ch.type === 'line');
      const poly = children.find((ch: any) => ch.type === 'polygon');
      if (!line || !poly) return null;
      const points: string[] = (poly.points || []).map((p: any) => `${Math.round(p.x)},${Math.round(p.y)}`);
      const xs = points.map(p => parseInt(p.split(',')[0]));
      const ys = points.map(p => parseInt(p.split(',')[1]));
      return { x1: Math.round(line.x1), y1: Math.round(line.y1), x2: Math.round(line.x2), y2: Math.round(line.y2),
        stroke: line.stroke, polyFill: poly.fill, points,
        xSpread: Math.max(...xs) - Math.min(...xs), ySpread: Math.max(...ys) - Math.min(...ys), selectable: g.selectable };
    }).filter(Boolean);
  });
}

test('A1: vt决策树 — 9箭头全为三角形', async ({ page }) => {
  await openEditor(page, PAGE_VT, 1);
  const arrows = await getArrowGroups(page);
  console.log(`箭头数: ${arrows.length}`);
  expect(arrows.length).toBeGreaterThanOrEqual(9);
  for (const a of arrows) {
    const ok = a.xSpread > 0 && a.ySpread > 0;
    console.log(`  ${a.x1},${a.y1}→${a.x2},${a.y2}: x=${a.xSpread} y=${a.ySpread} ${ok ? '✅' : '❌ 折叠!'}`);
    expect(ok, `箭头不应折叠 (xSpread=${a.xSpread}, ySpread=${a.ySpread})`).toBe(true);
  }
  console.log('✅ 全部三角形');
});

test('A2: security-auth-flow — 9箭头全为三角形', async ({ page }) => {
  await page.goto(PAGE_SEC, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('.svg-container', { timeout: 15000 });
  // 单个 evaluate 完成全部：滚动+等待+dispatch+点击+等待 editor
  await page.evaluate(async () => {
    const c = document.querySelector('.svg-container'); if (!c) return;
    c.scrollIntoView({ block: 'center' });
    await new Promise(r => setTimeout(r, 500));
    c.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await new Promise(r => setTimeout(r, 500));
    const btn = c.querySelector('.svg-edit-btn'); if (!btn) return;
    btn.click();
  });
  await page.waitForSelector('.editor-overlay', { timeout: 15000 });
  await page.waitForTimeout(2000);
  await page.evaluate(() => { const c = (window as any).__fabricCanvas; if (c) c.setViewportTransform([1,0,0,1,0,0]); });

  const arrows = await getArrowGroups(page);
  expect(arrows.length).toBeGreaterThanOrEqual(9);
  for (const a of arrows) {
    const ok = a.xSpread > 0 && a.ySpread > 0;
    console.log(`  ${a.x1},${a.y1}→${a.x2},${a.y2}: ${ok ? '✅' : '❌'}`);
    expect(ok).toBe(true);
  }
  console.log('✅ 全部三角形');
});

test('B1: 箭头方向 — 尖端指向线终点', async ({ page }) => {
  await openEditor(page, PAGE_VT, 1);
  const arrows = await getArrowGroups(page);
  for (const a of arrows) {
    const [tx, ty] = a.points[0].split(',').map(Number);
    const d = Math.sqrt((tx - a.x2) ** 2 + (ty - a.y2) ** 2);
    console.log(`  尖端@(${tx},${ty}) 终点@(${a.x2},${a.y2}) 差=${d.toFixed(1)}`);
    expect(d, '尖端应指向线终点').toBeLessThanOrEqual(5);
  }
  console.log('✅ 方向正确');
});

test('C1: 合组率 — 无孤立箭头元件', async ({ page }) => {
  await openEditor(page, PAGE_VT, 1);
  const r = await page.evaluate(() => {
    const c = (window as any).__fabricCanvas;
    const objs = c.getObjects();
    const kids = new Set<any>();
    objs.filter((o: any) => o.type === 'group').forEach((g: any) =>
      (g._objects || g.getObjects() || []).forEach((ch: any) => kids.add(ch)));
    return {
      orphans: objs.filter((o: any) => o.type === 'line' && !kids.has(o)).length,
      orphanP: objs.filter((o: any) => o.type === 'polygon' && !kids.has(o) && ((o.width||0)*(o.scaleX||1)) < 20).length,
    };
  });
  console.log(`孤立line=${r.orphans} 孤立小polygon=${r.orphanP}`);
  expect(r.orphans).toBe(0);
  expect(r.orphanP).toBe(0);
  console.log('✅ 合并率100%');
});

test('D1: 颜色 — polygon fill 有效不透明', async ({ page }) => {
  await openEditor(page, PAGE_VT, 1);
  const arrows = await getArrowGroups(page);
  for (const a of arrows) {
    expect(a.polyFill).toBeTruthy();
    expect(a.polyFill).not.toBe('transparent');
    expect(a.polyFill).not.toBe('none');
    console.log(`  ${a.polyFill} ✅`);
  }
  console.log('✅ 颜色正确');
});

test('E1: 可选中', async ({ page }) => {
  await openEditor(page, PAGE_VT, 1);
  const arrows = await getArrowGroups(page);
  for (const a of arrows) expect(a.selectable).toBe(true);
  console.log('✅ 全部可选中');
});

test('F1: 拖拽不解体', async ({ page }) => {
  await openEditor(page, PAGE_VT, 1);
  const box = await page.locator('.editor-canvas .lower-canvas').boundingBox().catch(() => null);
  if (!box) { console.log('⚠️ skip'); return; }
  const before = await page.evaluate(() =>
    (window as any).__fabricCanvas.getObjects().filter((o: any) => o.type === 'group').length);
  const pos = await page.evaluate(() => {
    const c = (window as any).__fabricCanvas;
    const g = c.getObjects().filter((o: any) => o.type === 'group')[0];
    if (!g) return null;
    c.setActiveObject(g); c.renderAll();
    return { left: Math.round(g.left), top: Math.round(g.top) };
  });
  if (!pos || !box) return;
  await page.mouse.move(box.x + pos.left + 10, box.y + pos.top + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + pos.left + 60, box.y + pos.top + 30, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const after = await page.evaluate(() =>
    (window as any).__fabricCanvas.getObjects().filter((o: any) => o.type === 'group').length);
  console.log(`${before}→${after} ${after === before ? '✅' : '❌解体!'}`);
  expect(after, '拖拽不解体').toBe(before);
  console.log('✅ 拖拽不解体');
});

test('G1: 保存后箭头不消失', async ({ page }) => {
  await openEditor(page, PAGE_VT, 1);
  // 清理可能残留的测试对象
  await page.evaluate(() => {
    const c = (window as any).__fabricCanvas;
    if (!c) return;
    c.getObjects().filter((o: any) => o.id?.startsWith('test') || o.id?.startsWith('gs-'))
      .forEach((o: any) => c.remove(o));
    c.renderAll();
  });
  const before = await getArrowGroups(page);
  expect(before.length).toBeGreaterThanOrEqual(9, '初始应有至少9个箭头组');

  // 点击保存按钮 — 等待按钮可用
  const saveBtn = page.locator('.btn-save');
  await saveBtn.waitFor({ state: 'attached', timeout: 5000 });
  // 保存按钮可能因 page refresh 暂时 disabled，等待
  await page.waitForFunction(() => {
    const btn = document.querySelector('.btn-save') as HTMLButtonElement;
    return btn && !btn.disabled;
  }, { timeout: 5000 }).catch(() => {});
  await saveBtn.click({ force: true });
  await page.waitForTimeout(2500);

  const after = await getArrowGroups(page);
  expect(after.length).toBeGreaterThanOrEqual(before.length, '保存后箭头组不应消失');
  for (const a of after) {
    expect(a.xSpread > 0 && a.ySpread > 0, '保存后箭头仍应为三角形').toBe(true);
  }
  console.log(`保存前=${before.length} 保存后=${after.length} ✅`);
});
