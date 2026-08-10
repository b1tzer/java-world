<script setup>
/**
 * SVG 编辑器 — vue-fabric-editor 风格
 *   - 顶部栏：撤销计数、重做计数、保存、关闭
 *   - 左侧工具面板：元素 / 绘制 / 图层 三个标签页
 *   - 中心画布：Fabric.js Canvas
 *
 * props: src, resolveCssVars, mode
 */
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { fabric } from 'fabric'

// ═══════ CSS 变量映射表 ═══════
const LIGHT_VAR_TO_HEX = {
  '--diagram-surface-1':'#FFFFFF','--diagram-surface-2':'#F8F9FA','--diagram-surface-3':'#ECEFF1',
  '--diagram-stroke-1':'#BDBDBD','--diagram-stroke-2':'#E0E0E0',
  '--diagram-text-1':'#333333','--diagram-text-2':'#666666','--diagram-text-3':'#888888',
  '--diagram-accent-1':'#1565C0','--diagram-accent-bg-1':'#E3F2FD','--diagram-accent-bg-1b':'#BBDEFB','--diagram-accent-text-1':'#0D47A1',
  '--diagram-accent-2':'#2E7D32','--diagram-accent-bg-2':'#E8F5E9','--diagram-accent-bg-2b':'#C8E6C9','--diagram-accent-text-2':'#1B5E20',
  '--diagram-accent-3':'#7B1FA2','--diagram-accent-bg-3':'#F3E5F5','--diagram-accent-bg-3b':'#E1BEE7','--diagram-accent-text-3':'#4A148C',
  '--diagram-accent-4':'#E65100','--diagram-accent-bg-4':'#FFF3E0','--diagram-accent-text-4':'#BF360C',
  '--diagram-accent-5':'#C62828','--diagram-accent-bg-5':'#FFCDD2','--diagram-accent-text-5':'#B71C1C',
  '--diagram-arrow':'#555555','--diagram-ghost':'#999999',
}
const LIGHT_HEX_TO_VAR = {}; for (const [k, v] of Object.entries(LIGHT_VAR_TO_HEX)) LIGHT_HEX_TO_VAR[v] = k
const DARK_VAR_TO_HEX = {
  '--diagram-surface-1':'#1E1E1E','--diagram-surface-2':'#252525','--diagram-surface-3':'#2D2D2D',
  '--diagram-stroke-1':'#555555','--diagram-stroke-2':'#444444',
  '--diagram-text-1':'#E0E0E0','--diagram-text-2':'#AAAAAA','--diagram-text-3':'#808080',
  '--diagram-accent-1':'#64B5F6','--diagram-accent-bg-1':'#0D2137','--diagram-accent-bg-1b':'#1A3A5C','--diagram-accent-text-1':'#90CAF9',
  '--diagram-accent-2':'#81C784','--diagram-accent-bg-2':'#1B301B','--diagram-accent-bg-2b':'#2D502D','--diagram-accent-text-2':'#A5D6A7',
  '--diagram-accent-3':'#CE93D8','--diagram-accent-bg-3':'#2D1A34','--diagram-accent-bg-3b':'#4A2D58','--diagram-accent-text-3':'#E1BEE7',
  '--diagram-accent-4':'#FFB74D','--diagram-accent-bg-4':'#3D2100','--diagram-accent-text-4':'#FFCC80',
  '--diagram-accent-5':'#EF9A9A','--diagram-accent-bg-5':'#3D1515','--diagram-accent-text-5':'#EF9A9A',
  '--diagram-arrow':'#999999','--diagram-ghost':'#666666',
}
const DARK_HEX_TO_VAR = {}; for (const [k, v] of Object.entries(DARK_VAR_TO_HEX)) DARK_HEX_TO_VAR[v] = k

// ═══════ Props ═══════
const props = defineProps({
  src:            { type: String, required: true },
  resolveCssVars: { type: [Boolean, String], default: true },
  mode:           { type: String, default: 'light' },
})
const emit = defineEmits(['close', 'saved'])

// ═══════ 状态 ═══════
const canvasRef  = ref(null)
const loading    = ref(true)
const saving     = ref(false)
const canUndo    = ref(0)
const canRedo    = ref(0)
const zoomLevel  = ref(100)
const leftTab    = ref('elements')   // elements | draw | layers
const leftOpen   = ref(false)
const fillColor  = ref('#1565C0')
const strokeColor= ref('#333333')

// 绘图模式
const drawMode   = ref('')           // '' | rect | circle | triangle | line | arrow
const layers     = ref([])           // 图层快照列表

let canvasEditor = null
let canvas       = null
let _keyHandler  = null
let _originalViewBox = ''
let _cssVarEnabled  = false
let _cssVarMode     = 'light'
let _drawObj        = null
let _drawStart      = { x: 0, y: 0 }
let _isDrawing      = false          // 性能：只在绘图时绑定 mouse:move

// ═══════ 左侧标签定义 ═══════
const leftTabs = [
  { key: 'elements', label: '元素', icon: 'shape' },
  { key: 'draw',     label: '绘制', icon: 'draw' },
  { key: 'layers',   label: '图层', icon: 'layer' },
]

// ═══════ 初始化 ═══════

async function initEditor() {
  await nextTick()

  if (props.resolveCssVars === true || props.resolveCssVars === 'true') {
    _cssVarEnabled = true; _cssVarMode = props.mode || 'light'
  } else if (typeof props.resolveCssVars === 'string') {
    _cssVarEnabled = true; _cssVarMode = props.resolveCssVars
  }

  // 加载 SVG
  const base = import.meta.env.BASE_URL || '/'
  const url = props.src.startsWith('/') ? base + props.src.slice(1) : props.src
  let rawSvg = ''
  try {
    const resp = await fetch(url)
    if (resp.ok) rawSvg = await resp.text()
    else { loading.value = false; return }
  } catch (e) { loading.value = false; return }

  const processed = preprocessSvg(rawSvg)

  // 创建 Fabric 画布
  canvas = new fabric.Canvas(canvasRef.value, {
    width:  processed.svgWidth  || 800,
    height: processed.svgHeight || 600,
    fireRightClick: true, stopContextMenu: true,
    controlsAboveOverlay: true, preserveObjectStacking: true,
    backgroundColor: '#f1f1f1',
  })

  // ── 性能优化：只在非选择模式时绑定 drawing 事件 ──
  canvas.on('mouse:down', onMouseDown)

  // 加载 Editor 核心 + 插件（动态导入）
  const [
    { default: Editor }, { default: DringPlugin }, { default: ControlsPlugin },
    { default: LayerPlugin }, { default: CopyPlugin }, { default: GroupPlugin },
    { default: HistoryPlugin }, { default: AlignGuidLinePlugin },
    { default: CenterAlignPlugin }, { default: MoveHotKeyPlugin },
    { default: DeleteHotKeyPlugin },
  ] = await Promise.all([
    import('@kuaitu/core'),
    import('@kuaitu/core/plugin/DringPlugin'),
    import('@kuaitu/core/plugin/ControlsPlugin'),
    import('@kuaitu/core/plugin/LayerPlugin'),
    import('@kuaitu/core/plugin/CopyPlugin'),
    import('@kuaitu/core/plugin/GroupPlugin'),
    import('@kuaitu/core/plugin/HistoryPlugin'),
    import('@kuaitu/core/plugin/AlignGuidLinePlugin'),
    import('@kuaitu/core/plugin/CenterAlignPlugin'),
    import('@kuaitu/core/plugin/MoveHotKeyPlugin'),
    import('@kuaitu/core/plugin/DeleteHotKeyPlugin'),
  ])

  canvasEditor = new Editor()
  canvasEditor.init(canvas)
  canvasEditor.use(DringPlugin).use(ControlsPlugin).use(LayerPlugin)
    .use(CopyPlugin).use(GroupPlugin).use(HistoryPlugin)
    .use(AlignGuidLinePlugin).use(CenterAlignPlugin)
    .use(MoveHotKeyPlugin).use(DeleteHotKeyPlugin)

  // 监听历史变更
  if (canvasEditor.getPlugin?.('HistoryPlugin')) {
    canvasEditor.on('historyUpdate', (undo, redo) => {
      canUndo.value = undo; canRedo.value = redo
    })
  }

  try { await loadSvgToCanvas(processed.svg) } catch (e) { /* */ }
  loading.value = false
  updateLayerList()

  _keyHandler = (e) => { if (e.key === 'Escape') emit('close') }
  document.addEventListener('keydown', _keyHandler)
}

onMounted(() => initEditor())
onUnmounted(() => {
  if (_keyHandler) document.removeEventListener('keydown', _keyHandler)
  if (canvasEditor) canvasEditor.destory()
  canvas = null; canvasEditor = null
})

// ═══════ SVG 处理 ═══════
function preprocessSvg(svg) {
  let s = svg.replace(/<\?xml[^?]*\?>\s*/g, '')
  if (_cssVarEnabled) {
    const varmap = _cssVarMode === 'dark' ? DARK_VAR_TO_HEX : LIGHT_VAR_TO_HEX
    for (const [k, v] of Object.entries(varmap)) s = s.replaceAll(`var(${k})`, v)
  }
  s = s.replace(/<stop(\s[^>]*?)style="stop-color:\s*([^;"]+);\s*stop-opacity:\s*([^"]+)"([^>]*?)>/g,
    '<stop$1stop-color="$2" stop-opacity="$3"$4>')
  const vb  = (s.match(/viewBox="([^"]+)"/) || [])[1] || ''
  const parts = vb.split(/[\s,]+/).map(Number)
  _originalViewBox = vb
  return { svg: s, svgWidth: parts[2]|0, svgHeight: parts[3]|0 }
}

function loadSvgToCanvas(svgContent) {
  return new Promise((resolve, reject) => {
    fabric.loadSVGFromString(svgContent, (objects) => {
      if (!objects?.length) { reject(new Error('空')); return }
      objects.forEach(o => canvas.add(o))
      canvas.requestRenderAll()
      canvas.fire('object:modified')
      resolve(true)
    })
  })
}

// ═══════ 绘图（mousedown → mousemove → mouseup）═══════
function onMouseDown(opt) {
  if (!drawMode.value) return
  const ptr = canvas.getPointer(opt.e)
  _drawStart = { x: ptr.x, y: ptr.y }
  const f = fillColor.value, s = strokeColor.value

  if (drawMode.value === 'rect') {
    _drawObj = new fabric.Rect({ left: ptr.x, top: ptr.y, width: 1, height: 1, fill: f, stroke: s, strokeWidth: s ? 1.5 : 0, rx: 3, ry: 3 })
  } else if (drawMode.value === 'circle') {
    _drawObj = new fabric.Ellipse({ left: ptr.x, top: ptr.y, rx: 1, ry: 1, fill: f, stroke: s, strokeWidth: s ? 1.5 : 0, originX: 'center', originY: 'center' })
  } else if (drawMode.value === 'triangle') {
    _drawObj = new fabric.Triangle({ left: ptr.x, top: ptr.y, width: 1, height: 1, fill: f, stroke: s, strokeWidth: s ? 1.5 : 0 })
  } else if (drawMode.value === 'line' || drawMode.value === 'arrow') {
    _drawObj = new fabric.Line([ptr.x, ptr.y, ptr.x, ptr.y], { stroke: s || '#333', strokeWidth: 2 })
  }
  if (_drawObj) {
    canvas.add(_drawObj)
    canvas.requestRenderAll()
    // 只在绘图时绑定 move / up
    if (!_isDrawing) { _isDrawing = true; canvas.on('mouse:move', onMouseMove); canvas.on('mouse:up', onMouseUp) }
  }
}

function onMouseMove(opt) {
  if (!_drawObj) return
  const ptr = canvas.getPointer(opt.e)
  const { x, y } = _drawStart
  if (drawMode.value === 'rect' || drawMode.value === 'triangle') {
    _drawObj.set({ width: Math.abs(ptr.x - x), height: Math.abs(ptr.y - y) })
    if (ptr.x < x) _drawObj.set({ left: ptr.x })
    if (ptr.y < y) _drawObj.set({ top: ptr.y })
  } else if (drawMode.value === 'circle') {
    _drawObj.set({ rx: Math.abs(ptr.x - x), ry: Math.abs(ptr.y - y) })
  } else if (drawMode.value === 'line' || drawMode.value === 'arrow') {
    _drawObj.set({ x2: ptr.x, y2: ptr.y })
  }
  canvas.requestRenderAll()
}

function onMouseUp() {
  if (_drawObj) {
    const tooSmall = (_drawObj.width !== undefined && _drawObj.width < 5) ||
      (_drawObj.rx !== undefined && _drawObj.rx < 3)
    if (tooSmall) canvas.remove(_drawObj)
    else { canvas.fire('object:modified'); updateLayerList() }
  }
  _drawObj = null
  // 解绑 move / up
  canvas.off('mouse:move'); canvas.off('mouse:up')
  _isDrawing = false
  // 回到选择模式
  drawMode.value = ''
  canvas.selection = true
  canvas.getObjects().forEach(o => { o.selectable = true; o.evented = true })
  canvas.requestRenderAll()
}

// ═══════ 工具操作 ═══════
function activateDraw(mode) {
  drawMode.value = mode
  canvas.selection = false; canvas.discardActiveObject()
  canvas.getObjects().forEach(o => { o.selectable = false; o.evented = false })
  canvas.requestRenderAll()
  leftOpen.value = false
}

function addText() {
  const t = new fabric.IText('双击编辑', {
    left: canvas.width / 2 - 60, top: canvas.height / 2 - 10,
    fontSize: 20, fill: fillColor.value, fontFamily: 'Arial',
  })
  canvas.add(t); canvas.setActiveObject(t); canvas.requestRenderAll()
  canvas.fire('object:modified'); updateLayerList()
  leftOpen.value = false
}

function undo()     { canvasEditor?.undo?.(); updateLayerList() }
function redo()     { canvasEditor?.redo?.(); updateLayerList() }
function del()      { canvasEditor?.del?.(); updateLayerList() }
function bringFwd() { canvasEditor?.up?.(); updateLayerList() }
function sendBack() { canvasEditor?.down?.(); updateLayerList() }
function grp()      { canvasEditor?.group?.(); updateLayerList() }
function ungrp()    { canvasEditor?.unGroup?.(); updateLayerList() }
function clone()    { canvasEditor?.clone?.(); updateLayerList() }

function zoomIn()   { let z = canvas.getZoom() * 1.15; canvas.zoomToPoint(new fabric.Point(canvas.width / 2, canvas.height / 2), z); zl() }
function zoomOut()  { let z = canvas.getZoom() / 1.15; if (z < 0.02) z = 0.02; canvas.zoomToPoint(new fabric.Point(canvas.width / 2, canvas.height / 2), z); zl() }
function zoomFit() {
  const objs = canvas.getObjects(); if (!objs.length) return
  const b = objs.reduce((a, o) => { const r = o.getBoundingRect(); return { l: Math.min(a.l, r.left), t: Math.min(a.t, r.top), r: Math.max(a.r, r.left + r.width), b: Math.max(a.b, r.top + r.height) } }, { l: 1e9, t: 1e9, r: -1e9, b: -1e9 })
  if (b.r <= b.l || b.b <= b.t) return
  canvas.zoomToPoint(new fabric.Point(canvas.width / 2, canvas.height / 2), Math.min(canvas.width / (b.r - b.l), canvas.height / (b.b - b.t)) * 0.85); zl()
}
function zl() { zoomLevel.value = Math.round(canvas.getZoom() * 100) }

function updateLayerList() {
  if (!canvas) return
  layers.value = canvas.getObjects().filter(o => o.id !== 'workspace').map(o => ({
    id: o.id || o._uid || Math.random().toString(36).slice(2),
    name: o.type === 'i-text' ? (o.text || '').substring(0, 16) : o.name || o.type,
    type: o.type,
    visible: o.visible !== false,
    selected: o === canvas.getActiveObject(),
  }))
}

function toggleLayerVisible(layer) {
  const obj = canvas.getObjects().find(o => (o.id || o._uid) === layer.id)
  if (!obj) return
  obj.visible = !obj.visible; canvas.requestRenderAll(); updateLayerList()
}

function toggleTab(tab) {
  if (leftTab.value === tab && leftOpen.value) { leftOpen.value = false; return }
  leftTab.value = tab; leftOpen.value = true
}

// ═══════ 保存 ═══════
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
  s = s.replace(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/gi, (_, r, g, b) => '#' + [r, g, b].map(x => parseInt(x).toString(16).padStart(2, '0').toUpperCase()).join(''))
  const hexMap = _cssVarMode === 'dark' ? DARK_HEX_TO_VAR : LIGHT_HEX_TO_VAR
  for (const [hex, vn] of Object.entries(hexMap)) s = s.replace(new RegExp(hex, 'gi'), `var(${vn})`)
  if (_originalViewBox) s = s.replace(/viewBox="[^"]*"/, `viewBox="${_originalViewBox}"`)
  s = s.replace(/\s+width="[^"]*"/, '').replace(/\s+height="[^"]*"/, '')
  s = s.replace(/<rect\s+x="0"\s+y="0"\s+width="100%"\s+height="100%"\s+fill="#F5F5F5"\s*\/?>\s*/gi, '')
  return s.replace(/\n\s*\n/g, '\n').trim()
}
</script>

<template>
  <div class="editor-overlay" @click.self="emit('close')">
    <div class="editor-panel">

      <!-- ═══════ 顶部工具栏 ═══════ -->
      <div class="editor-topbar">
        <span class="topbar-title" :title="src">{{ src.split('/').pop() }}</span>
        <div class="topbar-divider" />

        <button class="topbar-btn" @click="undo" :disabled="!canUndo" title="撤销">
          <svg viewBox="0 0 24 24"><path d="M3 7v6h6M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          <span v-if="canUndo" class="badge">{{ canUndo }}</span>
        </button>
        <button class="topbar-btn" @click="redo" :disabled="!canRedo" title="重做">
          <svg viewBox="0 0 24 24"><path d="M21 7v6h-6M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          <span v-if="canRedo" class="badge">{{ canRedo }}</span>
        </button>

        <div class="topbar-divider" />

        <button class="topbar-btn" @click="del" title="删除">
          <svg viewBox="0 0 24 24"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <button class="topbar-btn" @click="clone" title="复制">
          <svg viewBox="0 0 24 24"><rect width="14" height="14" x="8" y="8" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" fill="none" stroke="currentColor" stroke-width="2"/></svg>
        </button>

        <div class="topbar-divider" />

        <button class="topbar-btn" @click="bringFwd" title="上移一层">↑</button>
        <button class="topbar-btn" @click="sendBack" title="下移一层">↓</button>
        <button class="topbar-btn" @click="grp" title="组合">◫</button>
        <button class="topbar-btn" @click="ungrp" title="取消组合">▦</button>

        <div class="topbar-divider" />

        <span class="topbar-label" @click="zoomOut" title="缩小">−</span>
        <span class="topbar-zoom">{{ zoomLevel }}%</span>
        <span class="topbar-label" @click="zoomIn" title="放大">+</span>
        <span class="topbar-label" @click="zoomFit" title="适应画布" style="font-size:10px">⊡</span>

        <div class="topbar-spacer" />

        <span v-if="loading" class="topbar-info">加载中…</span>
        <span v-if="saving" class="topbar-info">保存中…</span>
        <button class="topbar-save" @click="handleSave" :disabled="saving">💾 保存</button>
        <button class="topbar-close" @click="emit('close')" title="关闭 (Esc)">✕</button>
      </div>

      <!-- ═══════ 主体：左侧面板 + 画布 ═══════ -->
      <div class="editor-main">
        <!-- 左侧图标栏 -->
        <div class="left-tab-bar">
          <button
            v-for="tab in leftTabs" :key="tab.key"
            class="left-tab-btn"
            :class="{ active: leftTab === tab.key && leftOpen }"
            @click="toggleTab(tab.key)"
            :title="tab.label"
          >
            <!-- 元素图标 -->
            <svg v-if="tab.icon === 'shape'" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8">
              <rect x="3" y="3" width="18" height="18" rx="3"/>
            </svg>
            <!-- 绘制图标 -->
            <svg v-if="tab.icon === 'draw'" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            <!-- 图层图标 -->
            <svg v-if="tab.icon === 'layer'" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="M2 17 12 22L22 17"/><path d="M2 12 12 17L22 12"/>
            </svg>
            <span class="tab-label">{{ tab.label }}</span>
          </button>
        </div>

        <!-- 工具面板 -->
        <div v-if="leftOpen" class="left-panel">
          <!-- 元素面板 -->
          <div v-if="leftTab === 'elements'" class="panel-content">
            <div class="panel-section-title">基本形状</div>
            <div class="shape-grid">
              <div class="shape-item" @click="activateDraw('rect')">
                <svg viewBox="0 0 24 24" width="32" height="32" :stroke="fillColor" fill="none" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/></svg>
                <span>矩形</span>
              </div>
              <div class="shape-item" @click="activateDraw('circle')">
                <svg viewBox="0 0 24 24" width="32" height="32" :stroke="fillColor" fill="none" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>
                <span>圆形</span>
              </div>
              <div class="shape-item" @click="activateDraw('triangle')">
                <svg viewBox="0 0 24 24" width="32" height="32" :stroke="fillColor" fill="none" stroke-width="2"><polygon points="12,3 21,21 3,21"/></svg>
                <span>三角形</span>
              </div>
              <div class="shape-item" @click="addText">
                <svg viewBox="0 0 24 24" width="32" height="32" :stroke="fillColor" fill="none" stroke-width="2"><text x="3" y="20" font-size="24" font-weight="bold" fill="currentColor" font-family="Arial">T</text></svg>
                <span>文字</span>
              </div>
            </div>
            <div class="panel-section-title">颜色</div>
            <div class="color-row">
              <label class="color-label">填充</label>
              <input type="color" v-model="fillColor" class="color-input" />
              <label class="color-label" style="margin-left:10px">描边</label>
              <input type="color" v-model="strokeColor" class="color-input" />
            </div>
          </div>

          <!-- 绘制面板 -->
          <div v-if="leftTab === 'draw'" class="panel-content">
            <div class="panel-section-title">直线工具</div>
            <div class="shape-grid">
              <div class="shape-item" :class="{ active: drawMode === 'line' }" @click="activateDraw('line')">
                <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" fill="none" stroke-width="2"><line x1="4" y1="20" x2="20" y2="4"/></svg>
                <span>直线</span>
              </div>
              <div class="shape-item" :class="{ active: drawMode === 'arrow' }" @click="activateDraw('arrow')">
                <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" fill="none" stroke-width="2"><path d="M5 19 19 5"/><polyline points="19 5 19 11 13 5"/></svg>
                <span>箭头</span>
              </div>
            </div>
            <p class="panel-hint">点击画布拖拽绘制<br/>Esc 或再次点击工具栏取消</p>
          </div>

          <!-- 图层面板 -->
          <div v-if="leftTab === 'layers'" class="panel-content">
            <div class="panel-section-title">图层列表</div>
            <div v-if="!layers.length" class="panel-empty">画布上暂无对象</div>
            <div v-for="(layer, i) in layers" :key="layer.id" class="layer-row" @click="canvas.setActiveObject(canvas.getObjects().find(o => (o.id || o._uid) === layer.id)); canvas.requestRenderAll(); updateLayerList()"
              :class="{ selected: layer.selected }">
              <span class="layer-icon" :class="{ hidden: !layer.visible }" @click.stop="toggleLayerVisible(layer)">👁</span>
              <span class="layer-type">{{ layer.type }}</span>
              <span class="layer-name">{{ layer.name }}</span>
            </div>
          </div>
        </div>

        <!-- 画布区域 -->
        <div class="canvas-wrap">
          <canvas ref="canvasRef" id="svg-editor-canvas"></canvas>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* ═══════ 覆盖层 ═══════ */
.editor-overlay { position: fixed; inset: 0; z-index: 9999; background: rgba(15,15,15,.75); backdrop-filter: blur(12px); display: flex; align-items: center; justify-content: center; animation: ovIn .2s ease; }
@keyframes ovIn { from { opacity: 0 } to { opacity: 1 } }
.editor-panel { width: 95vw; height: 90vh; background: #fff; border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 32px 80px rgba(0,0,0,.4); animation: pnIn .25s cubic-bezier(.16,1,.3,1); }
@keyframes pnIn { from { opacity: 0; transform: scale(.96) translateY(8px) } to { opacity: 1; transform: scale(1) translateY(0) } }

/* ═══════ 顶部工具栏 ═══════ */
.editor-topbar { display: flex; align-items: center; gap: 2px; padding: 5px 10px; background: #f8f9fa; border-bottom: 1px solid #e0e0e0; flex-shrink: 0; min-height: 40px; }
.topbar-divider { width: 1px; height: 22px; background: #ddd; margin: 0 5px; flex-shrink: 0; }
.topbar-title { font-size: 12px; color: #999; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 6px; flex-shrink: 0; }
.topbar-info { font-size: 11px; color: #aaa; margin: 0 6px; flex-shrink: 0; }
.topbar-spacer { flex: 1; }
.topbar-btn { position: relative; width: 30px; height: 30px; border: none; border-radius: 5px; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #555; flex-shrink: 0; padding: 0; }
.topbar-btn:hover { background: #e8e8e8; color: #333; }
.topbar-btn:disabled { opacity: 0.3; cursor: default; background: transparent; }
.topbar-btn svg { width: 18px; height: 18px; }
.badge { position: absolute; top: -2px; right: -4px; background: #1565C0; color: #fff; font-size: 10px; border-radius: 8px; padding: 0 4px; min-width: 14px; text-align: center; line-height: 14px; }
.topbar-label { width: 24px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 16px; color: #777; cursor: pointer; border-radius: 4px; flex-shrink: 0; }
.topbar-label:hover { background: #e8e8e8; color: #333; }
.topbar-zoom { font-size: 11px; color: #888; min-width: 34px; text-align: center; flex-shrink: 0; }
.topbar-save { margin: 0 4px; padding: 4px 14px; background: #0078d4; color: #fff; border: none; border-radius: 5px; font-size: 12px; cursor: pointer; white-space: nowrap; flex-shrink: 0; }
.topbar-save:hover { background: #106ebe; }
.topbar-save:disabled { opacity: 0.5; cursor: default; }
.topbar-close { width: 30px; height: 30px; border: none; border-radius: 6px; background: transparent; color: #999; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.topbar-close:hover { background: #fde8e8; color: #c62828; }

/* ═══════ 主体 ═══════ */
.editor-main { flex: 1; display: flex; overflow: hidden; }

/* ═══════ 左侧图标栏 ═══════ */
.left-tab-bar { width: 56px; background: #f5f5f5; border-right: 1px solid #e8e8e8; display: flex; flex-direction: column; padding: 6px 0; flex-shrink: 0; }
.left-tab-btn { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 10px 0; border: none; background: transparent; cursor: pointer; color: #777; font-size: 10px; width: 100%; }
.left-tab-btn:hover { background: #eaeaea; color: #444; }
.left-tab-btn.active { background: #e3edf7; color: #1565C0; }
.tab-label { line-height: 1; }

/* ═══════ 工具面板 ═══════ */
.left-panel { width: 220px; border-right: 1px solid #e8e8e8; background: #fafafa; overflow-y: auto; flex-shrink: 0; }
.panel-content { padding: 12px; }
.panel-section-title { font-size: 11px; color: #888; font-weight: 600; text-transform: uppercase; margin: 10px 0 6px; padding-bottom: 4px; border-bottom: 1px solid #eee; }
.panel-section-title:first-child { margin-top: 0; }
.shape-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.shape-item { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 4px; background: #fff; border: 1px solid #e8e8e8; border-radius: 6px; cursor: pointer; font-size: 10px; color: #666; transition: all .15s; }
.shape-item:hover { border-color: #1565C0; color: #1565C0; }
.shape-item.active { border-color: #1565C0; background: #e3edf7; color: #1565C0; }
.color-row { display: flex; align-items: center; gap: 4px; padding: 4px 0; }
.color-label { font-size: 11px; color: #777; }
.color-input { width: 26px; height: 26px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; padding: 0; }
.panel-hint { font-size: 10px; color: #aaa; text-align: center; margin-top: 12px; line-height: 1.6; }
.panel-empty { font-size: 11px; color: #aaa; text-align: center; padding: 20px 0; }

/* ═══════ 图层列表 ═══════ */
.layer-row { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; border: 1px solid transparent; margin-bottom: 2px; }
.layer-row:hover { background: #f0f0f0; }
.layer-row.selected { border-color: #1565C0; background: #e3edf7; }
.layer-icon { cursor: pointer; font-size: 13px; opacity: 1; }
.layer-icon.hidden { opacity: 0.25; }
.layer-type { color: #aaa; font-size: 10px; min-width: 36px; text-transform: uppercase; }
.layer-name { color: #555; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ═══════ 画布 ═══════ */
.canvas-wrap { flex: 1; overflow: auto; display: flex; align-items: flex-start; justify-content: center; padding: 24px; background: #f1f1f1; }
</style>
