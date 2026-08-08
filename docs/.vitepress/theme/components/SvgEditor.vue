<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'

const props = defineProps({
  src: { type: String, required: true }
})
const emit = defineEmits(['close', 'saved'])

const canvasRef = ref(null)
const fabricCanvas = ref(null)
const loading = ref(true)
const saving = ref(false)
const zoomLevel = ref(100)
const selectionInfo = ref('')
const currentFill = ref('')
const currentStroke = ref('')
const currentFontSize = ref(12)

// CSS 变量色彩方案
const CSS_COLORS = {
  '#E3F2FD': '--diagram-accent-bg-1', '#1565C0': '--diagram-accent-1', '#0D47A1': '--diagram-accent-text-1',
  '#E8F5E9': '--diagram-accent-bg-2', '#2E7D32': '--diagram-accent-2', '#1B5E20': '--diagram-accent-text-2',
  '#F3E5F5': '--diagram-accent-bg-3', '#7B1FA2': '--diagram-accent-3', '#4A148C': '--diagram-accent-text-3',
  '#FFF3E0': '--diagram-accent-bg-4', '#E65100': '--diagram-accent-4', '#BF360C': '--diagram-accent-text-4',
  '#FFCDD2': '--diagram-accent-bg-5', '#C62828': '--diagram-accent-5', '#B71C1C': '--diagram-accent-text-5',
  '#FFFFFF': '--diagram-surface-1', '#F8F9FA': '--diagram-surface-2',
  '#333333': '--diagram-text-1', '#666666': '--diagram-text-2', '#888888': '--diagram-text-3',
  '#555555': '--diagram-arrow',
}
const VAR_TO_HEX = {}
for (const [hex, v] of Object.entries(CSS_COLORS)) VAR_TO_HEX[v] = hex

let undoStack = []
let redoStack = []

async function loadAndInit() {
  loading.value = true
  await nextTick()

  // 动态加载 Fabric.js
  if (!window.fabric) {
    await new Promise((resolve) => {
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js'
      s.onload = resolve
      document.head.appendChild(s)
    })
  }

  const base = import.meta.env.BASE_URL || '/'
  const url = props.src.startsWith('/') ? base + props.src.slice(1) : props.src
  const resp = await fetch(url)
  let svgText = await resp.text()
  svgText = svgText.replace(/<\?xml[^?]*\?>\s*/g, '')

  // CSS 变量 → 色值
  let renderSvg = svgText
  for (const [varName, hex] of Object.entries(VAR_TO_HEX)) {
    renderSvg = renderSvg.replaceAll(`var(${varName})`, hex)
  }

  const container = canvasRef.value
  if (!container) return
  const w = container.clientWidth
  const h = Math.max(500, container.clientHeight)

  const fc = new window.fabric.Canvas(container.querySelector('canvas'), {
    width: w,
    height: h,
    backgroundColor: '#f5f5f5',
    selection: true,
    preserveObjectStacking: true,
  })

  // 控制点样式
  window.fabric.Object.prototype.set({
    transparentCorners: false,
    cornerSize: 10,
    cornerStrokeColor: '#0078d4',
    cornerColor: '#ffffff',
    cornerStyle: 'circle',
    borderColor: '#0078d4',
    borderScaleFactor: 1.5,
    borderDashArray: [4, 2],
    padding: 6,
  })

  // 加载 SVG
  window.fabric.loadSVGFromString(renderSvg, (objects, options) => {
    // 合并箭头
    const merged = mergeArrows(objects)
    merged.forEach(obj => {
      obj.set({ selectable: true, evented: true })
      fc.add(obj)
    })
    zoomFit(fc)
    saveState(fc)
    loading.value = false
    fabricCanvas.value = fc
  })

  // 事件
  fc.on('selection:created', () => updateSelection(fc))
  fc.on('selection:updated', () => updateSelection(fc))
  fc.on('selection:cleared', () => { selectionInfo.value = '' })
  fc.on('object:modified', () => saveState(fc))

  // 快捷键
  const keyHandler = (e) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(fc) }
      if (e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(fc) }
      if (e.key === 'y') { e.preventDefault(); redo(fc) }
      if (e.key === 'c') { e.preventDefault(); copyObj(fc) }
      if (e.key === 'v') { e.preventDefault(); pasteObj(fc) }
      if (e.key === 's') { e.preventDefault(); save() }
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault(); deleteObj(fc)
      }
    }
    if (e.key === 'Escape') emit('close')
  }
  document.addEventListener('keydown', keyHandler)
  onUnmounted(() => document.removeEventListener('keydown', keyHandler))
}

function mergeArrows(objects) {
  const result = []
  const used = new Set()
  for (let i = 0; i < objects.length; i++) {
    if (used.has(i)) continue
    const obj = objects[i]
    if (obj.type === 'line' && i + 1 < objects.length) {
      const next = objects[i + 1]
      if (next.type === 'polygon' && !used.has(i + 1)) {
        const dist = Math.sqrt(((obj.x2 || 0) - ((next.left || 0) + (next.width || 0) / 2)) ** 2 + ((obj.y2 || 0) - ((next.top || 0) + (next.height || 0) / 2)) ** 2)
        if (dist < 30) {
          result.push(new window.fabric.Group([obj, next], { selectable: true, evented: true }))
          used.add(i); used.add(i + 1); continue
        }
      }
    }
    result.push(obj); used.add(i)
  }
  return result
}

function zoomFit(fc) {
  const objects = fc.getObjects()
  if (!objects.length) return
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  objects.forEach(o => {
    const b = o.getBoundingRect()
    minX = Math.min(minX, b.left); minY = Math.min(minY, b.top)
    maxX = Math.max(maxX, b.left + b.width); maxY = Math.max(maxY, b.top + b.height)
  })
  const bw = maxX - minX, bh = maxY - minY
  const cw = fc.width, ch = fc.height
  const z = Math.min((cw - 60) / bw, (ch - 60) / bh, 2)
  fc.setZoom(z)
  fc.viewportTransform[4] = (cw - bw * z) / 2 - minX * z
  fc.viewportTransform[5] = (ch - bh * z) / 2 - minY * z
  fc.requestRenderAll()
  zoomLevel.value = Math.round(z * 100)
}

function updateSelection(fc) {
  const active = fc.getActiveObject()
  if (!active) return
  const isMulti = active.type === 'activeSelection'
  selectionInfo.value = isMulti ? `${active._objects.length} 个选中` : active.type
  if (active.fill && typeof active.fill === 'string') currentFill.value = active.fill
  if (active.stroke && typeof active.stroke === 'string') currentStroke.value = active.stroke
  if (active.fontSize) currentFontSize.value = active.fontSize
}

function saveState(fc) {
  if (!fc) return
  undoStack.push(fc.toJSON(['selectable', 'evented']))
  if (undoStack.length > 30) undoStack.shift()
  redoStack = []
}
function undo(fc) { if (undoStack.length < 2) return; redoStack.push(undoStack.pop()); fc.loadFromJSON(undoStack[undoStack.length - 1], () => fc.renderAll()) }
function redo(fc) { if (!redoStack.length) return; const s = redoStack.pop(); undoStack.push(s); fc.loadFromJSON(s, () => fc.renderAll()) }
function copyObj(fc) { const a = fc.getActiveObject(); if (a) a.clone(c => { window._clipboard = c }) }
function pasteObj(fc) { if (!window._clipboard) return; window._clipboard.clone(c => { c.set({ left: c.left + 20, top: c.top + 20 }); fc.add(c); fc.setActiveObject(c); fc.renderAll(); saveState(fc) }) }
function deleteObj(fc) { const a = fc.getActiveObject(); if (!a) return; if (a.type === 'activeSelection') { a.forEachObject(o => fc.remove(o)); fc.discardActiveObject() } else { fc.remove(a) } fc.renderAll(); saveState(fc) }

// 对齐
function align(fc, type) {
  const objs = fc.getActiveObject()?._objects
  if (!objs || objs.length < 2) return
  if (type === 'left') { const m = Math.min(...objs.map(o => o.left)); objs.forEach(o => o.set('left', m)) }
  if (type === 'centerH') { const a = objs.reduce((s, o) => s + o.left + o.width * (o.scaleX || 1) / 2, 0) / objs.length; objs.forEach(o => o.set('left', a - o.width * (o.scaleX || 1) / 2)) }
  if (type === 'right') { const m = Math.max(...objs.map(o => o.left + o.width * (o.scaleX || 1))); objs.forEach(o => o.set('left', m - o.width * (o.scaleX || 1))) }
  if (type === 'top') { const m = Math.min(...objs.map(o => o.top)); objs.forEach(o => o.set('top', m)) }
  if (type === 'centerV') { const a = objs.reduce((s, o) => s + o.top + o.height * (o.scaleY || 1) / 2, 0) / objs.length; objs.forEach(o => o.set('top', a - o.height * (o.scaleY || 1) / 2)) }
  if (type === 'bottom') { const m = Math.max(...objs.map(o => o.top + o.height * (o.scaleY || 1))); objs.forEach(o => o.set('top', m - o.height * (o.scaleY || 1))) }
  fc.renderAll(); saveState(fc)
}

function applyFill(fc, hex) { const a = fc.getActiveObject(); if (a) { a.set('fill', hex); fc.renderAll(); saveState(fc) } }
function applyStroke(fc, hex) { const a = fc.getActiveObject(); if (a) { a.set('stroke', hex); fc.renderAll(); saveState(fc) } }

async function save() {
  if (!fabricCanvas.value) return
  saving.value = true
  const fc = fabricCanvas.value
  let svgText = fc.toSVG()

  // 色值 → CSS 变量
  for (const [hex, info] of Object.entries(CSS_COLORS)) {
    svgText = svgText.replace(new RegExp(hex, 'gi'), `var(${info})`)
  }

  // 发送到 dev server 保存
  try {
    const resp = await fetch('/__svg-save__', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: props.src, content: svgText }),
    })
    if (resp.ok) {
      emit('saved')
      emit('close')
    } else {
      alert('保存失败: ' + await resp.text())
    }
  } catch (e) {
    alert('保存失败: ' + e.message)
  }
  saving.value = false
}

onMounted(loadAndInit)
</script>

<template>
  <div class="editor-overlay" @click.self="emit('close')">
    <div class="editor-panel">
      <!-- 工具栏 -->
      <div class="editor-toolbar">
        <span class="title">✏️ {{ src }}</span>
        <div class="sep" />
        <button @click="undo(fabricCanvas)" title="撤销">↩</button>
        <button @click="redo(fabricCanvas)" title="重做">↪</button>
        <div class="sep" />
        <button @click="copyObj(fabricCanvas)" title="复制">📋</button>
        <button @click="pasteObj(fabricCanvas)" title="粘贴">📌</button>
        <button @click="deleteObj(fabricCanvas)" title="删除">🗑</button>
        <div class="sep" />
        <button @click="zoomFit(fabricCanvas)" title="适应画布">⊞</button>
        <span class="info">{{ zoomLevel }}%</span>
        <div class="sep" />
        <div class="align-group">
          <button @click="align(fabricCanvas,'left')" title="左对齐">⫷</button>
          <button @click="align(fabricCanvas,'centerH')" title="水平居中">⫿</button>
          <button @click="align(fabricCanvas,'right')" title="右对齐">⫸</button>
          <button @click="align(fabricCanvas,'top')" title="顶对齐">⫠</button>
          <button @click="align(fabricCanvas,'centerV')" title="垂直居中">⫟</button>
          <button @click="align(fabricCanvas,'bottom')" title="底对齐">⫡</button>
        </div>
        <div class="spacer" />
        <span class="info">{{ selectionInfo }}</span>
        <div class="sep" />
        <div class="color-row">
          <span class="label">填充</span>
          <input type="color" :value="currentFill" @input="applyFill(fabricCanvas, $event.target.value)" />
          <span class="label">边框</span>
          <input type="color" :value="currentStroke" @input="applyStroke(fabricCanvas, $event.target.value)" />
        </div>
        <div class="sep" />
        <button class="btn-save" @click="save" :disabled="saving">{{ saving ? '保存中...' : '💾 保存' }}</button>
        <button @click="emit('close')">✕</button>
      </div>

      <!-- 画布 -->
      <div class="editor-canvas" ref="canvasRef">
        <canvas />
        <div v-if="loading" class="loading">加载中...</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
}
.editor-panel {
  width: 90vw; height: 85vh; background: #1e1e1e;
  border-radius: 8px; overflow: hidden; display: flex; flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
}
.editor-toolbar {
  display: flex; align-items: center; gap: 4px;
  padding: 6px 12px; background: #252526; border-bottom: 1px solid #3e3e3e;
  flex-shrink: 0; flex-wrap: wrap;
}
.editor-toolbar .title { font-size: 12px; color: #ccc; font-weight: 600; white-space: nowrap; }
.editor-toolbar .sep { width: 1px; height: 20px; background: #3e3e3e; margin: 0 4px; }
.editor-toolbar button {
  width: 28px; height: 28px; border: none; border-radius: 4px;
  background: transparent; color: #ccc; cursor: pointer; font-size: 14px;
  display: flex; align-items: center; justify-content: center;
}
.editor-toolbar button:hover { background: #3e3e3e; }
.editor-toolbar .info { font-size: 11px; color: #888; min-width: 40px; text-align: center; }
.editor-toolbar .spacer { flex: 1; }
.editor-toolbar .btn-save {
  width: auto; padding: 0 12px; background: #0078d4; color: #fff;
  font-size: 12px; font-weight: 600;
}
.editor-toolbar .btn-save:hover { background: #1a8cff; }
.editor-toolbar .btn-save:disabled { opacity: 0.5; cursor: default; }
.align-group { display: flex; gap: 1px; }
.color-row { display: flex; align-items: center; gap: 4px; }
.color-row .label { font-size: 10px; color: #888; }
.color-row input[type="color"] { width: 24px; height: 24px; border: 1px solid #555; border-radius: 3px; cursor: pointer; padding: 0; }
.editor-canvas { flex: 1; position: relative; overflow: hidden; }
.editor-canvas canvas { position: absolute; top: 0; left: 0; }
.loading {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: #1e1e1e; color: #888; font-size: 14px;
}
</style>
