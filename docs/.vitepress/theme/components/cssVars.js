/**
 * 图表 CSS 变量 ↔ 色值映射表
 *
 * 用于编辑器内部：加载 SVG 时将 CSS 变量替换为 hex（Fabric.js 才能渲染），
 * 保存时将 hex 还原为 CSS 变量（保持源码可读性、支持明暗模式切换）。
 */

/** 明色模式 (light) */
const LIGHT = {
  surface1:  '#FFFFFF',  surface2: '#F8F9FA',  surface3: '#ECEFF1',
  stroke1:   '#BDBDBD',  stroke2:  '#E0E0E0',
  text1:     '#333333',  text2:    '#666666',   text3:    '#888888',
  accent1:   '#1565C0',  accentBg1: '#E3F2FD',  accentBg1b: '#BBDEFB',  accentText1: '#0D47A1',
  accent2:   '#2E7D32',  accentBg2: '#E8F5E9',  accentBg2b: '#C8E6C9',  accentText2: '#1B5E20',
  accent3:   '#7B1FA2',  accentBg3: '#F3E5F5',  accentBg3b: '#E1BEE7',  accentText3: '#4A148C',
  accent4:   '#E65100',  accentBg4: '#FFF3E0',                             accentText4: '#BF360C',
  accent5:   '#C62828',  accentBg5: '#FFCDD2',                             accentText5: '#B71C1C',
  arrow:     '#555555',
  ghost:     '#999999',
}

/** 暗色模式 (dark) */
const DARK = {
  surface1:  '#1E1E1E',  surface2: '#252525',  surface3: '#2D2D2D',
  stroke1:   '#555555',  stroke2:  '#444444',
  text1:     '#E0E0E0',  text2:    '#AAAAAA',   text3:    '#808080',
  accent1:   '#64B5F6',  accentBg1: '#0D2137',  accentBg1b: '#1A3A5C',  accentText1: '#90CAF9',
  accent2:   '#81C784',  accentBg2: '#1B301B',  accentBg2b: '#2D502D',  accentText2: '#A5D6A7',
  accent3:   '#CE93D8',  accentBg3: '#2D1A34',  accentBg3b: '#4A2D58',  accentText3: '#E1BEE7',
  accent4:   '#FFB74D',  accentBg4: '#3D2100',                             accentText4: '#FFCC80',
  accent5:   '#EF9A9A',  accentBg5: '#3D1515',                             accentText5: '#EF9A9A',
  arrow:     '#999999',
  ghost:     '#666666',
}

/** 构建 CSS 变量名 → hex 映射 */
function buildVarToHex(palette, prefix = '--diagram-') {
  const map = {}
  const key2var = {
    surface1: `${prefix}surface-1`,   surface2: `${prefix}surface-2`,   surface3: `${prefix}surface-3`,
    stroke1: `${prefix}stroke-1`,     stroke2: `${prefix}stroke-2`,
    text1: `${prefix}text-1`,         text2: `${prefix}text-2`,         text3: `${prefix}text-3`,
    accent1: `${prefix}accent-1`,     accentBg1: `${prefix}accent-bg-1`,     accentBg1b: `${prefix}accent-bg-1b`,  accentText1: `${prefix}accent-text-1`,
    accent2: `${prefix}accent-2`,     accentBg2: `${prefix}accent-bg-2`,     accentBg2b: `${prefix}accent-bg-2b`,  accentText2: `${prefix}accent-text-2`,
    accent3: `${prefix}accent-3`,     accentBg3: `${prefix}accent-bg-3`,     accentBg3b: `${prefix}accent-bg-3b`,  accentText3: `${prefix}accent-text-3`,
    accent4: `${prefix}accent-4`,     accentBg4: `${prefix}accent-bg-4`,                                       accentText4: `${prefix}accent-text-4`,
    accent5: `${prefix}accent-5`,     accentBg5: `${prefix}accent-bg-5`,                                       accentText5: `${prefix}accent-text-5`,
    arrow: `${prefix}arrow`,          ghost: `${prefix}ghost`,
  }
  for (const [key, cssVar] of Object.entries(key2var)) {
    map[cssVar] = palette[key]
  }
  return map
}

/** 构建 hex → CSS 变量名 反向映射（保持原始大小写） */
function buildHexToVar(palette, prefix = '--diagram-') {
  const map = {}
  const entries = [
    ['surface1', `${prefix}surface-1`], ['surface2', `${prefix}surface-2`], ['surface3', `${prefix}surface-3`],
    ['stroke1', `${prefix}stroke-1`],   ['stroke2', `${prefix}stroke-2`],
    ['text1', `${prefix}text-1`],       ['text2', `${prefix}text-2`],       ['text3', `${prefix}text-3`],
    ['accent1', `${prefix}accent-1`],   ['accentBg1', `${prefix}accent-bg-1`],   ['accentBg1b', `${prefix}accent-bg-1b`], ['accentText1', `${prefix}accent-text-1`],
    ['accent2', `${prefix}accent-2`],   ['accentBg2', `${prefix}accent-bg-2`],   ['accentBg2b', `${prefix}accent-bg-2b`], ['accentText2', `${prefix}accent-text-2`],
    ['accent3', `${prefix}accent-3`],   ['accentBg3', `${prefix}accent-bg-3`],   ['accentBg3b', `${prefix}accent-bg-3b`], ['accentText3', `${prefix}accent-text-3`],
    ['accent4', `${prefix}accent-4`],   ['accentBg4', `${prefix}accent-bg-4`],                                         ['accentText4', `${prefix}accent-text-4`],
    ['accent5', `${prefix}accent-5`],   ['accentBg5', `${prefix}accent-bg-5`],                                         ['accentText5', `${prefix}accent-text-5`],
    ['arrow', `${prefix}arrow`],        ['ghost', `${prefix}ghost`],
  ]
  for (const [key, cssVar] of entries) {
    map[palette[key]] = cssVar
  }
  return map
}

export const LIGHT_VAR_TO_HEX = buildVarToHex(LIGHT)
export const DARK_VAR_TO_HEX = buildVarToHex(DARK)
export const LIGHT_HEX_TO_VAR = buildHexToVar(LIGHT)
export const DARK_HEX_TO_VAR = buildHexToVar(DARK)
