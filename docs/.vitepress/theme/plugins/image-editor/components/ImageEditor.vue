<template>
  <div class="ie-container ie-editor" :style="themeVars" :class="{ 'ie-fullscreen': isFullscreen }">
    <!-- 顶部工具栏 -->
    <div class="ie-editor-toolbar">
      <button class="ie-toolbar-btn" title="撤销 (Ctrl+Z)" :disabled="!canUndo" @click="undo">
        <svg viewBox="0 0 24 24"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>
      </button>
      <button class="ie-toolbar-btn" title="重做 (Ctrl+Shift+Z)" :disabled="!canRedo" @click="redo">
        <svg viewBox="0 0 24 24"><path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/></svg>
      </button>
      <div class="ie-toolbar-divider"></div>
      <button class="ie-toolbar-btn" title="组合 (Ctrl+G)" @click="group">_grp</button>
      <button class="ie-toolbar-btn" title="取消组合" @click="unGroup">_ung</button>
      <div class="ie-toolbar-divider"></div>
      <button class="ie-toolbar-btn" title="水平翻转" @click="flipX">⇔</button>
      <button class="ie-toolbar-btn" title="垂直翻转" @click="flipY">⇕</button>
      <div class="ie-toolbar-divider"></div>
      <button class="ie-toolbar-btn" title="锁定" @click="lock">🔒</button>
      <button class="ie-toolbar-btn" title="解锁" @click="unlock">🔓</button>
      <div class="ie-toolbar-divider"></div>
      <button class="ie-toolbar-btn" title="水平居中" @click="centerH">⫼</button>
      <button class="ie-toolbar-btn" title="垂直居中" @click="centerV">⫽</button>
      <div class="ie-toolbar-divider"></div>
      <button class="ie-toolbar-btn" title="导出 PNG" @click="saveImg">↓P</button>
      <button class="ie-toolbar-btn" title="导出 JSON" @click="saveJson">↓J</button>
      <div class="ie-toolbar-spacer"></div>
      <button class="ie-toolbar-btn" :title="isFullscreen ? '退出全屏' : '全屏'" @click="toggleFullscreen">
        <svg viewBox="0 0 24 24">
          <path v-if="!isFullscreen" d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
          <path v-else d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
        </svg>
      </button>
    </div>

    <!-- 主内容区 -->
    <div class="ie-editor-body">
      <!-- 左侧工具栏 -->
      <div class="ie-tool-panel">
        <button v-for="tool in tools" :key="tool.id" class="ie-tool-btn" :class="{ active: activeTool === tool.id }" :title="tool.label" @click="setActiveTool(tool.id)">
          <span v-html="tool.icon"></span>
        </button>
      </div>

      <!-- Canvas 画布区域 -->
      <div ref="canvasWrapperRef" class="ie-canvas-area">
        <canvas ref="canvasRef"></canvas>
      </div>

      <!-- 右侧属性面板 -->
      <div class="ie-props-panel" v-if="selectedObj">
        <div class="ie-props-section">
          <h4>位置与尺寸</h4>
          <div class="ie-props-grid">
            <label>X <input type="number" :value="Math.round(selectedObj.left || 0)" @change="setAttr('left', $event)" /></label>
            <label>Y <input type="number" :value="Math.round(selectedObj.top || 0)" @change="setAttr('top', $event)" /></label>
            <label>W <input type="number" :value="Math.round((selectedObj.width || 0) * (selectedObj.scaleX || 1))" @change="setWidth($event)" /></label>
            <label>H <input type="number" :value="Math.round((selectedObj.height || 0) * (selectedObj.scaleY || 1))" @change="setHeight($event)" /></label>
          </div>
        </div>
        <div class="ie-props-section">
          <h4>外观</h4>
          <label>填充 <input type="color" :value="selectedObj.fill || '#000000'" @input="setAttr('fill', $event)" /></label>
          <label>描边 <input type="color" :value="selectedObj.stroke || '#000000'" @input="setAttr('stroke', $event)" /></label>
          <label>描边宽度 <input type="range" min="0" max="20" :value="selectedObj.strokeWidth || 0" @input="setAttr('strokeWidth', $event)" /></label>
          <label>透明度 <input type="range" min="0" max="1" step="0.01" :value="selectedObj.opacity || 1" @input="setAttr('opacity', $event)" /></label>
        </div>
        <div class="ie-props-section" v-if="isText">
          <h4>文字</h4>
          <label>字号 <input type="number" min="8" max="200" :value="selectedObj.fontSize || 16" @change="setAttr('fontSize', $event)" /></label>
          <div class="ie-props-row">
            <button :class="{ active: selectedObj.fontWeight === 'bold' }" @click="toggleAttr('fontWeight', 'bold', 'normal')">B</button>
            <button :class="{ active: selectedObj.fontStyle === 'italic' }" @click="toggleAttr('fontStyle', 'italic', 'normal')">I</button>
            <button :class="{ active: selectedObj.underline }" @click="toggleAttr('underline', true, false)">U</button>
            <button :class="{ active: selectedObj.linethrough }" @click="toggleAttr('linethrough', true, false)">S</button>
          </div>
        </div>
        <div class="ie-props-section">
          <h4>阴影</h4>
          <label>颜色 <input type="color" :value="shadowColor" @input="setShadow('color', $event)" /></label>
          <label>模糊 <input type="range" min="0" max="50" :value="shadowBlur" @input="setShadow('blur', $event)" /></label>
          <label>X偏移 <input type="range" min="-50" max="50" :value="shadowOffsetX" @input="setShadow('offsetX', $event)" /></label>
          <label>Y偏移 <input type="range" min="-50" max="50" :value="shadowOffsetY" @input="setShadow('offsetY', $event)" /></label>
        </div>
      </div>
    </div>

    <!-- 状态栏 -->
    <div class="ie-status-bar">
      <span>{{ canvasWidth }} × {{ canvasHeight }}</span>
      <span>{{ Math.round(zoom * 100) }}%</span>
      <span v-if="selectedObj">已选: {{ selectedObj.type }}</span>
      <span v-else>未选中</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { fabric } from 'fabric'
import Editor from '../kuaitu-core/Editor'
import type { IEditor } from '../kuaitu-core/interface/Editor'
import { useTheme } from '../composables/useTheme'

// 导入核心插件
import DringPlugin from '../kuaitu-core/plugin/DringPlugin'
import AlignGuidLinePlugin from '../kuaitu-core/plugin/AlignGuidLinePlugin'
import ControlsPlugin from '../kuaitu-core/plugin/ControlsPlugin'
import CenterAlignPlugin from '../kuaitu-core/plugin/CenterAlignPlugin'
import LayerPlugin from '../kuaitu-core/plugin/LayerPlugin'
import CopyPlugin from '../kuaitu-core/plugin/CopyPlugin'
import MoveHotKeyPlugin from '../kuaitu-core/plugin/MoveHotKeyPlugin'
import DeleteHotKeyPlugin from '../kuaitu-core/plugin/DeleteHotKeyPlugin'
import GroupPlugin from '../kuaitu-core/plugin/GroupPlugin'
import DrawLinePlugin from '../kuaitu-core/plugin/DrawLinePlugin'
import GroupTextEditorPlugin from '../kuaitu-core/plugin/GroupTextEditorPlugin'
import GroupAlignPlugin from '../kuaitu-core/plugin/GroupAlignPlugin'
import WorkspacePlugin from '../kuaitu-core/plugin/WorkspacePlugin'
import HistoryPlugin from '../kuaitu-core/plugin/HistoryPlugin'
import FlipPlugin from '../kuaitu-core/plugin/FlipPlugin'
import DrawPolygonPlugin from '../kuaitu-core/plugin/DrawPolygonPlugin'
import FreeDrawPlugin from '../kuaitu-core/plugin/FreeDrawPlugin'
import SimpleClipImagePlugin from '../kuaitu-core/plugin/SimpleClipImagePlugin'
import LockPlugin from '../kuaitu-core/plugin/LockPlugin'
import AddBaseTypePlugin from '../kuaitu-core/plugin/AddBaseTypePlugin'
import ResizePlugin from '../kuaitu-core/plugin/ResizePlugin'
import ImageStroke from '../kuaitu-core/plugin/ImageStroke'

const props = defineProps<{ src?: string }>()

const isFullscreen = ref(false)
const canvasWidth = ref(900)
const canvasHeight = ref(1200)
const zoom = ref(1)
const selectedObj = ref<any>(null)
const canUndo = ref(false)
const canRedo = ref(false)
const activeTool = ref('select')
const canvasWrapperRef = ref<HTMLElement>()
const canvasRef = ref<HTMLCanvasElement>()

const { themeVars } = useTheme()

let editor: IEditor | null = null
let fabricCanvas: any = null

const isText = computed(() => ['textbox', 'i-text', 'text'].includes(selectedObj.value?.type))
const shadowColor = computed(() => selectedObj.value?.shadow?.color || '#000000')
const shadowBlur = computed(() => selectedObj.value?.shadow?.blur || 0)
const shadowOffsetX = computed(() => selectedObj.value?.shadow?.offsetX || 0)
const shadowOffsetY = computed(() => selectedObj.value?.shadow?.offsetY || 0)

const tools = [
  { id: 'select', label: '选择', icon: '↖' },
  { id: 'rect', label: '矩形', icon: '□' },
  { id: 'circle', label: '圆形', icon: '○' },
  { id: 'triangle', label: '三角形', icon: '△' },
  { id: 'text', label: '文字', icon: 'T' },
  { id: 'image', label: '图片', icon: '🖼' },
  { id: 'line', label: '直线', icon: '╱' },
  { id: 'arrow', label: '箭头', icon: '→' },
  { id: 'draw', label: '画笔', icon: '✎' },
]

onMounted(() => {
  console.log('[ImageEditor] onMounted called')
  initEditor()
})

async function initEditor() {
  console.log('[ImageEditor] initEditor called')
  if (!canvasRef.value) {
    console.log('[ImageEditor] canvasRef not ready, retrying...')
    await new Promise(resolve => setTimeout(resolve, 100))
    if (!canvasRef.value) {
      console.log('[ImageEditor] canvasRef still not ready, giving up')
      return
    }
  }

  console.log('[ImageEditor] creating canvas')
  fabricCanvas = new fabric.Canvas(canvasRef.value, {
    fireRightClick: true,
    stopContextMenu: true,
    controlsAboveOverlay: true,
    preserveObjectStacking: true,
  })

  editor = new Editor() as IEditor
  editor.init(fabricCanvas)
  editor
    .use(DringPlugin)
    .use(AlignGuidLinePlugin)
    .use(ControlsPlugin)
    .use(CenterAlignPlugin)
    .use(LayerPlugin)
    .use(CopyPlugin)
    .use(MoveHotKeyPlugin)
    .use(DeleteHotKeyPlugin)
    .use(GroupPlugin)
    .use(DrawLinePlugin)
    .use(GroupTextEditorPlugin)
    .use(GroupAlignPlugin)
    .use(WorkspacePlugin)
    .use(HistoryPlugin)
    .use(FlipPlugin)
    .use(DrawPolygonPlugin)
    .use(FreeDrawPlugin)
    .use(SimpleClipImagePlugin)
    .use(LockPlugin)
    .use(AddBaseTypePlugin)
    .use(ResizePlugin)
    .use(ImageStroke)

  // 监听选择事件
  fabricCanvas.on('selection:created', onSelect)
  fabricCanvas.on('selection:updated', onSelect)
  fabricCanvas.on('selection:cleared', () => { selectedObj.value = null })
  fabricCanvas.on('object:modified', onSelect)

  // 监听历史
  fabricCanvas.on('history:append', updateHistory)
  fabricCanvas.on('history:undo', updateHistory)
  fabricCanvas.on('history:redo', updateHistory)

  // 加载 JSON
  if (props.src) {
    console.log('[ImageEditor] loading JSON:', props.src)
    await loadJson(props.src)
    console.log('[ImageEditor] JSON loaded, objects:', fabricCanvas?.getObjects()?.length)
  }

  // 适应画布
  nextTick(() => zoomFit())
})

onUnmounted(() => { editor?.destory() })

function onSelect() {
  selectedObj.value = fabricCanvas?.getActiveObject() || null
}

function updateHistory() {
  canUndo.value = (editor as any)?.undoCount > 0
  canRedo.value = (editor as any)?.redoCount > 0
}

async function loadJson(src: string) {
  try {
    const resp = await fetch(src)
    if (!resp.ok) throw new Error(`Failed: ${src}`)
    const json = await resp.json()
    return new Promise<void>((resolve) => {
      console.log('[loadJson] calling loadFromJSON')
      fabricCanvas.loadFromJSON(json, () => {
        console.log('[loadJson] loadFromJSON callback called')
        const ws = fabricCanvas.getObjects().find((o: any) => o.id === 'workspace')
        if (ws) {
          ws.set('selectable', false)
          ws.set('evented', false)
          canvasWidth.value = ws.width
          canvasHeight.value = ws.height
        }
        fabricCanvas.renderAll()
        nextTick(() => zoomFit())
        resolve()
      })
    })
  } catch (e) { console.error('loadJson error:', e) }
}

function zoomFit() {
  if (!fabricCanvas || !canvasWrapperRef.value) return
  const w = canvasWrapperRef.value
  const ws = fabricCanvas.getObjects().find((o: any) => o.id === 'workspace')
  if (ws) {
    const sx = w.clientWidth / ws.width
    const sy = w.clientHeight / ws.height
    zoom.value = Math.min(sx, sy) * 0.9
    fabricCanvas.setZoom(zoom.value)
    const sw = ws.width * zoom.value
    const sh = ws.height * zoom.value
    fabricCanvas.setDimensions({ width: sw, height: sh })
    const ctr = w.querySelector('.canvas-container') as HTMLElement
    if (ctr) {
      ctr.style.left = Math.max(0, (w.clientWidth - sw) / 2) + 'px'
      ctr.style.top = Math.max(0, (w.clientHeight - sh) / 2) + 'px'
    }
    fabricCanvas.renderAll()
  }
}

// 属性设置
function setAttr(key: string, e: Event) {
  const v = (e.target as HTMLInputElement).value
  const obj = fabricCanvas?.getActiveObject()
  if (obj) { obj.set(key, isNaN(Number(v)) ? v : Number(v)); fabricCanvas.renderAll() }
}

function setWidth(e: Event) {
  const obj = fabricCanvas?.getActiveObject()
  if (obj) { obj.scaleToWidth(Number((e.target as HTMLInputElement).value)); fabricCanvas.renderAll() }
}

function setHeight(e: Event) {
  const obj = fabricCanvas?.getActiveObject()
  if (obj) { obj.scaleToHeight(Number((e.target as HTMLInputElement).value)); fabricCanvas.renderAll() }
}

function toggleAttr(key: string, on: any, off: any) {
  const obj = fabricCanvas?.getActiveObject()
  if (obj) { obj.set(key, obj[key] === on ? off : on); fabricCanvas.renderAll(); onSelect() }
}

function setShadow(key: string, e: Event) {
  const obj = fabricCanvas?.getActiveObject()
  if (!obj) return
  const shadow = obj.shadow || new fabric.Shadow({ color: '#000', blur: 0, offsetX: 0, offsetY: 0 })
  const v = (e.target as HTMLInputElement).value
  shadow[key] = isNaN(Number(v)) ? v : Number(v)
  obj.set('shadow', shadow)
  fabricCanvas.renderAll()
}

// 工具操作
function setActiveTool(id: string) {
  activeTool.value = id
  fabricCanvas.isDrawingMode = id === 'draw'
  if (id === 'rect') addRect()
  else if (id === 'circle') addCircle()
  else if (id === 'triangle') addTriangle()
  else if (id === 'text') addText()
  else if (id === 'image') addImage()
  else if (id === 'line') addLine()
  else if (id === 'arrow') addArrow()
}

function addRect() {
  const c = fabricCanvas.getCenter()
  const r = new fabric.Rect({ left: c.left - 50, top: c.top - 50, width: 100, height: 100, fill: '#3b82f6', rx: 8, ry: 8 })
  fabricCanvas.add(r); fabricCanvas.setActiveObject(r); fabricCanvas.renderAll(); activeTool.value = 'select'
}

function addCircle() {
  const c = fabricCanvas.getCenter()
  const e = new fabric.Ellipse({ left: c.left - 50, top: c.top - 50, rx: 50, ry: 50, fill: '#10b981' })
  fabricCanvas.add(e); fabricCanvas.setActiveObject(e); fabricCanvas.renderAll(); activeTool.value = 'select'
}

function addTriangle() {
  const c = fabricCanvas.getCenter()
  const t = new fabric.Triangle({ left: c.left - 50, top: c.top - 50, width: 100, height: 100, fill: '#f59e0b' })
  fabricCanvas.add(t); fabricCanvas.setActiveObject(t); fabricCanvas.renderAll(); activeTool.value = 'select'
}

function addText() {
  const c = fabricCanvas.getCenter()
  const t = new fabric.IText('双击编辑', { left: c.left - 60, top: c.top - 15, fontSize: 24, fill: '#1e293b' })
  fabricCanvas.add(t); fabricCanvas.setActiveObject(t); fabricCanvas.renderAll(); activeTool.value = 'select'
}

function addImage() {
  const input = document.createElement('input')
  input.type = 'file'; input.accept = 'image/*'
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      fabric.Image.fromURL(ev.target?.result as string, (img: any) => {
        const c = fabricCanvas.getCenter()
        img.set({ left: c.left - 100, top: c.top - 100 })
        img.scaleToWidth(200)
        fabricCanvas.add(img); fabricCanvas.setActiveObject(img); fabricCanvas.renderAll()
      })
    }
    reader.readAsDataURL(file)
  }
  input.click(); activeTool.value = 'select'
}

function addLine() {
  const c = fabricCanvas.getCenter()
  const l = new fabric.Line([c.left - 100, c.top, c.left + 100, c.top], { stroke: '#1e293b', strokeWidth: 2 })
  fabricCanvas.add(l); fabricCanvas.setActiveObject(l); fabricCanvas.renderAll(); activeTool.value = 'select'
}

function addArrow() {
  const c = fabricCanvas.getCenter()
  const l = new fabric.Line([c.left - 100, c.top, c.left + 100, c.top], { stroke: '#1e293b', strokeWidth: 2 })
  const head = new fabric.Triangle({ left: c.left + 100, top: c.top - 10, width: 20, height: 20, fill: '#1e293b', angle: 90, originX: 'center', originY: 'center' })
  fabricCanvas.add(l, head); fabricCanvas.renderAll(); activeTool.value = 'select'
}

// 编辑操作
function undo() { (editor as any)?.undo() }
function redo() { (editor as any)?.redo() }
function group() { (editor as any)?.group() }
function unGroup() { (editor as any)?.unGroup() }
function flipX() { (editor as any)?.flip('X') }
function flipY() { (editor as any)?.flip('Y') }
function lock() { (editor as any)?.lock() }
function unlock() { (editor as any)?.unLock() }
function centerH() { (editor as any)?.position('centerH') }
function centerV() { (editor as any)?.position('centerV') }

function saveJson() {
  const json = fabricCanvas.toJSON(['id'])
  const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.download = 'design.json'; a.href = url; a.click()
  URL.revokeObjectURL(url)
}

function saveImg() {
  const ws = fabricCanvas.getObjects().find((o: any) => o.id === 'workspace')
  if (ws) {
    const url = fabricCanvas.toDataURL({ format: 'png', quality: 1, left: ws.left, top: ws.top, width: ws.width, height: ws.height })
    const a = document.createElement('a'); a.download = 'design.png'; a.href = url; a.click()
  }
}

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
  nextTick(() => zoomFit())
}
</script>

<style scoped>
.ie-editor { display: flex; flex-direction: column; height: 600px; }
.ie-editor-toolbar { display: flex; align-items: center; height: var(--ie-toolbar-height); padding: 0 8px; border-bottom: 1px solid var(--ie-border); background: var(--ie-bg); gap: 4px; flex-shrink: 0; }
.ie-toolbar-group { display: flex; align-items: center; gap: 2px; }
.ie-toolbar-spacer { flex: 1; }
.ie-editor-body { display: flex; flex: 1; overflow: hidden; }
.ie-tool-panel { width: 48px; border-right: 1px solid var(--ie-border); background: var(--ie-bg-secondary); display: flex; flex-direction: column; align-items: center; padding: 8px 0; gap: 4px; flex-shrink: 0; }
.ie-tool-btn { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border: none; border-radius: 6px; background: transparent; color: var(--ie-text); cursor: pointer; font-size: 16px; }
.ie-tool-btn:hover { background: var(--ie-bg); }
.ie-tool-btn.active { background: var(--ie-accent); color: #fff; }
.ie-canvas-area { flex: 1; overflow: hidden; background: var(--ie-canvas-grid); position: relative; }
.ie-canvas-area canvas { display: block; }
.ie-props-panel { width: 280px; border-left: 1px solid var(--ie-border); background: var(--ie-bg-secondary); overflow-y: auto; padding: 12px; flex-shrink: 0; }
.ie-props-section { margin-bottom: 16px; }
.ie-props-section h4 { font-size: 12px; font-weight: 600; color: var(--ie-text-secondary); margin: 0 0 8px 0; text-transform: uppercase; }
.ie-props-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.ie-props-grid label, .ie-props-section > label { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ie-text-secondary); }
.ie-props-grid input, .ie-props-section input[type="number"], .ie-props-section input[type="color"] { width: 100%; padding: 4px 6px; border: 1px solid var(--ie-border); border-radius: 4px; background: var(--ie-bg); color: var(--ie-text); font-size: 12px; }
.ie-props-section input[type="range"] { width: 100%; }
.ie-props-row { display: flex; gap: 4px; margin-top: 6px; }
.ie-props-row button { width: 28px; height: 28px; border: 1px solid var(--ie-border); border-radius: 4px; background: var(--ie-bg); color: var(--ie-text); cursor: pointer; font-weight: bold; font-size: 13px; }
.ie-props-row button.active { background: var(--ie-accent); color: #fff; border-color: var(--ie-accent); }
.ie-status-bar { display: flex; align-items: center; height: 28px; padding: 0 12px; border-top: 1px solid var(--ie-border); background: var(--ie-bg-secondary); font-size: 12px; color: var(--ie-text-secondary); gap: 16px; flex-shrink: 0; }
.ie-toolbar-btn { display: flex; align-items: center; justify-content: center; min-width: 32px; height: 32px; border: none; border-radius: 4px; background: transparent; color: var(--ie-text); cursor: pointer; font-size: 12px; padding: 0 6px; }
.ie-toolbar-btn:hover { background: var(--ie-bg-secondary); }
.ie-toolbar-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.ie-toolbar-btn svg { width: 16px; height: 16px; fill: currentColor; }
.ie-toolbar-divider { width: 1px; height: 24px; background: var(--ie-border); margin: 0 4px; }
</style>
