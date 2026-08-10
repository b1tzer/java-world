<script setup>
/**
 * SVG 编辑器 — 组装层
 *
 * 职责：Vue 状态管理 + 事件绑定 + 布局
 * 核心逻辑委托给：editor/ 下的模块
 */
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { fabric } from 'fabric'
import { ICONS } from './editor/constants.js'
import { preprocessSvg } from './editor/preprocessor.js'
import { cleanFabricSvg, rgbToHex, hexToCssVars, restoreViewBox, removeCanvasBg } from './editor/postprocessor.js'
import { CanvasManager } from './editor/CanvasManager.js'
import { HistoryManager } from './editor/HistoryManager.js'
import { mergeArrows } from './editor/plugins/arrow-merger.js'
import * as AlignPlugin from './editor/plugins/align.js'
import * as LayerPlugin from './editor/plugins/layer.js'
import * as TextFormatPlugin from './editor/plugins/text-format.js'
import * as DistributePlugin from './editor/plugins/distribute.js'
import { applyGradient } from './editor/plugins/gradient.js'
import { toggleShadow, applyShadow } from './editor/plugins/shadow.js'

// 确保 fabric 全局可用（兼容 loadSVGFromString 等需要全局 fabric 的 API）
window.fabric = fabric

const props = defineProps({ src: { type: String, required: true } })
const emit = defineEmits(['close', 'saved'])

// ── Vue 响应式状态 ──
const canvasRef = ref(null)
const overlayRef = ref(null)
const loading = ref(true)
const saving = ref(false)
const zoomLevel = ref(100)
const svgWidth = ref(0)
const svgHeight = ref(0)
const selectionInfo = ref('')
const currentFill = ref('')
const currentStroke = ref('')
const currentFontSize = ref(12)
const currentFontWeight = ref('normal')
const currentFontStyle = ref('normal')
const currentUnderline = ref(false)
const currentTextAlign = ref('left')
const currentTextFill = ref('')
const currentStrokeWidth = ref(1)
const currentStrokeDash = ref(false)
const currentRotation = ref(0)
const currentOpacity = ref(100)
const gradientType = ref('none')
const gradientAngle = ref(0)
const gradientColor1 = ref('#1565C0')
const gradientColor2 = ref('#E3F2FD')
const shadowEnabled = ref(false)
const shadowColor = ref('#000000')
const shadowBlur = ref(5)
const shadowOffsetX = ref(3)
const shadowOffsetY = ref(3)
const originalViewBox = ref('')
const spacePressed = ref(false)
const guideLines = ref([])
const isPanning = ref(false)

// ── 核心管理器 ──
const canvasMgr = new CanvasManager()
const historyMgr = new HistoryManager()
let _keyHandlerFn = null
let _keyUpHandler = null
let _resizeObserver = null

// 管理器回调注册
canvasMgr.onZoomChange((z) => { zoomLevel.value = z })
canvasMgr.onGuideLinesChange((lines) => { guideLines.value = lines })
canvasMgr.onSelectionChange(() => { updateSelectionInfo() })
canvasMgr.onModified(() => {
  historyMgr.save(canvasMgr.canvas,
    () => canvasMgr.removeBg(),
    () => canvasMgr.reAddBg())
})

// ── 选择状态更新 ──
function updateSelectionInfo() {
  const fc = canvasMgr.canvas
  if (!fc) return
  const active = fc.getActiveObject()
  if (!active) { selectionInfo.value = ''; return }
  const isMulti = active.type === 'activeSelection'
  selectionInfo.value = isMulti ? `${active._objects.length} 个选中` : active.type

  if (active.fill && typeof active.fill === 'string') currentFill.value = active.fill
  if (active.stroke && typeof active.stroke === 'string') currentStroke.value = active.stroke
  if (active.strokeWidth != null) currentStrokeWidth.value = active.strokeWidth
  currentStrokeDash.value = !!active.strokeDashArray
  currentRotation.value = Math.round(active.angle || 0)
  currentOpacity.value = Math.round((active.opacity != null ? active.opacity : 1) * 100)

  if (active.fill && typeof active.fill === 'object' && active.fill.type) {
    gradientType.value = active.fill.type
    const coords = active.fill.coords || {}
    if (active.fill.type === 'linear') {
      gradientAngle.value = Math.round(Math.atan2(coords.y2 - coords.y1, coords.x2 - coords.x1) * 180 / Math.PI)
    }
    const stops = active.fill.colorStops || []
    if (stops[0]) gradientColor1.value = stops[0].color
    if (stops[1]) gradientColor2.value = stops[1].color
  } else {
    gradientType.value = 'none'
  }

  if (active.shadow) {
    shadowEnabled.value = true
    shadowColor.value = active.shadow.color || '#000000'
    shadowBlur.value = active.shadow.blur || 5
    shadowOffsetX.value = active.shadow.offsetX || 3
    shadowOffsetY.value = active.shadow.offsetY || 3
  } else {
    shadowEnabled.value = false
  }

  const textObj = TextFormatPlugin.getTextObjects(fc)[0]
  if (textObj) {
    if (textObj.fontSize) currentFontSize.value = textObj.fontSize
    if (textObj.fontWeight) currentFontWeight.value = textObj.fontWeight
    if (textObj.fontStyle) currentFontStyle.value = textObj.fontStyle
    if (textObj.underline !== undefined) currentUnderline.value = textObj.underline
    if (textObj.textAlign) currentTextAlign.value = textObj.textAlign
    if (textObj.fill && typeof textObj.fill === 'string') currentTextFill.value = textObj.fill
  }
}

// ── 工具栏操作（委托给插件，操作后保存状态） ──
function withSave(fn) {
  const fc = canvasMgr.canvas
  if (!fc) return
  fn(fc)
  historyMgr.save(fc,
    () => canvasMgr.removeBg(),
    () => canvasMgr.reAddBg())
}

function undo() { historyMgr.undo(canvasMgr.canvas, () => canvasMgr.reAddBg()) }
function redo() { historyMgr.redo(canvasMgr.canvas, () => canvasMgr.reAddBg()) }

function copyObj() {
  const a = canvasMgr.canvas?.getActiveObject()
  if (a) a.clone(c => { window._clipboard = c })
}
function pasteObj() {
  if (!window._clipboard) return
  const fc = canvasMgr.canvas
  window._clipboard.clone(c => {
    c.set({ left: c.left + 20, top: c.top + 20 })
    fc.add(c); fc.setActiveObject(c); fc.renderAll()
    withSave(() => {})
  })
}
function deleteObj() {
  const fc = canvasMgr.canvas
  const a = fc?.getActiveObject()
  if (!a) return
  if (a.type === 'activeSelection') { a.forEachObject(o => fc.remove(o)); fc.discardActiveObject() }
  else fc.remove(a)
  fc.renderAll()
  withSave(() => {})
}

function align(type) { withSave(fc => AlignPlugin[`align${type.charAt(0).toUpperCase() + type.slice(1)}`](fc)) }
function layerForward() { withSave(fc => LayerPlugin.forward(fc)) }
function layerBackward() { withSave(fc => LayerPlugin.backward(fc)) }
function layerToFront() { withSave(fc => LayerPlugin.toFront(fc)) }
function layerToBack() { withSave(fc => LayerPlugin.toBack(fc)) }
function distribute(dir) { withSave(fc => dir === 'horizontal' ? DistributePlugin.distributeHorizontal(fc) : DistributePlugin.distributeVertical(fc)) }

function applyFill(hex) { withSave(fc => { const a = fc.getActiveObject(); if (a) a.set('fill', hex) }) }
function applyStroke(hex) { withSave(fc => { const a = fc.getActiveObject(); if (a) a.set('stroke', hex) }) }
function applyStrokeWidth(w) { withSave(fc => { const a = fc.getActiveObject(); if (a) a.set('strokeWidth', w); currentStrokeWidth.value = w }) }
function toggleStrokeDash() {
  const fc = canvasMgr.canvas; const a = fc?.getActiveObject(); if (!a) return
  const next = !currentStrokeDash.value
  a.set('strokeDashArray', next ? [6, 3] : null)
  currentStrokeDash.value = next
  fc.renderAll(); withSave(() => {})
}

function applyFontSize(size) { withSave(fc => TextFormatPlugin.applyFontSize(fc, size)); currentFontSize.value = size }
function toggleBold() { withSave(fc => { currentFontWeight.value = TextFormatPlugin.toggleBold(fc) || 'normal' }) }
function toggleItalic() { withSave(fc => { currentFontStyle.value = TextFormatPlugin.toggleItalic(fc) || 'normal' }) }
function toggleUnderline() { withSave(fc => { currentUnderline.value = TextFormatPlugin.toggleUnderline(fc) }) }
function applyTextAlign(align) { withSave(fc => { currentTextAlign.value = TextFormatPlugin.applyTextAlign(fc, align) }) }
function applyTextFill(hex) { withSave(fc => { currentTextFill.value = TextFormatPlugin.applyTextFill(fc, hex) }) }

function applyRotation(angle) {
  const a = canvasMgr.canvas?.getActiveObject()
  if (!a) return
  a.rotate(angle); currentRotation.value = angle
  canvasMgr.canvas.renderAll(); withSave(() => {})
}

function groupSelected() {
  const fc = canvasMgr.canvas
  const active = fc?.getActiveObject()
  if (!active || active.type !== 'activeSelection') return
  active.toGroup()
  fc.renderAll(); withSave(() => {})
}
function ungroupSelected() {
  const fc = canvasMgr.canvas
  const active = fc?.getActiveObject()
  if (!active || active.type !== 'group') return
  active.toActiveSelection()
  fc.renderAll(); withSave(() => {})
}

function applyOpacity(value) {
  const a = canvasMgr.canvas?.getActiveObject()
  if (!a) return
  a.set('opacity', value / 100); currentOpacity.value = value
  canvasMgr.canvas.renderAll(); withSave(() => {})
}

function applyGradientUI() {
  const fc = canvasMgr.canvas; if (!fc) return
  applyGradient(fc, {
    type: gradientType.value,
    angle: gradientAngle.value,
    color1: gradientColor1.value,
    color2: gradientColor2.value,
  })
  withSave(() => {})
}

function toggleShadowUI() {
  const fc = canvasMgr.canvas; if (!fc) return
  shadowEnabled.value = toggleShadow(fc)
  withSave(() => {})
}
function applyShadowUI() {
  const fc = canvasMgr.canvas; if (!fc) return
  applyShadow(fc, {
    color: shadowColor.value, blur: shadowBlur.value,
    offsetX: shadowOffsetX.value, offsetY: shadowOffsetY.value,
  })
  withSave(() => {})
}

// ── 主加载流程 ──
async function loadAndInit() {
  loading.value = true

  onUnmounted(() => {
    if (_keyHandlerFn) {
      document.removeEventListener('keydown', _keyHandlerFn)
      document.removeEventListener('keyup', _keyUpHandler)
    }
    if (_resizeObserver) _resizeObserver.disconnect()
    canvasMgr.dispose()
  })

  await nextTick()
  const base = import.meta.env.BASE_URL || '/'
  const url = props.src.startsWith('/') ? base + props.src.slice(1) : props.src

  let svgText
  try {
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    svgText = await resp.text()
  } catch (e) {
    console.error('[SvgEditor] 获取 SVG 失败:', url, e)
    loading.value = false
    return
  }

  // 预处理 SVG
  const { svg, originalViewBox: vb, svgWidth: sw, svgHeight: sh } = preprocessSvg(svgText)
  if (vb) originalViewBox.value = vb
  if (sw > 0) svgWidth.value = sw
  if (sh > 0) svgHeight.value = sh

  const container = canvasRef.value
  if (!container) return

  // 等待布局稳定
  await new Promise(r => requestAnimationFrame(r))
  await new Promise(r => requestAnimationFrame(r))
  const w = container.clientWidth || 800
  const h = container.clientHeight || 500

  // 初始化画布
  const fc = canvasMgr.init(container.querySelector('canvas'), w, h)
  window.__fabricCanvas = fc
  window.__canvasMgr = canvasMgr

  // 加载 SVG 对象
  fabric.loadSVGFromString(svg, (objects) => {
    try {
      const merged = mergeArrows(objects)
      const converted = merged.map(convertToTextbox)
      converted.forEach(obj => {
        ensureInteractive(obj)
        fc.add(obj)
      })

      // 确保所有对象可选择（跳过背景层）
      fc.getObjects().forEach(o => {
        if (o.excludeFromExport) return  // 背景层对象，已在 addBackground 中锁定
        o.set({ selectable: true, evented: true })
        if (o._objects) o._objects.forEach(c => c.set({ selectable: true, evented: true }))
      })

      canvasMgr.addBackground(svgWidth.value, svgHeight.value)

      // ★ 锁定背景元素：canvas 背景层（excludeFromExport）+ SVG 大面积底框矩形
      const svgW = svgWidth.value, svgH = svgHeight.value
      fc.getObjects().forEach(o => {
        if (o.excludeFromExport) {
          o.set({ selectable: false, evented: false, hoverCursor: 'default' })
          return
        }
        const ow = Math.round((o.width || 0) * (o.scaleX || 1))
        const oh = Math.round((o.height || 0) * (o.scaleY || 1))
        if (o.type === 'rect' && ow > svgW * 0.7 && oh > svgH * 0.7) {
          o.set({ selectable: false, evented: false, hoverCursor: 'default' })
        }
      })
      fc.renderAll()
      canvasMgr.zoomFit()
      historyMgr.save(fc,
        () => canvasMgr.removeBg(),
        () => canvasMgr.reAddBg())
    } catch (e) {
      console.error('[SvgEditor] SVG 加载失败:', e)
    } finally {
      loading.value = false
    }
  })

  // ResizeObserver
  _resizeObserver = new ResizeObserver(() => {
    const c = canvasRef.value
    if (!c || !fc) return
    fc.setDimensions({ width: c.clientWidth || 800, height: c.clientHeight || 500 })
    fc.requestRenderAll()
  })
  _resizeObserver.observe(container)

  // 快捷键
  _keyHandlerFn = (e) => {
    if (e.key === ' ' && !e.repeat) {
      e.preventDefault()
      spacePressed.value = true
      canvasMgr.setSpacePressed(true)
      fc.setCursor('grab')
      return
    }
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if (e.key === 'z' && e.shiftKey) { e.preventDefault(); redo() }
      if (e.key === 'y') { e.preventDefault(); redo() }
      if (e.key === 'c') { e.preventDefault(); copyObj() }
      if (e.key === 'v') { e.preventDefault(); pasteObj() }
      if (e.key === 's') { e.preventDefault(); save() }
      if (e.key === 'b') { e.preventDefault(); toggleBold() }
      if (e.key === 'i') { e.preventDefault(); toggleItalic() }
      if (e.key === 'u') { e.preventDefault(); toggleUnderline() }
      if (e.key === '=' || e.key === '+') { e.preventDefault(); canvasMgr.zoomIn() }
      if (e.key === '-') { e.preventDefault(); canvasMgr.zoomOut() }
      if (e.key === '0') { e.preventDefault(); canvasMgr.zoomFit() }
      if (e.key === 'g' && !e.shiftKey) { e.preventDefault(); groupSelected() }
      if (e.key === 'g' && e.shiftKey) { e.preventDefault(); ungroupSelected() }
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault(); deleteObj()
      }
    }
    if (e.key === 'Escape') {
      spacePressed.value = false
      canvasMgr.setSpacePressed(false)
      emit('close')
    }
  }
  _keyUpHandler = (e) => {
    if (e.key === ' ') {
      spacePressed.value = false
      canvasMgr.setSpacePressed(false)
    }
  }
  document.addEventListener('keydown', _keyHandlerFn)
  document.addEventListener('keyup', _keyUpHandler)
}

// ── 辅助函数 ──
function convertToTextbox(obj) {
  if (!obj) return obj
  if (obj.type === 'text') {
    try {
      return new fabric.Textbox(obj.text || '', {
        left: obj.left || 0, top: obj.top || 0,
        width: Math.max((obj.width || 80) + 20, 40),
        fontSize: obj.fontSize || 12, fontFamily: obj.fontFamily || 'sans-serif',
        fontWeight: obj.fontWeight || 'normal', fontStyle: obj.fontStyle || 'normal',
        fill: obj.fill || '#000000', stroke: obj.stroke || '', strokeWidth: obj.strokeWidth || 0,
        textAlign: obj.textAlign || 'left', lineHeight: obj.lineHeight || 1.16,
        charSpacing: obj.charSpacing || 0, opacity: obj.opacity != null ? obj.opacity : 1,
        angle: obj.angle || 0, originX: obj.originX || 'left', originY: obj.originY || 'top',
        selectable: true, evented: true, editable: true, splitByGrapheme: true,
      })
    } catch (e) {
      console.warn('[SvgEditor] Text→Textbox 转换失败:', e)
      return obj
    }
  }
  if (obj._objects) obj._objects = obj._objects.map(convertToTextbox)
  return obj
}

function ensureInteractive(o) {
  o.set({ selectable: true, evented: true, perPixelTargetFind: false })
  if (!o.fill || o.fill === 'none' || o.fill === 'transparent') {
    if (o.type === 'rect' || o.type === 'path' || o.type === 'polygon' || o.type === 'circle' || o.type === 'ellipse') {
      o.set({ fill: 'rgba(0,0,0,0.001)' })
    }
  }
  if (o._objects) o._objects.forEach(ensureInteractive)
}

// ── 保存 ──
async function save() {
  if (!canvasMgr.canvas) return
  saving.value = true
  const fc = canvasMgr.canvas
  let svgText = fc.toSVG()

  svgText = cleanFabricSvg(svgText)
  svgText = rgbToHex(svgText)
  svgText = removeCanvasBg(svgText)
  svgText = restoreViewBox(svgText, originalViewBox.value)
  svgText = hexToCssVars(svgText)

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
onMounted(() => { nextTick(() => { overlayRef.value?.focus() }) })
</script>

<template>
  <div class="editor-overlay" @click.self="emit('close')" @keydown.escape="emit('close')" tabindex="-1" ref="overlayRef">
    <div class="editor-panel">
      <!-- 工具栏 -->
      <div class="editor-toolbar">
        <span class="title">✏️ {{ src }}</span>
        <div class="sep" />
        <button @click="undo()" data-tip="撤销"><span v-html="ICONS.undo"></span></button>
        <button @click="redo()" data-tip="重做"><span v-html="ICONS.redo"></span></button>
        <div class="sep" />
        <button @click="copyObj()" data-tip="复制"><span v-html="ICONS.copy"></span></button>
        <button @click="pasteObj()" data-tip="粘贴"><span v-html="ICONS.paste"></span></button>
        <button @click="deleteObj()" data-tip="删除"><span v-html="ICONS.trash"></span></button>
        <div class="sep" />
        <button @click="canvasMgr.zoomOut()" data-tip="缩小 (-)"><span v-html="ICONS.zoomOut"></span></button>
        <span class="info" style="min-width:36px;cursor:pointer" @click="canvasMgr.zoomFit()" data-tip="点击重置">{{ zoomLevel }}%</span>
        <button @click="canvasMgr.zoomIn()" data-tip="放大 (+)"><span v-html="ICONS.zoomIn"></span></button>
        <button @click="canvasMgr.zoomFit()" data-tip="适应画布"><span v-html="ICONS.zoomFit"></span></button>
        <div class="sep" />
        <span class="info canvas-size" data-tip="SVG 画布尺寸">{{ svgWidth }} × {{ svgHeight }}px</span>
        <div class="sep" />
        <div class="align-group">
          <button @click="align('left')" data-tip="左对齐"><span v-html="ICONS.alignLeft"></span></button>
          <button @click="align('centerH')" data-tip="水平居中"><span v-html="ICONS.alignCenter"></span></button>
          <button @click="align('right')" data-tip="右对齐"><span v-html="ICONS.alignRight"></span></button>
          <button @click="align('top')" data-tip="顶对齐"><span v-html="ICONS.alignTop"></span></button>
          <button @click="align('centerV')" data-tip="垂直居中"><span v-html="ICONS.alignMiddle"></span></button>
          <button @click="align('bottom')" data-tip="底对齐"><span v-html="ICONS.alignBottom"></span></button>
        </div>
        <div class="sep" />
        <div class="layer-group">
          <button @click="layerForward()" data-tip="上移一层"><span v-html="ICONS.layerUp"></span></button>
          <button @click="layerBackward()" data-tip="下移一层"><span v-html="ICONS.layerDown"></span></button>
          <button @click="layerToFront()" data-tip="置顶"><span v-html="ICONS.layerTop"></span></button>
          <button @click="layerToBack()" data-tip="置底"><span v-html="ICONS.layerBottom"></span></button>
        </div>
        <div class="sep" />
        <div class="dist-group">
          <button @click="distribute('horizontal')" data-tip="水平等间距分布"><span v-html="ICONS.distributeH"></span></button>
          <button @click="distribute('vertical')" data-tip="垂直等间距分布"><span v-html="ICONS.distributeV"></span></button>
        </div>
        <div class="sep" />
        <div class="group-btn">
          <button @click="groupSelected()" data-tip="组合 (Ctrl+G)"><span v-html="ICONS.group"></span></button>
          <button @click="ungroupSelected()" data-tip="取消组合 (Ctrl+Shift+G)"><span v-html="ICONS.ungroup"></span></button>
        </div>
        <div class="sep" />
        <div class="rotation-group">
          <span class="label">旋转</span>
          <input type="number" class="rotation-input" :value="currentRotation" @change="applyRotation(+$event.target.value)" min="-360" max="360" step="15" />
          <span class="label">°</span>
        </div>
        <div class="sep" />
        <!-- T9: 透明度 -->
        <div class="opacity-group">
          <span class="label">透明度</span>
          <input type="range" class="opacity-slider" :value="currentOpacity" @input="applyOpacity(+$event.target.value)" min="0" max="100" step="1" />
          <span class="info">{{ currentOpacity }}%</span>
        </div>
        <div class="sep" />
        <!-- T10: 渐变 -->
        <div class="gradient-group">
          <select class="gradient-select" v-model="gradientType" @change="applyGradientUI()">
            <option value="none">纯色</option>
            <option value="linear">线性渐变</option>
            <option value="radial">径向渐变</option>
          </select>
          <template v-if="gradientType !== 'none'">
            <input type="color" :value="gradientColor1" @input="gradientColor1 = $event.target.value; applyGradientUI()" />
            <input type="color" :value="gradientColor2" @input="gradientColor2 = $event.target.value; applyGradientUI()" />
            <input v-if="gradientType === 'linear'" type="number" class="angle-input" :value="gradientAngle" @change="gradientAngle = +$event.target.value; applyGradientUI()" min="0" max="360" step="15" />
            <span v-if="gradientType === 'linear'" class="label">°</span>
          </template>
        </div>
        <div class="sep" />
        <!-- T11: 阴影 -->
        <div class="shadow-group">
          <button @click="toggleShadowUI()" data-tip="阴影" :class="{ active: shadowEnabled }"><span v-html="ICONS.shadow"></span></button>
          <template v-if="shadowEnabled">
            <input type="color" :value="shadowColor" @input="shadowColor = $event.target.value; applyShadowUI()" data-tip="阴影颜色" />
            <span class="label">模糊</span>
            <input type="number" class="shadow-input" :value="shadowBlur" @change="shadowBlur = +$event.target.value; applyShadowUI()" min="0" max="50" />
            <span class="label">X</span>
            <input type="number" class="shadow-input" :value="shadowOffsetX" @change="shadowOffsetX = +$event.target.value; applyShadowUI()" min="-50" max="50" />
            <span class="label">Y</span>
            <input type="number" class="shadow-input" :value="shadowOffsetY" @change="shadowOffsetY = +$event.target.value; applyShadowUI()" min="-50" max="50" />
          </template>
        </div>
        <div class="spacer" />
        <span class="info">{{ selectionInfo }}</span>
        <div class="sep" />
        <div class="color-row">
          <span class="label">填充</span>
          <input type="color" :value="currentFill" @input="applyFill($event.target.value)" />
          <span class="label">边框</span>
          <input type="color" :value="currentStroke" @input="applyStroke($event.target.value)" />
          <span class="label">粗细</span>
          <select class="stroke-width-select" :value="currentStrokeWidth" @change="applyStrokeWidth(+$event.target.value)">
            <option v-for="w in [0.5,1,1.5,2,2.5,3,4,5]" :key="w" :value="w">{{ w }}</option>
          </select>
          <button @click="toggleStrokeDash()" data-tip="虚线" :class="{ active: currentStrokeDash }"><span v-html="ICONS.dashed"></span></button>
        </div>
        <div class="sep" />
        <!-- 文字格式 -->
        <div class="text-format-group">
          <select class="font-size-select" :value="currentFontSize" @change="applyFontSize(+$event.target.value)">
            <option v-for="s in [8,9,10,11,12,14,16,18,20,24,28,32,36,48,64,72,96]" :key="s" :value="s">{{ s }}</option>
          </select>
          <button @click="toggleBold()" data-tip="加粗" :class="{ active: currentFontWeight === 'bold' }"><span v-html="ICONS.bold"></span></button>
          <button @click="toggleItalic()" data-tip="斜体" :class="{ active: currentFontStyle === 'italic' }"><span v-html="ICONS.italic"></span></button>
          <button @click="toggleUnderline()" data-tip="下划线" :class="{ active: currentUnderline }"><span v-html="ICONS.underline"></span></button>
          <input type="color" :value="currentTextFill" @input="applyTextFill($event.target.value)" data-tip="文字颜色" />
          <div class="sep" />
          <button @click="applyTextAlign('left')" data-tip="文字左对齐" :class="{ active: currentTextAlign === 'left' }"><span v-html="ICONS.textLeft"></span></button>
          <button @click="applyTextAlign('center')" data-tip="文字居中" :class="{ active: currentTextAlign === 'center' }"><span v-html="ICONS.textCenter"></span></button>
          <button @click="applyTextAlign('right')" data-tip="文字右对齐" :class="{ active: currentTextAlign === 'right' }"><span v-html="ICONS.textRight"></span></button>
        </div>
        <div class="sep" />
        <button class="btn-save" data-tip="保存 (Ctrl+S)" @click="save" :disabled="saving">{{ saving ? '保存中...' : '保存' }}</button>
        <button data-tip="关闭" @click="emit('close')"><span v-html="ICONS.close"></span></button>
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
  background: rgba(15, 15, 15, 0.75);
  backdrop-filter: blur(12px) saturate(1.2);
  display: flex; align-items: center; justify-content: center;
  animation: overlayIn 0.2s ease;
}
@keyframes overlayIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.editor-panel {
  width: 92vw; height: 88vh;
  background: #191919;
  border-radius: 16px;
  overflow: hidden;
  display: flex; flex-direction: column;
  box-shadow: 0 0 0 1px rgba(255,255,255,0.06), 0 32px 80px rgba(0,0,0,0.55);
  animation: panelIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes panelIn {
  from { opacity: 0; transform: scale(0.96) translateY(8px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
/* ── 工具栏 ──────────────────────────────────── */
.editor-toolbar {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 14px;
  background: linear-gradient(180deg, #202020 0%, #1a1a1a 100%);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0; flex-wrap: wrap;
}
.editor-toolbar .title {
  font-size: 12px; color: #888; font-weight: 500;
  white-space: nowrap; max-width: 180px;
  overflow: hidden; text-overflow: ellipsis;
}
.editor-toolbar .sep {
  width: 1px; height: 22px;
  background: rgba(255,255,255,0.08);
  margin: 0 3px;
  flex-shrink: 0;
}
.editor-toolbar button {
  min-width: 32px; height: 32px;
  border: none; border-radius: 8px;
  background: transparent;
  color: #999;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s ease;
  padding: 0 6px;
  position: relative;
}
.editor-toolbar button:hover {
  background: rgba(255,255,255,0.08);
  color: #e0e0e0;
}
.editor-toolbar button:active {
  background: rgba(255,255,255,0.12);
  transform: scale(0.95);
}
.editor-toolbar button.active {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
}
.editor-toolbar button span { display: flex; align-items: center; justify-content: center; }
.editor-toolbar button span svg { width: 16px; height: 16px; stroke-width: 1.8; }
.editor-toolbar .info {
  font-size: 11px; color: #666;
  min-width: 40px; text-align: center;
  font-variant-numeric: tabular-nums;
}
.editor-toolbar .canvas-size {
  background: rgba(255,255,255,0.04);
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 11px;
  color: #777;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.3px;
}
/* tooltip */
.editor-toolbar button[data-tip] { position: relative; }
.editor-toolbar button[data-tip]:hover::after {
  content: attr(data-tip);
  position: absolute;
  bottom: -34px;
  left: 50%;
  transform: translateX(-50%);
  background: #2a2a2a;
  color: #ddd;
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 11px;
  white-space: nowrap;
  z-index: 10000;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  border: 1px solid rgba(255,255,255,0.08);
  animation: tipIn 0.15s ease;
}
@keyframes tipIn {
  from { opacity: 0; transform: translateX(-50%) translateY(4px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
.editor-toolbar .spacer { flex: 1; }
.editor-toolbar .btn-save {
  width: auto; padding: 0 14px;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: #fff;
  font-size: 12px; font-weight: 600;
  border: none;
  box-shadow: 0 1px 3px rgba(59,130,246,0.3);
}
.editor-toolbar .btn-save:hover {
  background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
  box-shadow: 0 2px 8px rgba(59,130,246,0.4);
}
.editor-toolbar .btn-save:disabled { opacity: 0.4; cursor: default; box-shadow: none; }
/* ── 工具栏分组 ──────────────────────────────── */
.align-group, .layer-group, .dist-group, .group-btn {
  display: flex; gap: 2px;
  background: rgba(255,255,255,0.03);
  padding: 2px; border-radius: 8px;
}
.rotation-group { display: flex; align-items: center; gap: 6px; }
.rotation-input {
  width: 48px; height: 26px;
  background: rgba(255,255,255,0.05);
  color: #ccc; border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px; font-size: 11px; padding: 0 6px;
  -moz-appearance: textfield;
  transition: border-color 0.15s;
}
.rotation-input:focus { border-color: #3b82f6; outline: none; }
.rotation-input::-webkit-inner-spin-button,
.rotation-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.opacity-group { display: flex; align-items: center; gap: 6px; }
.opacity-slider {
  width: 64px; height: 4px;
  cursor: pointer;
  accent-color: #3b82f6;
  border-radius: 2px;
}
.gradient-group { display: flex; align-items: center; gap: 6px; }
.gradient-select {
  width: 76px; height: 26px;
  background: rgba(255,255,255,0.05);
  color: #ccc; border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px; font-size: 11px; padding: 0 6px;
  transition: border-color 0.15s;
}
.gradient-select:focus { border-color: #3b82f6; outline: none; }
.gradient-group input[type="color"],
.shadow-group input[type="color"],
.color-row input[type="color"],
.text-format-group input[type="color"] {
  width: 26px; height: 26px;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px; cursor: pointer; padding: 0;
  background: transparent;
}
.angle-input, .shadow-input {
  width: 42px; height: 26px;
  background: rgba(255,255,255,0.05);
  color: #ccc; border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px; font-size: 11px; padding: 0 6px;
  -moz-appearance: textfield;
  transition: border-color 0.15s;
}
.angle-input:focus, .shadow-input:focus { border-color: #3b82f6; outline: none; }
.shadow-group { display: flex; align-items: center; gap: 6px; }
.color-row { display: flex; align-items: center; gap: 6px; }
.color-row .label, .rotation-group .label, .opacity-group .label, .shadow-group .label {
  font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 0.5px;
}
.color-row .stroke-width-select,
.text-format-group .font-size-select {
  width: 48px; height: 26px;
  background: rgba(255,255,255,0.05);
  color: #ccc; border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px; font-size: 11px; padding: 0 6px;
  transition: border-color 0.15s;
}
.color-row .stroke-width-select:focus,
.text-format-group .font-size-select:focus { border-color: #3b82f6; outline: none; }
.text-format-group { display: flex; align-items: center; gap: 3px; }
.text-format-group button {
  min-width: 28px; height: 28px;
}
/* ── 画布 ────────────────────────────────────── */
.editor-canvas {
  flex: 1; position: relative; overflow: hidden;
  /* 浅灰工作区 — 对标 vue-fabric-editor 的 workspace */
  background-color: #d8d8d8;
  /* 圆点网格：深色点，20px 间距 */
  background-image: radial-gradient(circle, #999 1px, transparent 1px);
  background-size: 20px 20px;
}
.editor-canvas canvas {
  position: absolute; top: 0; left: 0;
  width: 100% !important; height: 100% !important;
  /* 白色画布 + 阴影 — 模拟纸张浮在桌面上 */
  background: #fff;
  box-shadow: 0 2px 12px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06);
  border-radius: 2px;
}
.loading {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: #111; color: #555; font-size: 13px;
}
</style>
