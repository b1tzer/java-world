/**
 * SVG 编辑器 — 常量定义
 * 单一职责：ICONS + CSS 色彩方案
 */

export const ICONS = {
  undo: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>',
  redo: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>',
  copy: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
  paste: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H9a1 1 0 0 0-1 1v2c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2V3c0-1.1-.9-1-1-1Z"/><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/></svg>',
  trash: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>',
  save: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
  zoomIn: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/></svg>',
  zoomOut: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="8" x2="14" y1="11" y2="11"/></svg>',
  zoomFit: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/></svg>',
  alignLeft: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6"/><line x1="15" x2="3" y1="12" y2="12"/><line x1="17" x2="3" y1="18" y2="18"/></svg>',
  alignCenter: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6"/><line x1="17" x2="7" y1="12" y2="12"/><line x1="19" x2="5" y1="18" y2="18"/></svg>',
  alignRight: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6"/><line x1="21" x2="9" y1="12" y2="12"/><line x1="21" x2="7" y1="18" y2="18"/></svg>',
  alignTop: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" x2="6" y1="3" y2="21"/><line x1="12" x2="12" y1="9" y2="21"/><line x1="18" x2="18" y1="7" y2="21"/></svg>',
  alignMiddle: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" x2="6" y1="3" y2="21"/><line x1="12" x2="12" y1="7" y2="17"/><line x1="18" x2="18" y1="5" y2="19"/></svg>',
  alignBottom: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" x2="6" y1="3" y2="21"/><line x1="12" x2="12" y1="3" y2="15"/><line x1="18" x2="18" y1="3" y2="17"/></svg>',
  layerUp: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>',
  layerDown: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  layerTop: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/><path d="m18 9-6-6-6 6"/></svg>',
  layerBottom: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 15 6 6 6-6"/><path d="m6 9 6 6 6-6"/></svg>',
  distributeH: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="6" height="16" rx="1"/><rect x="14" y="4" width="6" height="16" rx="1"/></svg>',
  distributeV: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="6" rx="1"/><rect x="4" y="14" width="16" height="6" rx="1"/></svg>',
  group: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2H2v10h10V2z"/><path d="M22 12H12v10h10V12z"/><path d="M22 2h-5"/><path d="M22 7h-5"/><path d="M7 22v-5"/><path d="M2 22v-5"/></svg>',
  ungroup: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="8" height="8" rx="1"/><rect x="14" y="14" width="8" height="8" rx="1"/><path d="m6 6 12 12"/><path d="m18 6-12 12"/></svg>',
  rotate: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>',
  shadow: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="14" y="14" width="8" height="8" rx="1"/><rect x="2" y="2" width="8" height="8" rx="1"/><path d="M6 2h12"/><path d="M18 6v12"/></svg>',
  bold: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>',
  italic: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/></svg>',
  underline: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" x2="20" y1="20" y2="20"/></svg>',
  textLeft: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6"/><line x1="15" x2="3" y1="12" y2="12"/><line x1="17" x2="3" y1="18" y2="18"/></svg>',
  textCenter: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6"/><line x1="17" x2="7" y1="12" y2="12"/><line x1="19" x2="5" y1="18" y2="18"/></svg>',
  textRight: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6"/><line x1="21" x2="9" y1="12" y2="12"/><line x1="21" x2="7" y1="18" y2="18"/></svg>',
  dashed: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h2"/><path d="M10 12h2"/><path d="M15 12h2"/><path d="M20 12h2"/></svg>',
  close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
  sun: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" x2="12" y1="1" y2="3"/><line x1="12" x2="12" y1="21" y2="23"/><line x1="4.22" x2="5.64" y1="4.22" y2="5.64"/><line x1="18.36" x2="19.78" y1="18.36" y2="19.78"/><line x1="1" x2="3" y1="12" y2="12"/><line x1="21" x2="23" y1="12" y2="12"/><line x1="4.22" x2="5.64" y1="19.78" y2="18.36"/><line x1="18.36" x2="19.78" y1="5.64" y2="4.22"/></svg>',
  moon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
}

// ── 亮色主题 hex 值（与 custom.css :root 保持一致）──
const LIGHT_HEX = {
  '--diagram-surface-1': '#FFFFFF', '--diagram-surface-2': '#F8F9FA', '--diagram-surface-3': '#ECEFF1',
  '--diagram-stroke-1': '#BDBDBD', '--diagram-stroke-2': '#E0E0E0',
  '--diagram-text-1': '#333333', '--diagram-text-2': '#666666', '--diagram-text-3': '#888888',
  '--diagram-accent-1': '#1565C0', '--diagram-accent-bg-1': '#E3F2FD', '--diagram-accent-bg-1b': '#BBDEFB', '--diagram-accent-text-1': '#0D47A1',
  '--diagram-accent-2': '#2E7D32', '--diagram-accent-bg-2': '#E8F5E9', '--diagram-accent-bg-2b': '#C8E6C9', '--diagram-accent-text-2': '#1B5E20',
  '--diagram-accent-3': '#7B1FA2', '--diagram-accent-bg-3': '#F3E5F5', '--diagram-accent-bg-3b': '#E1BEE7', '--diagram-accent-text-3': '#4A148C',
  '--diagram-accent-4': '#E65100', '--diagram-accent-bg-4': '#FFF3E0', '--diagram-accent-text-4': '#BF360C',
  '--diagram-accent-5': '#C62828', '--diagram-accent-bg-5': '#FFCDD2', '--diagram-accent-text-5': '#B71C1C',
  '--diagram-arrow': '#555555',
  '--diagram-ghost': '#999999',
}

// ── 暗色主题 hex 值（与 custom.css .dark 保持一致）──
const DARK_HEX = {
  '--diagram-surface-1': '#1a1a1a', '--diagram-surface-2': '#222222', '--diagram-surface-3': '#2a2a2a',
  '--diagram-stroke-1': '#444444', '--diagram-stroke-2': '#333333',
  '--diagram-text-1': '#e0e0e0', '--diagram-text-2': '#b0b0b0', '--diagram-text-3': '#808080',
  '--diagram-accent-1': '#5C9CE6', '--diagram-accent-bg-1': '#0d2137', '--diagram-accent-bg-1b': '#1a3a5c', '--diagram-accent-text-1': '#90CAF9',
  '--diagram-accent-2': '#66BB6A', '--diagram-accent-bg-2': '#0d2818', '--diagram-accent-bg-2b': '#1b4332', '--diagram-accent-text-2': '#A5D6A7',
  '--diagram-accent-3': '#CE93D8', '--diagram-accent-bg-3': '#2d1b3d', '--diagram-accent-bg-3b': '#3d2550', '--diagram-accent-text-3': '#E1BEE7',
  '--diagram-accent-4': '#FFB74D', '--diagram-accent-bg-4': '#3d2d15', '--diagram-accent-text-4': '#FFCC80',
  '--diagram-accent-5': '#EF9A9A', '--diagram-accent-bg-5': '#3d1520', '--diagram-accent-text-5': '#FFCDD2',
  '--diagram-arrow': '#b0b0b0',
  '--diagram-ghost': '#666666',
}

// ── 按主题导出 VAR→HEX 映射（用于 preprocessor：CSS 变量 → hex 色值）──
export const THEME_VAR_TO_HEX = {
  light: LIGHT_HEX,
  dark: DARK_HEX,
}

// ── 亮↔暗 双向 hex 映射（用于编辑器内主题切换：遍历 canvas 对象替换颜色）──
// 所有键值统一大写，确保 swapColor 的 .toUpperCase() 能正确匹配
export const LIGHT_TO_DARK = {}
export const DARK_TO_LIGHT = {}
for (const v of Object.keys(LIGHT_HEX)) {
  LIGHT_TO_DARK[LIGHT_HEX[v].toUpperCase()] = DARK_HEX[v].toUpperCase()
  DARK_TO_LIGHT[DARK_HEX[v].toUpperCase()] = LIGHT_HEX[v].toUpperCase()
}

// ── 合并映射 hex→CSS 变量（用于 postprocessor：保存时 hex→var(--xxx) 还原）──
// 同一个 CSS 变量在亮/暗下有不同的 hex 值，还原时都映射到同一个变量名
export const ALL_HEX_TO_VAR = {}
for (const v of Object.keys(LIGHT_HEX)) {
  ALL_HEX_TO_VAR[LIGHT_HEX[v]] = v
  ALL_HEX_TO_VAR[DARK_HEX[v]] = v
}

// 兼容旧代码：保持 CSS_COLORS 导出（用于 postprocessor.js 中的 hexToCssVars）
export const CSS_COLORS = ALL_HEX_TO_VAR

// 兼容旧代码：保持 VAR_TO_HEX 导出（用于 preprocessor.js 中的 replaceCssVars）
export const VAR_TO_HEX = LIGHT_HEX
