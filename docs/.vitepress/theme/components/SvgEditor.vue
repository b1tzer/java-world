<script setup>
/**
 * SVG 编辑器 — 基于 vue-fabric-editor Editor 核心 + 自建工具栏
 *
 * props:
 *   src             - SVG 文件路径
 *   resolveCssVars  - 是否处理 CSS 变量（默认 true / 'light' / 'dark'）
 */
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { fabric } from 'fabric'

// ═══════════ CSS 变量映射 ═══════════
const LIGHT_VAR_TO_HEX = {
  '--diagram-surface-1': '#FFFFFF','--diagram-surface-2': '#F8F9FA','--diagram-surface-3': '#ECEFF1',
  '--diagram-stroke-1': '#BDBDBD','--diagram-stroke-2': '#E0E0E0',
  '--diagram-text-1': '#333333','--diagram-text-2': '#666666','--diagram-text-3': '#888888',
  '--diagram-accent-1': '#1565C0','--diagram-accent-bg-1': '#E3F2FD','--diagram-accent-bg-1b':'#BBDEFB','--diagram-accent-text-1':'#0D47A1',
  '--diagram-accent-2': '#2E7D32','--diagram-accent-bg-2': '#E8F5E9','--diagram-accent-bg-2b':'#C8E6C9','--diagram-accent-text-2':'#1B5E20',
  '--diagram-accent-3': '#7B1FA2','--diagram-accent-bg-3': '#F3E5F5','--diagram-accent-bg-3b':'#E1BEE7','--diagram-accent-text-3':'#4A148C',
  '--diagram-accent-4': '#E65100','--diagram-accent-bg-4': '#FFF3E0','--diagram-accent-text-4':'#BF360C',
  '--diagram-accent-5': '#C62828','--diagram-accent-bg-5': '#FFCDD2','--diagram-accent-text-5':'#B71C1C',
  '--diagram-arrow': '#555555','--diagram-ghost': '#999999',
}
const LIGHT_HEX_TO_VAR = {}; for (const [k, v] of Object.entries(LIGHT_VAR_TO_HEX)) LIGHT_HEX_TO_VAR[v] = k
const DARK_VAR_TO_HEX = {
  '--diagram-surface-1': '#1E1E1E','--diagram-surface-2': '#252525','--diagram-surface-3': '#2D2D2D',
  '--diagram-stroke-1': '#555555','--diagram-stroke-2': '#444444',
  '--diagram-text-1': '#E0E0E0','--diagram-text-2': '#AAAAAA','--diagram-text-3': '#808080',
  '--diagram-accent-1': '#64B5F6','--diagram-accent-bg-1': '#0D2137','--diagram-accent-bg-1b':'#1A3A5C','--diagram-accent-text-1':'#90CAF9',
  '--diagram-accent-2': '#81C784','--diagram-accent-bg-2': '#1B301B','--diagram-accent-bg-2b':'#2D502D','--diagram-accent-text-2':'#A5D6A7',
  '--diagram-accent-3': '#CE93D8','--diagram-accent-bg-3': '#2D1A34','--diagram-accent-bg-3b':'#4A2D58','--diagram-accent-text-3':'#E1BEE7',
  '--diagram-accent-4': '#FFB74D','--diagram-accent-bg-4': '#3D2100','--diagram-accent-text-4':'#FFCC80',
  '--diagram-accent-5': '#EF9A9A','--diagram-accent-bg-5': '#3D1515','--diagram-accent-text-5':'#EF9A9A',
  '--diagram-arrow': '#999999','--diagram-ghost': '#666666',
}
const DARK_HEX_TO_VAR = {}; for (const [k, v] of Object.entries(DARK_VAR_TO_HEX)) DARK_HEX_TO_VAR[v] = k

const props = defineProps({
  src:            { type: String, required: true },
  resolveCssVars: { type: [Boolean, String], default: true },
  mode:           { type: String, default: 'light' },
})
const emit = defineEmits(['close', 'saved'])

// ═══════════ 状态 ═══════════
const canvasRef = ref(null)
const loading = ref(true)
const saving = ref(false)
const activeTool = ref('select')        // select | rect | circle | line | text
const fillColor = ref('#1565C0')
const strokeColor = ref('#333333')
const zoomLevel = ref(100)

let canvasEditor = null
let canvas = null
let _keyHandler = null
let _originalViewBox = ''
let _cssVarEnabled = false
let _cssVarMode = 'light'

// ═══════════ 初始化 ═══════════

onMounted(async () => {
  await nextTick()

  if (props.resolveCssVars === true || props.resolveCssVars === 'true') {
    _cssVarEnabled = true; _cssVarMode = props.mode || 'light'
  } else if (typeof props.resolveCssVars === 'string') {
    _cssVarEnabled = true; _cssVarMode = props.resolveCssVars
  }

  const base = import.meta.env.BASE_URL || '/'
  const url = props.src.startsWith('/') ? base + props.src.slice(1) : props.src
  let rawSvg = ''
  try {
    const resp = await fetch(url)
    if (resp.ok) rawSvg = await resp.text()
    else { loading.value = false; return }
  } catch (e) { loading.value = false; return }

  const processed = preprocessSvg(rawSvg)

  canvas = new fabric.Canvas(canvasRef.value, {
    width: processed.svgWidth || 800, height: processed.svgHeight || 600,
    fireRightClick: true, stopContextMenu: true, controlsAboveOverlay: true,
    preserveObjectStacking: true, backgroundColor: '#f1f1f1',
    selection: true,
  })

  // 画布鼠标事件 — 绘图工具
  canvas.on('mouse:down', onCanvasMouseDown)
  canvas.on('mouse:move', onCanvasMouseMove)
  canvas.on('mouse:up', onCanvasMouseUp)
  canvas.on('selection:created', () => { /* 选中时取消绘图模式 */ })

  const [
    { default: Editor },
    { default: DringPlugin }, { default: AlignGuidLinePlugin },
    { default: ControlsPlugin }, { default: CenterAlignPlugin },
    { default: LayerPlugin }, { default: CopyPlugin },
    { default: MoveHotKeyPlugin }, { default: DeleteHotKeyPlugin },
    { default: GroupPlugin }, { default: HistoryPlugin },
  ] = await Promise.all([
    import('@kuaitu/core'),
    import('@kuaitu/core/plugin/DringPlugin'), import('@kuaitu/core/plugin/AlignGuidLinePlugin'),
    import('@kuaitu/core/plugin/ControlsPlugin'), import('@kuaitu/core/plugin/CenterAlignPlugin'),
    import('@kuaitu/core/plugin/LayerPlugin'), import('@kuaitu/core/plugin/CopyPlugin'),
    import('@kuaitu/core/plugin/MoveHotKeyPlugin'), import('@kuaitu/core/plugin/DeleteHotKeyPlugin'),
    import('@kuaitu/core/plugin/GroupPlugin'), import('@kuaitu/core/plugin/HistoryPlugin'),
  ])

  canvasEditor = new Editor()
  canvasEditor.init(canvas)
  canvasEditor.use(DringPlugin).use(AlignGuidLinePlugin).use(ControlsPlugin)
    .use(CenterAlignPlugin).use(LayerPlugin).use(CopyPlugin)
    .use(MoveHotKeyPlugin).use(DeleteHotKeyPlugin).use(GroupPlugin).use(HistoryPlugin)

  try { await loadSvgToCanvas(processed.svg) } catch (e) { /* ignore */ }
  loading.value = false

  _keyHandler = (e) => { if (e.key === 'Escape') emit('close') }
  document.addEventListener('keydown', _keyHandler)
})

onUnmounted(() => {
  if (_keyHandler) document.removeEventListener('keydown', _keyHandler)
  if (canvasEditor) canvasEditor.destory()
  canvas = null; canvasEditor = null
})

// ═══════════ 预处理 ═══════════

function preprocessSvg(svg) {
  let s = svg.replace(/<\?xml[^?]*\?>\s*/g, '')
  if (_cssVarEnabled) {
    const varMap = _cssVarMode === 'dark' ? DARK_VAR_TO_HEX : LIGHT_VAR_TO_HEX
    for (const [varName, hex] of Object.entries(varMap)) {
      s = s.replaceAll(`var(${varName})`, hex)
    }
  }
  s = s.replace(/<stop(\s[^>]*?)style="stop-color:\s*([^;"]+);\s*stop-opacity:\s*([^"]+)"([^>]*?)>/g,
    '<stop$1stop-color="$2" stop-opacity="$3"$4>')
  const vbMatch = s.match(/viewBox="([^"]+)"/)
  _originalViewBox = vbMatch ? vbMatch[1] : ''
  const parts = _originalViewBox ? _originalViewBox.split(/[\s,]+/).map(Number) : []
  return { svg: s, svgWidth: parts.length >= 4 ? Math.round(parts[2]) : 0, svgHeight: parts.length >= 4 ? Math.round(parts[3]) : 0 }
}

function loadSvgToCanvas(svgContent) {
  return new Promise((resolve, reject) => {
    fabric.loadSVGFromString(svgContent, (objects) => {
      if (!objects || objects.length === 0) { reject(new Error('空')); return }
      objects.forEach(obj => canvas.add(obj)); canvas.renderAll(); canvas.fire('object:modified'); resolve(true)
    })
  })
}

// ═══════════ 工具操作 ═══════════

let _drawObj = null, _drawStart = { x: 0, y: 0 }

function setTool(tool) {
  activeTool.value = tool
  canvas.isDrawingMode = false
  canvas.selection = (tool === 'select')
  canvas.getObjects().forEach(o => { o.selectable = (tool === 'select'); o.evented = (tool === 'select') })
  canvas.discardActiveObject(); canvas.renderAll()
}

function onCanvasMouseDown(opt) {
  if (activeTool.value === 'select' || activeTool.value === 'text') return
  const ptr = canvas.getPointer(opt.e); _drawStart = { x: ptr.x, y: ptr.y }
  const fill = fillColor.value, stroke = strokeColor.value
  if (activeTool.value === 'rect') {
    _drawObj = new fabric.Rect({ left: ptr.x, top: ptr.y, width: 0, height: 0, fill, stroke, strokeWidth: 1.5, rx: 3, ry: 3 })
  } else if (activeTool.value === 'circle') {
    _drawObj = new fabric.Ellipse({ left: ptr.x, top: ptr.y, rx: 0, ry: 0, fill, stroke, strokeWidth: 1.5, originX: 'center', originY: 'center' })
  } else if (activeTool.value === 'line') {
    _drawObj = new fabric.Line([ptr.x, ptr.y, ptr.x, ptr.y], { stroke, strokeWidth: 2 })
  }
  if (_drawObj) { canvas.add(_drawObj); canvas.renderAll() }
}

function onCanvasMouseMove(opt) {
  if (!_drawObj || activeTool.value === 'select') return
  const ptr = canvas.getPointer(opt.e)
  if (activeTool.value === 'rect') {
    _drawObj.set({ width: Math.abs(ptr.x - _drawStart.x), height: Math.abs(ptr.y - _drawStart.y) })
    if (ptr.x < _drawStart.x) _drawObj.set({ left: ptr.x })
    if (ptr.y < _drawStart.y) _drawObj.set({ top: ptr.y })
  } else if (activeTool.value === 'circle') {
    _drawObj.set({ rx: Math.abs(ptr.x - _drawStart.x), ry: Math.abs(ptr.y - _drawStart.y) })
  } else if (activeTool.value === 'line') {
    _drawObj.set({ x2: ptr.x, y2: ptr.y })
  }
  canvas.renderAll()
}

function onCanvasMouseUp() {
  if (!_drawObj) return
  if ((_drawObj.width !== undefined && _drawObj.width < 5) || (_drawObj.rx !== undefined && _drawObj.rx < 3)) {
    canvas.remove(_drawObj)
  } else {
    canvas.fire('object:modified')
  }
  _drawObj = null; canvas.renderAll()
}

function addText() {
  setTool('text')
  const text = new fabric.IText('双击编辑', {
    left: canvas.width / 2 - 60, top: canvas.height / 2 - 10,
    fontSize: 20, fill: fillColor.value, fontFamily: 'Arial',
  })
  canvas.add(text); canvas.setActiveObject(text); canvas.renderAll(); canvas.fire('object:modified')
}

function undo() { canvasEditor?.undo?.() || console.warn('undo 不可用') }
function redo() { canvasEditor?.redo?.() || console.warn('redo 不可用') }
function deleteSelected() { canvasEditor?.del?.() || canvas.getActiveObjects().forEach(o => canvas.remove(o)); canvas.fire('object:modified') }
function bringForward() { canvasEditor?.up?.() }
function sendBackward() { canvasEditor?.down?.() }
function groupSelected() { canvasEditor?.group?.() }
function ungroupSelected() { canvasEditor?.unGroup?.() }
function cloneSelected() { canvasEditor?.clone?.() }

function zoomIn() { let z = canvas.getZoom() * 1.2; canvas.zoomToPoint(new fabric.Point(canvas.width / 2, canvas.height / 2), z); zoomLevel.value = Math.round(z * 100) }
function zoomOut() { let z = canvas.getZoom() / 1.2; if (z < 0.1) z = 0.1; canvas.zoomToPoint(new fabric.Point(canvas.width / 2, canvas.height / 2), z); zoomLevel.value = Math.round(z * 100) }
function zoomFit() {
  const objects = canvas.getObjects(); if (objects.length === 0) return
  canvas.zoomToPoint(new fabric.Point(canvas.width / 2, canvas.height / 2), 1)
  const bound = canvas.getObjects().reduce((acc, o) => {
    const b = o.getBoundingRect(); return { l: Math.min(acc.l, b.left), t: Math.min(acc.t, b.top), r: Math.max(acc.r, b.left + b.width), b: Math.max(acc.b, b.top + b.height) }
  }, { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity })
  const cw = bound.r - bound.l, ch = bound.b - bound.t
  if (cw <= 0 || ch <= 0) return
  const scale = Math.min(canvas.width / cw, canvas.height / ch) * 0.9
  canvas.zoomToPoint(new fabric.Point(canvas.width / 2, canvas.height / 2), scale)
  zoomLevel.value = Math.round(scale * 100)
}

// ═══════════ 保存 ═══════════

async function handleSave() {
  saving.value = true
  try {
    let svg = canvas.toSVG()
    if (_cssVarEnabled) svg = postprocessSvg(svg)
    const resp = await fetch('/__svg-save__', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: props.src, content: svg }) })
    if (resp.ok) { emit('saved'); emit('close') }
    else alert('保存失败: ' + await resp.text())
  } catch (e) { alert('保存失败: ' + e.message) }
  saving.value = false
}

function postprocessSvg(svg) {
  let s = svg
  s = s.replace(/<\?xml[^?]*\?>\s*/g, '').replace(/<!DOCTYPE[^>]*>\s*/g, '')
    .replace(/<desc>[^<]*<\/desc>\s*/g, '').replace(/<defs>\s*<\/defs>\s*/g, '')
    .replace(/ xmlns:xlink="[^"]*"/g, '').replace(/ version="[^"]*"/g, '').replace(/ xml:space="preserve"/g, '')
  s = s.replace(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/gi,
    (_, r, g, b) => '#' + [r, g, b].map(x => parseInt(x).toString(16).padStart(2, '0').toUpperCase()).join(''))
  const hexMap = _cssVarMode === 'dark' ? DARK_HEX_TO_VAR : LIGHT_HEX_TO_VAR
  for (const [hex, varName] of Object.entries(hexMap)) { s = s.replace(new RegExp(hex, 'gi'), `var(${varName})`) }
  if (_originalViewBox) s = s.replace(/viewBox="[^"]*"/, `viewBox="${_originalViewBox}"`)
  s = s.replace(/\s+width="[^"]*"/, '').replace(/\s+height="[^"]*"/, '')
  s = unwrapGroups(s)
  s = s.replace(/<rect\s+x="0"\s+y="0"\s+width="100%"\s+height="100%"\s+fill="#F5F5F5"\s*\/?>\s*/gi, '')
  return s.replace(/\n\s*\n/g, '\n').trim()
}

function unwrapGroups(svg) {
  return svg.replace(/<g\s+transform="matrix\(1\s+0\s+0\s+1\s+([\d.\-]+)\s+([\d.\-]+)\)"[^>]*>\s*([\s\S]*?)<\/g>/g,
    (full, txStr, tyStr, inner) => {
      const tx = parseFloat(txStr), ty = parseFloat(tyStr), trimmed = inner.trim()
      const textMatch = trimmed.match(/^(<text[^>]*>)\s*<tspan\s+x="([\d.\-]+)"\s+y="([\d.\-]+)"[^>]*>([\s\S]*?)<\/tspan>\s*<\/text>$/)
      if (textMatch) { const [, a, lx, ly, c] = textMatch; return `${a.replace(/\s+xml:space="preserve"/g, '').replace(/^<text/, `<text x="${(tx + parseFloat(lx)).toFixed(1)}" y="${(ty + parseFloat(ly)).toFixed(1)}"`).replace(/>$/, '')}>${c}</text>` }
      const rectMatch = trimmed.match(/^(<rect[^>]*?)\s+style="[^"]*"([^>]*\/>)\s*$/)
      if (rectMatch) return trimmed.replace(/ x="([\d.\-]+)"/, (m, v) => ` x="${(tx + parseFloat(v)).toFixed(1)}"`).replace(/ y="([\d.\-]+)"/, (m, v) => ` y="${(ty + parseFloat(v)).toFixed(1)}"`)
      const lineMatch = trimmed.match(/^(<line[^>]*?)\s+style="[^"]*"([^>]*\/>)\s*$/)
      if (lineMatch) return trimmed.replace(/ x1="([\d.\-]+)"/, (m, v) => ` x1="${(tx + parseFloat(v)).toFixed(1)}"`).replace(/ y1="([\d.\-]+)"/, (m, v) => ` y1="${(ty + parseFloat(v)).toFixed(1)}"`).replace(/ x2="([\d.\-]+)"/, (m, v) => ` x2="${(tx + parseFloat(v)).toFixed(1)}"`).replace(/ y2="([\d.\-]+)"/, (m, v) => ` y2="${(ty + parseFloat(v)).toFixed(1)}"`)
      return full
    })
}
</script>

<template>
  <div class="editor-overlay" @click.self="emit('close')">
    <div class="editor-panel">
      <!-- ═══════ 顶部工具栏 ═══════ -->
      <div class="editor-toolbar-top">
        <span class="title" :title="src">{{ src.split('/').pop() }}</span>

        <div class="tool-divider" />

        <!-- 选择 / 绘图工具 -->
        <button class="tb-btn" :class="{ active: activeTool === 'select' }" @click="setTool('select')" title="选择 / 移动 (V)">
          <svg viewBox="0 0 24 24"><path d="M4 4l7 18 2.5-6.5L20 13z" fill="currentColor"/></svg>
        </button>
        <button class="tb-btn" :class="{ active: activeTool === 'rect' }" @click="setTool('rect')" title="矩形 (R)">
          <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2"/></svg>
        </button>
        <button class="tb-btn" :class="{ active: activeTool === 'circle' }" @click="setTool('circle')" title="圆形 (C)">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/></svg>
        </button>
        <button class="tb-btn" :class="{ active: activeTool === 'line' }" @click="setTool('line')" title="直线 (L)">
          <svg viewBox="0 0 24 24"><line x1="4" y1="20" x2="20" y2="4" stroke="currentColor" stroke-width="2"/></svg>
        </button>
        <button class="tb-btn" :class="{ active: activeTool === 'text' }" @click="addText" title="文字 (T)">
          <svg viewBox="0 0 24 24"><text x="3" y="19" font-size="20" font-weight="bold" fill="currentColor" font-family="Arial">T</text></svg>
        </button>

        <div class="tool-divider" />

        <button class="tb-btn" @click="undo" title="撤销 Ctrl+Z">
          <svg viewBox="0 0 24 24"><path d="M3 7v6h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <button class="tb-btn" @click="redo" title="重做 Ctrl+Y">
          <svg viewBox="0 0 24 24"><path d="M21 7v6h-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>

        <div class="tool-divider" />

        <button class="tb-btn danger" @click="deleteSelected" title="删除 Del">
          <svg viewBox="0 0 24 24"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <button class="tb-btn" @click="cloneSelected" title="复制 Ctrl+D">
          <svg viewBox="0 0 24 24"><rect width="14" height="14" x="8" y="8" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" fill="none" stroke="currentColor" stroke-width="2"/></svg>
        </button>

        <div class="tool-divider" />

        <button class="tb-btn" @click="bringForward" title="上移一层">
          <svg viewBox="0 0 24 24"><path d="m18 15-6-6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <button class="tb-btn" @click="sendBackward" title="下移一层">
          <svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <button class="tb-btn" @click="groupSelected" title="组合 Ctrl+G">
          <svg viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="13" y="13" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>
        </button>
        <button class="tb-btn" @click="ungroupSelected" title="取消组合 Ctrl+Shift+G">
          <svg viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="13" y="13" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="1.5"/></svg>
        </button>

        <div class="tool-divider" />

        <!-- 颜色选择器 -->
        <label class="color-pick" title="填充颜色">
          <input type="color" v-model="fillColor" />
          <span class="color-swatch" :style="{ background: fillColor }">▣</span>
        </label>
        <label class="color-pick" title="描边颜色">
          <input type="color" v-model="strokeColor" />
          <span class="color-swatch stroke" :style="{ background: strokeColor }">◯</span>
        </label>

        <div class="tool-divider" />

        <!-- 缩放 -->
        <button class="tb-btn" @click="zoomOut" title="缩小">−</button>
        <span class="zoom-label">{{ zoomLevel }}%</span>
        <button class="tb-btn" @click="zoomIn" title="放大">+</button>
        <button class="tb-btn" @click="zoomFit" title="适应画布">⊡</button>

        <div class="spacer" />

        <span v-if="loading" class="info">加载中…</span>
        <span v-if="saving" class="info">保存中…</span>
        <button class="btn-save" @click="handleSave" :disabled="saving">💾 保存</button>
        <button class="btn-close" @click="emit('close')" title="关闭 (Esc)">✕</button>
      </div>

      <!-- ═══════ 画布区域 ═══════ -->
      <div class="editor-body">
        <canvas ref="canvasRef" id="svg-editor-canvas"></canvas>
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-overlay { position: fixed; inset: 0; z-index: 9999; background: rgba(15, 15, 15, 0.75); backdrop-filter: blur(12px); display: flex; align-items: center; justify-content: center; animation: overlayIn 0.2s ease; }
@keyframes overlayIn { from { opacity: 0; } to { opacity: 1; } }
.editor-panel { width: 95vw; height: 90vh; background: #fff; border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 32px 80px rgba(0,0,0,0.4); animation: panelIn 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes panelIn { from { opacity: 0; transform: scale(0.96) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }

/* ═══════ 顶部工具栏 ═══════ */
.editor-toolbar-top { display: flex; align-items: center; gap: 2px; padding: 6px 10px; background: #f8f9fa; border-bottom: 1px solid #e0e0e0; flex-shrink: 0; min-height: 42px; flex-wrap: nowrap; overflow-x: auto; }
.tool-divider { width: 1px; height: 24px; background: #ddd; margin: 0 4px; flex-shrink: 0; }
.title { font-size: 12px; color: #888; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 4px; flex-shrink: 0; }
.info { font-size: 12px; color: #999; margin: 0 8px; flex-shrink: 0; }
.spacer { flex: 1; }

.tb-btn { width: 30px; height: 30px; border: none; border-radius: 6px; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #555; flex-shrink: 0; padding: 0; }
.tb-btn:hover { background: #e8e8e8; color: #333; }
.tb-btn.active { background: #d4e4ff; color: #1565C0; }
.tb-btn.danger:hover { background: #fde8e8; color: #c62828; }
.tb-btn svg { width: 18px; height: 18px; }

.color-pick { position: relative; width: 30px; height: 30px; cursor: pointer; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
.color-pick input[type="color"] { position: absolute; opacity: 0; width: 100%; height: 100%; cursor: pointer; }
.color-swatch { font-size: 16px; line-height: 1; }
.color-swatch.stroke { font-size: 14px; }

.zoom-label { font-size: 11px; color: #888; min-width: 36px; text-align: center; flex-shrink: 0; }

.btn-save { margin: 0 4px; padding: 5px 14px; background: #0078d4; color: #fff; border: none; border-radius: 5px; font-size: 12px; cursor: pointer; white-space: nowrap; flex-shrink: 0; }
.btn-save:hover { background: #106ebe; }
.btn-save:disabled { opacity: 0.5; cursor: default; }
.btn-close { width: 30px; height: 30px; border: none; border-radius: 6px; background: transparent; color: #888; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.btn-close:hover { background: #fde8e8; color: #c62828; }

.editor-body { flex: 1; overflow: auto; display: flex; align-items: flex-start; justify-content: center; padding: 20px; background: #f1f1f1; }
</style>
