<template>
  <div
    ref="containerRef"
    class="ie-container ie-editor"
    :style="themeVars"
    :class="{ 'ie-fullscreen': isFullscreen }"
  >
    <!-- 顶部工具栏 -->
    <div class="ie-editor-toolbar">
      <button class="ie-toolbar-btn" title="撤销 (Ctrl+Z)" :disabled="!canUndo" @click="undo">
        <svg viewBox="0 0 24 24"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>
      </button>
      <button class="ie-toolbar-btn" title="重做 (Ctrl+Shift+Z)" :disabled="!canRedo" @click="redo">
        <svg viewBox="0 0 24 24"><path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/></svg>
      </button>
      <div class="ie-toolbar-divider"></div>
      <button class="ie-toolbar-btn" title="保存 JSON" @click="saveJson">
        <svg viewBox="0 0 24 24"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
      </button>
      <button class="ie-toolbar-btn" title="导出 PNG" @click="saveImg">
        <svg viewBox="0 0 24 24"><path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2z"/></svg>
      </button>
      <button class="ie-toolbar-btn" title="导出 SVG" @click="saveSvg">
        <svg viewBox="0 0 24 24"><path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2z"/></svg>
      </button>
      <div class="ie-toolbar-divider"></div>
      <button class="ie-toolbar-btn" :title="isFullscreen ? '退出全屏' : '全屏'" @click="toggleFullscreen">
        <svg viewBox="0 0 24 24">
          <path v-if="!isFullscreen" d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
          <path v-else d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
        </svg>
      </button>
      <div class="ie-toolbar-spacer"></div>
      <span class="ie-toolbar-title">{{ title || '图片编辑器' }}</span>
    </div>

    <!-- 主内容区 -->
    <div class="ie-editor-body">
      <!-- 左侧工具栏 -->
      <div class="ie-tool-panel">
        <button
          v-for="tool in tools"
          :key="tool.id"
          class="ie-tool-btn"
          :class="{ active: activeTool === tool.id }"
          :title="tool.label"
          @click="setActiveTool(tool.id)"
        >
          <svg viewBox="0 0 24 24" v-html="tool.icon"></svg>
        </button>
      </div>

      <!-- Canvas 画布 -->
      <div ref="canvasWrapperRef" class="ie-canvas-area">
        <canvas ref="canvasRef"></canvas>
      </div>

      <!-- 右侧属性面板 -->
      <div class="ie-props-panel" v-if="selectedObjects.length > 0">
        <div class="ie-props-section">
          <h4>位置与尺寸</h4>
          <div class="ie-props-grid">
            <label>X <input type="number" :value="propX" @change="setProp('left', $event)" /></label>
            <label>Y <input type="number" :value="propY" @change="setProp('top', $event)" /></label>
            <label>W <input type="number" :value="propW" @change="setProp('width', $event)" /></label>
            <label>H <input type="number" :value="propH" @change="setProp('height', $event)" /></label>
          </div>
        </div>
        <div class="ie-props-section">
          <h4>外观</h4>
          <label>填充 <input type="color" :value="propFill" @input="setProp('fill', $event)" /></label>
          <label>描边 <input type="color" :value="propStroke" @input="setProp('stroke', $event)" /></label>
          <label>描边宽度 <input type="range" min="0" max="20" :value="propStrokeWidth" @input="setProp('strokeWidth', $event)" /></label>
          <label>透明度 <input type="range" min="0" max="1" step="0.01" :value="propOpacity" @input="setProp('opacity', $event)" /></label>
        </div>
        <div class="ie-props-section" v-if="isTextObject">
          <h4>文字</h4>
          <label>字号 <input type="number" min="8" max="200" :value="propFontSize" @change="setProp('fontSize', $event)" /></label>
          <label>字体 <select @change="setProp('fontFamily', $event)">
            <option value="system-ui">系统字体</option>
            <option value="serif">Serif</option>
            <option value="monospace">Monospace</option>
          </select></label>
          <div class="ie-props-row">
            <button :class="{ active: propFontWeight === 'bold' }" @click="toggleBold">B</button>
            <button :class="{ active: propFontStyle === 'italic' }" @click="toggleItalic">I</button>
            <button :class="{ active: propUnderline }" @click="toggleUnderline">U</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 状态栏 -->
    <div class="ie-status-bar">
      <span>{{ canvasWidth }} × {{ canvasHeight }}</span>
      <span>{{ Math.round(zoom * 100) }}%</span>
      <span v-if="selectedObjects.length > 0">已选 {{ selectedObjects.length }} 个元素</span>
      <span v-else>未选中</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useTheme } from '../composables/useTheme'

// 动态导入 fabric.js
let fabricLib: any = null

const props = defineProps<{
  src?: string
  title?: string
  width?: number
  height?: number
}>()

const emit = defineEmits<{
  (e: 'save', data: object): void
  (e: 'export', format: string, data: string): void
}>()

// 状态
const containerRef = ref<HTMLElement>()
const canvasWrapperRef = ref<HTMLElement>()
const canvasRef = ref<HTMLCanvasElement>()
const isFullscreen = ref(false)
const activeTool = ref('select')
const selectedObjects = ref<any[]>([])
const canUndo = ref(false)
const canRedo = ref(false)
const zoom = ref(1)
const canvasWidth = ref(props.width || 900)
const canvasHeight = ref(props.height || 1200)

const { themeVars } = useTheme()

let fabricCanvas: any = null
let editor: any = null

// 工具列表
const tools = [
  { id: 'select', label: '选择', icon: '<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>' },
  { id: 'rect', label: '矩形', icon: '<path d="M3 3h18v18H3V3zm2 2v14h14V5H5z"/>' },
  { id: 'circle', label: '圆形', icon: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>' },
  { id: 'text', label: '文字', icon: '<path d="M5 4v3h5.5v12h3V7H19V4H5z"/>' },
  { id: 'image', label: '图片', icon: '<path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>' },
  { id: 'draw', label: '画笔', icon: '<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>' },
]

// 属性计算
const propX = computed(() => Math.round(selectedObjects.value[0]?.left || 0))
const propY = computed(() => Math.round(selectedObjects.value[0]?.top || 0))
const propW = computed(() => Math.round(selectedObjects.value[0]?.width * (selectedObjects.value[0]?.scaleX || 1) || 0))
const propH = computed(() => Math.round(selectedObjects.value[0]?.height * (selectedObjects.value[0]?.scaleY || 1) || 0))
const propFill = computed(() => selectedObjects.value[0]?.fill || '#000000')
const propStroke = computed(() => selectedObjects.value[0]?.stroke || '#000000')
const propStrokeWidth = computed(() => selectedObjects.value[0]?.strokeWidth || 0)
const propOpacity = computed(() => selectedObjects.value[0]?.opacity || 1)
const isTextObject = computed(() => ['textbox', 'i-text', 'text'].includes(selectedObjects.value[0]?.type))
const propFontSize = computed(() => selectedObjects.value[0]?.fontSize || 16)
const propFontWeight = computed(() => selectedObjects.value[0]?.fontWeight || 'normal')
const propFontStyle = computed(() => selectedObjects.value[0]?.fontStyle || 'normal')
const propUnderline = computed(() => selectedObjects.value[0]?.underline || false)

// 初始化 fabric.js
async function initFabric() {
  if (!fabricLib) {
    const fabricModule = await import('fabric')
    fabricLib = fabricModule.fabric || fabricModule.default || fabricModule
  }
}

// 初始化编辑器
async function initEditor() {
  await initFabric()
  if (!fabricLib || !canvasRef.value) return

  // 如果已有 canvas，先清空对象
  if (fabricCanvas) {
    fabricCanvas.clear()
    // 不要 dispose，保留 canvas 元素
  }

  fabricCanvas = new fabricLib.Canvas(canvasRef.value, {
    width: canvasWidth.value,
    height: canvasHeight.value,
    selection: true,
    preserveObjectStacking: true,
  })


  // 如果有 src，加载 JSON
  if (props.src) {
    await loadJson(props.src)
  } else {
    // 创建空白画布
    const workspace = new fabricLib.Rect({
      width: canvasWidth.value,
      height: canvasHeight.value,
      fill: '#ffffff',
      selectable: false,
      evented: false,
      id: 'workspace',
    })
    fabricCanvas.add(workspace)
    fabricCanvas.renderAll()
  }

  // 监听选择事件
  fabricCanvas.on('selection:created', updateSelection)
  fabricCanvas.on('selection:updated', updateSelection)
  fabricCanvas.on('selection:cleared', () => {
    selectedObjects.value = []
  })

  // 监听对象修改
  fabricCanvas.on('object:modified', () => {
    updateSelection()
    updateHistoryState()
  })

  // 绑定快捷键
  bindHotkeys()

  // 适应画布
  zoomFit()
}

// 加载 JSON
async function loadJson(src: string) {
  try {
    const response = await fetch(src)
    if (!response.ok) throw new Error(`Failed to load: ${src}`)
    const json = await response.json()

    return new Promise<void>((resolve, reject) => {
      try {
        fabricCanvas.loadFromJSON(json, function() {
          try {
            // 设置工作区
            const workspace = fabricCanvas.getObjects().find((obj: any) => obj.id === 'workspace')
            if (workspace) {
              workspace.set('selectable', false)
              workspace.set('evented', false)
              canvasWidth.value = workspace.width
              canvasHeight.value = workspace.height
            }
            fabricCanvas.renderAll()
            resolve()
          } catch (e) {
            reject(e)
          }
        })
      } catch (e) {
        reject(e)
      }
    })
  } catch (err) {
    console.error('Failed to load JSON:', err)
  }
}

// 更新选择状态
function updateSelection() {
  const actives = fabricCanvas.getActiveObjects()
  selectedObjects.value = actives
}

// 更新历史状态
function updateHistoryState() {
  // 简化版本，后续接入 HistoryPlugin
  canUndo.value = true
  canRedo.value = false
}

// 设置属性
function setProp(key: string, event: Event) {
  const target = event.target as HTMLInputElement | HTMLSelectElement
  const value = target.type === 'range' || target.type === 'number' ? Number(target.value) : target.value

  selectedObjects.value.forEach((obj: any) => {
    obj.set(key, value)
  })
  fabricCanvas.renderAll()
}

// 文字样式切换
function toggleBold() {
  const obj = selectedObjects.value[0]
  if (obj) {
    obj.set('fontWeight', obj.fontWeight === 'bold' ? 'normal' : 'bold')
    fabricCanvas.renderAll()
  }
}

function toggleItalic() {
  const obj = selectedObjects.value[0]
  if (obj) {
    obj.set('fontStyle', obj.fontStyle === 'italic' ? 'normal' : 'italic')
    fabricCanvas.renderAll()
  }
}

function toggleUnderline() {
  const obj = selectedObjects.value[0]
  if (obj) {
    obj.set('underline', !obj.underline)
    fabricCanvas.renderAll()
  }
}

// 工具切换
function setActiveTool(toolId: string) {
  activeTool.value = toolId

  // 退出画笔模式
  if (fabricCanvas.isDrawingMode) {
    fabricCanvas.isDrawingMode = false
  }

  switch (toolId) {
    case 'select':
      fabricCanvas.selection = true
      break
    case 'rect':
      addShape('rect')
      break
    case 'circle':
      addShape('circle')
      break
    case 'text':
      addText()
      break
    case 'image':
      addImage()
      break
    case 'draw':
      fabricCanvas.isDrawingMode = true
      break
  }
}

// 添加形状
function addShape(type: string) {
  let shape: any
  const center = fabricCanvas.getCenter()

  if (type === 'rect') {
    shape = new fabricLib.Rect({
      left: center.left - 50,
      top: center.top - 50,
      width: 100,
      height: 100,
      fill: '#3b82f6',
      rx: 8,
      ry: 8,
    })
  } else if (type === 'circle') {
    shape = new fabricLib.Circle({
      left: center.left - 50,
      top: center.top - 50,
      radius: 50,
      fill: '#10b981',
    })
  }

  if (shape) {
    fabricCanvas.add(shape)
    fabricCanvas.setActiveObject(shape)
    fabricCanvas.renderAll()
    setActiveTool('select')
  }
}

// 添加文字
function addText() {
  const center = fabricCanvas.getCenter()
  const text = new fabricLib.Textbox('双击编辑文字', {
    left: center.left - 100,
    top: center.top - 20,
    width: 200,
    fontSize: 24,
    fill: '#1e293b',
    fontFamily: 'system-ui',
  })
  fabricCanvas.add(text)
  fabricCanvas.setActiveObject(text)
  fabricCanvas.renderAll()
  setActiveTool('select')
}

// 添加图片
function addImage() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const url = event.target?.result as string
      fabricLib.Image.fromURL(url, (img: any) => {
        const center = fabricCanvas.getCenter()
        img.set({
          left: center.left - img.width! / 4,
          top: center.top - img.height! / 4,
        })
        img.scaleToWidth(200)
        fabricCanvas.add(img)
        fabricCanvas.setActiveObject(img)
        fabricCanvas.renderAll()
      })
    }
    reader.readAsDataURL(file)
  }
  input.click()
  setActiveTool('select')
}

// 缩放控制
function zoomIn() {
  zoom.value = Math.min(zoom.value * 1.1, 5)
  fabricCanvas.setZoom(zoom.value)
  fabricCanvas.renderAll()
}

function zoomOut() {
  zoom.value = Math.max(zoom.value * 0.9, 0.1)
  fabricCanvas.setZoom(zoom.value)
  fabricCanvas.renderAll()
}

function zoomFit() {
  if (!fabricCanvas || !canvasWrapperRef.value) return
  const wrapper = canvasWrapperRef.value
  const wrapperWidth = wrapper.clientWidth
  const wrapperHeight = wrapper.clientHeight

  const workspace = fabricCanvas.getObjects().find((obj: any) => obj.id === 'workspace')
  if (workspace) {
    const scaleX = wrapperWidth / (workspace.width || canvasWidth.value)
    const scaleY = wrapperHeight / (workspace.height || canvasHeight.value)
    zoom.value = Math.min(scaleX, scaleY) * 0.9
    fabricCanvas.setZoom(zoom.value)

    // 更新 canvas 尺寸以匹配缩放后的大小
    const scaledWidth = (workspace.width || canvasWidth.value) * zoom.value
    const scaledHeight = (workspace.height || canvasHeight.value) * zoom.value
    fabricCanvas.setDimensions({ width: scaledWidth, height: scaledHeight })

    // 居中 canvas
    const canvasContainer = wrapper.querySelector('.canvas-container')
    if (canvasContainer) {
      const offsetX = (wrapperWidth - scaledWidth) / 2
      const offsetY = (wrapperHeight - scaledHeight) / 2
      canvasContainer.style.left = Math.max(0, offsetX) + 'px'
      canvasContainer.style.top = Math.max(0, offsetY) + 'px'
    }

    fabricCanvas.renderAll()
  }
}

// 全屏切换
function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
  nextTick(() => zoomFit())
}

// 撤销/重做（简化版本）
function undo() {
  // 后续接入 HistoryPlugin
  console.log('undo')
}

function redo() {
  // 后续接入 HistoryPlugin
  console.log('redo')
}

// 导出
function saveJson() {
  const json = fabricCanvas.toJSON(['id'])
  emit('save', json)

  const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = 'design.json'
  link.href = url
  link.click()
  URL.revokeObjectURL(url)
}

function saveImg() {
  const workspace = fabricCanvas.getObjects().find((obj: any) => obj.id === 'workspace')
  if (workspace) {
    const { left, top, width, height } = workspace
    const dataUrl = fabricCanvas.toDataURL({
      format: 'png',
      quality: 1,
      left,
      top,
      width,
      height,
    })
    const link = document.createElement('a')
    link.download = 'design.png'
    link.href = dataUrl
    link.click()
    emit('export', 'png', dataUrl)
  }
}

function saveSvg() {
  const svg = fabricCanvas.toSVG()
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = 'design.svg'
  link.href = url
  link.click()
  URL.revokeObjectURL(url)
  emit('export', 'svg', svg)
}

// 快捷键
function bindHotkeys() {
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if (e.key === 'z' && e.shiftKey) {
        e.preventDefault()
        redo()
      } else if (e.key === 's') {
        e.preventDefault()
        saveJson()
      }
    }

    // Delete 键删除选中
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedObjects.value.length > 0 && !(document.activeElement instanceof HTMLInputElement)) {
        selectedObjects.value.forEach((obj: any) => {
          fabricCanvas.remove(obj)
        })
        fabricCanvas.discardActiveObject()
        fabricCanvas.renderAll()
        selectedObjects.value = []
      }
    }
  }

  window.addEventListener('keydown', handleKeydown)
  onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
}

// 生命周期
onMounted(() => {
  initEditor()
})

onUnmounted(() => {
  fabricCanvas?.dispose()
})
</script>

<style scoped>
.ie-editor {
  display: flex;
  flex-direction: column;
  height: 600px;
}

.ie-editor-toolbar {
  display: flex;
  align-items: center;
  height: var(--ie-toolbar-height);
  padding: 0 8px;
  border-bottom: 1px solid var(--ie-border);
  background: var(--ie-bg);
  gap: 4px;
  flex-shrink: 0;
}

.ie-toolbar-spacer {
  flex: 1;
}

.ie-toolbar-title {
  font-size: 13px;
  color: var(--ie-text-secondary);
  margin-right: 8px;
}

.ie-editor-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.ie-tool-panel {
  width: 48px;
  border-right: 1px solid var(--ie-border);
  background: var(--ie-bg-secondary);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
  gap: 4px;
  flex-shrink: 0;
}

.ie-tool-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--ie-text);
  cursor: pointer;
  transition: all 0.15s;
}

.ie-tool-btn:hover {
  background: var(--ie-bg);
}

.ie-tool-btn.active {
  background: var(--ie-accent);
  color: #fff;
}

.ie-tool-btn svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
}

.ie-canvas-area {
  flex: 1;
  overflow: auto;
  background: var(--ie-canvas-grid);
  display: flex;
  align-items: center;
  justify-content: center;
}

.ie-props-panel {
  width: var(--ie-panel-width);
  border-left: 1px solid var(--ie-border);
  background: var(--ie-bg-secondary);
  overflow-y: auto;
  padding: 12px;
  flex-shrink: 0;
}

.ie-props-section {
  margin-bottom: 16px;
}

.ie-props-section h4 {
  font-size: 12px;
  font-weight: 600;
  color: var(--ie-text-secondary);
  margin: 0 0 8px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.ie-props-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.ie-props-grid label,
.ie-props-section > label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--ie-text-secondary);
}

.ie-props-grid input,
.ie-props-section input[type="number"],
.ie-props-section input[type="color"] {
  width: 100%;
  padding: 4px 6px;
  border: 1px solid var(--ie-border);
  border-radius: 4px;
  background: var(--ie-bg);
  color: var(--ie-text);
  font-size: 12px;
}

.ie-props-section input[type="range"] {
  width: 100%;
}

.ie-props-section select {
  width: 100%;
  padding: 4px 6px;
  border: 1px solid var(--ie-border);
  border-radius: 4px;
  background: var(--ie-bg);
  color: var(--ie-text);
  font-size: 12px;
}

.ie-props-row {
  display: flex;
  gap: 4px;
  margin-top: 6px;
}

.ie-props-row button {
  width: 28px;
  height: 28px;
  border: 1px solid var(--ie-border);
  border-radius: 4px;
  background: var(--ie-bg);
  color: var(--ie-text);
  cursor: pointer;
  font-weight: bold;
  font-size: 13px;
}

.ie-props-row button.active {
  background: var(--ie-accent);
  color: #fff;
  border-color: var(--ie-accent);
}

.ie-status-bar {
  display: flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  border-top: 1px solid var(--ie-border);
  background: var(--ie-bg-secondary);
  font-size: 12px;
  color: var(--ie-text-secondary);
  gap: 16px;
  flex-shrink: 0;
}
</style>
