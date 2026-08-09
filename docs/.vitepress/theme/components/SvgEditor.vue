<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'

const props = defineProps({
  src: { type: String, required: true }
})
const emit = defineEmits(['close', 'saved'])

const canvasRef = ref(null)
const overlayRef = ref(null)
const fabricCanvas = ref(null)
const loading = ref(true)
const saving = ref(false)
const zoomLevel = ref(100)
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
const keyHandlerFn = ref(null)
const originalViewBox = ref('')

// CSS 变量色彩方案（与 custom.css :root 中保持一致，共28个变量）
const CSS_COLORS = {
  // 背景面
  '#FFFFFF': '--diagram-surface-1', '#F8F9FA': '--diagram-surface-2', '#ECEFF1': '--diagram-surface-3',
  // 边框线
  '#BDBDBD': '--diagram-stroke-1', '#E0E0E0': '--diagram-stroke-2',
  // 文字
  '#333333': '--diagram-text-1', '#666666': '--diagram-text-2', '#888888': '--diagram-text-3',
  // 强调色 — 蓝
  '#1565C0': '--diagram-accent-1', '#E3F2FD': '--diagram-accent-bg-1', '#BBDEFB': '--diagram-accent-bg-1b', '#0D47A1': '--diagram-accent-text-1',
  // 强调色 — 绿
  '#2E7D32': '--diagram-accent-2', '#E8F5E9': '--diagram-accent-bg-2', '#C8E6C9': '--diagram-accent-bg-2b', '#1B5E20': '--diagram-accent-text-2',
  // 强调色 — 紫
  '#7B1FA2': '--diagram-accent-3', '#F3E5F5': '--diagram-accent-bg-3', '#E1BEE7': '--diagram-accent-bg-3b', '#4A148C': '--diagram-accent-text-3',
  // 强调色 — 橙
  '#E65100': '--diagram-accent-4', '#FFF3E0': '--diagram-accent-bg-4', '#BF360C': '--diagram-accent-text-4',
  // 强调色 — 红
  '#C62828': '--diagram-accent-5', '#FFCDD2': '--diagram-accent-bg-5', '#B71C1C': '--diagram-accent-text-5',
  // 箭头/连线
  '#555555': '--diagram-arrow',
  // 幽灵态（已读/不可用/占位）
  '#999999': '--diagram-ghost',
}
const VAR_TO_HEX = {}
for (const [hex, v] of Object.entries(CSS_COLORS)) VAR_TO_HEX[v] = hex

let undoStack = []
let redoStack = []

async function loadAndInit() {
  loading.value = true

  // 注册清理钩子 — 必须在第一个 await 之前，否则 Vue 无法关联组件实例
  onUnmounted(() => {
    if (keyHandlerFn.value) {
      document.removeEventListener('keydown', keyHandlerFn.value)
      keyHandlerFn.value = null
    }
    if (fabricCanvas.value) {
      fabricCanvas.value.dispose()
      fabricCanvas.value = null
    }
  })

  await nextTick()

  // 动态加载 Fabric.js（5s 超时）
  if (!window.fabric) {
    await Promise.race([
      new Promise((resolve) => {
        const s = document.createElement('script')
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js'
        s.onload = resolve
        s.onerror = () => resolve() // 加载失败也不阻塞，靠下方检查报错
        document.head.appendChild(s)
      }),
      new Promise(resolve => setTimeout(resolve, 5000))
    ])
    if (!window.fabric) {
      console.error('[SvgEditor] Fabric.js 加载失败（CDN 不可达或超时）')
      loading.value = false
      return
    }
  }

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
  svgText = svgText.replace(/<\?xml[^?]*\?>\s*/g, '')

  // 保存原始 viewBox，供保存时恢复
  const vbMatch = svgText.match(/viewBox="([^"]+)"/)
  if (vbMatch) originalViewBox.value = vbMatch[1]

  // CSS 变量 → 色值
  let renderSvg = svgText
  for (const [varName, hex] of Object.entries(VAR_TO_HEX)) {
    renderSvg = renderSvg.replaceAll(`var(${varName})`, hex)
  }

  // 预处理：将 <stop style="stop-color: ..."> 转为直接属性
  // Fabric.js 解析器对 style 属性中的 stop-color 支持有限
  renderSvg = renderSvg.replace(
    /<stop(\s[^>]*?)style="stop-color:\s*([^;"]+);\s*stop-opacity:\s*([^"]+)"([^>]*?)>/g,
    '<stop$1stop-color="$2" stop-opacity="$3"$4>'
  )

  // --- 箭头修复：解析 <marker> 定义，为每条箭头线合成三角形箭头 ---
  // Fabric.js 不支持 SVG <marker>，需要将 marker-end 替换为实体的 <polygon> 箭头三角形

  // 1. 提取 marker 定义：id → { fill, tipOffset }
  // tipOffset = tip 在 marker 坐标系中相对于 refX 的偏移
  const markers = {}
  // polygon 形式的 marker
  const markerPolyRe = /<marker\s+id="([^"]+)"[^>]*markerWidth="([^"]+)"[^>]*markerHeight="([^"]+)"[^>]*refX="([^"]+)"[^>]*refY="([^"]+)"[^>]*>\s*<polygon\s+[^>]*points="([^"]+)"[^>]*fill="([^"]+)"[^>]*\/>\s*<\/marker>/g
  let mm
  while ((mm = markerPolyRe.exec(renderSvg)) !== null) {
    const id = mm[1], refX = parseFloat(mm[4]), pts = mm[6], fill = mm[7]
    // 找 polygon 的最右点作为 tipX
    const tipX = Math.max(...pts.split(/[\s,]+/).filter((_, i) => i % 2 === 0).map(Number))
    markers[id] = { fill, tipOffset: tipX - refX }
  }
  // path 形式的 marker（如 M0,0 L8,4 L0,8 Z）
  const markerPathRe = /<marker\s+id="([^"]+)"[^>]*markerWidth="([^"]+)"[^>]*markerHeight="([^"]+)"[^>]*refX="([^"]+)"[^>]*refY="([^"]+)"[^>]*>\s*<path\s+[^>]*d="([^"]+)"[^>]*fill="([^"]+)"[^>]*\/>\s*<\/marker>/g
  while ((mm = markerPathRe.exec(renderSvg)) !== null) {
    const id = mm[1], refX = parseFloat(mm[4]), d = mm[6], fill = mm[7]
    // 提取 path d 中的所有 x 坐标，找最大值作为 tipX
    const nums = d.match(/[\d.]+/g)?.map(Number) || []
    const xCoords = nums.filter((_, i) => i % 2 === 0)
    const tipX = Math.max(...xCoords)
    markers[id] = { fill, tipOffset: tipX - refX }
  }

  // 2. 解析 <style> 中 CSS 类的 marker-end（如 .arrow { marker-end: url(#arrowhead) }）
  const classMarkers = {}
  const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi
  let sm
  while ((sm = styleRe.exec(renderSvg)) !== null) {
    const css = sm[1]
    const ruleRe = /\.([\w-]+)\s*\{[^}]*marker-end:\s*url\(#([^)]+)\)[^}]*\}/g
    let rm
    while ((rm = ruleRe.exec(css)) !== null) {
      classMarkers[rm[1]] = rm[2]
    }
  }

  // 3. 为每个 <line> 元素注入箭头三角形
  renderSvg = renderSvg.replace(
    /<line\s+([^>]*?)\s*\/>/g,
    (full, attrs) => {
      // 确定该 line 使用哪个 marker
      let markerId = ''
      const inlineMe = attrs.match(/marker-end="url\(#([^)]+)\)"/)
      if (inlineMe) {
        markerId = inlineMe[1]
      } else {
        const classMatch = attrs.match(/class="([^"]+)"/)
        if (classMatch) {
          for (const cls of classMatch[1].split(/\s+/)) {
            if (classMarkers[cls]) { markerId = classMarkers[cls]; break }
          }
        }
      }
      if (!markerId || !markers[markerId]) {
        // 没有匹配到 marker：保留原样但移除 marker-end 避免 Fabric.js 报错
        return full.replace(/\s*marker-end="[^"]*"/, '')
      }

      // 提取坐标
      const x1 = parseFloat((attrs.match(/x1="([^"]+)"/) || [])[1] || '0')
      const y1 = parseFloat((attrs.match(/y1="([^"]+)"/) || [])[1] || '0')
      const x2 = parseFloat((attrs.match(/x2="([^"]+)"/) || [])[1] || '0')
      const y2 = parseFloat((attrs.match(/y2="([^"]+)"/) || [])[1] || '0')

      // 计算箭头朝向
      const angle = Math.atan2(y2 - y1, x2 - x1)
      // 底边中心在线终点，尖端朝外延伸（tipOffset 来自 marker 定义）
      const marker = markers[markerId]
      const tipOffset = marker.tipOffset || 0
      const sx = 4 * Math.sin(angle)
      const sy = -4 * Math.cos(angle)
      const tipX = x2 + tipOffset * Math.cos(angle)
      const tipY = y2 + tipOffset * Math.sin(angle)
      const points = `${tipX.toFixed(1)},${tipY.toFixed(1)} ${(x2 + sx).toFixed(1)},${(y2 + sy).toFixed(1)} ${(x2 - sx).toFixed(1)},${(y2 - sy).toFixed(1)}`

      // 移除 marker-end，保留其余属性
      const cleanAttrs = attrs.replace(/\s*marker-end="[^"]*"/, '')

      return `<line ${cleanAttrs}/><polygon points="${points}" fill="${marker.fill}"/>`
    }
  )

  // 4. 为 <path> 元素做同样的注入（取 path d 的最后两个数字作为终点）
  renderSvg = renderSvg.replace(
    /<path\s+([^>]*?)marker-end="url\(#([^)]+)\)"\s*([^>]*?)\s*\/>/g,
    (full, before, markerId, after) => {
      if (!markers[markerId]) return full.replace(/\s*marker-end="[^"]*"/, '')
      // 提取 d 属性的最后两个数值作为终点坐标
      const dMatch = (before + ' ' + after).match(/d="([^"]+)"/)
      if (!dMatch) return full
      const nums = dMatch[1].trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n))
      if (nums.length < 2) return full
      const x2 = nums[nums.length - 2]
      const y2 = nums[nums.length - 1]
      const x1 = nums.length >= 4 ? nums[nums.length - 4] : x2 - 10
      const y1 = nums.length >= 4 ? nums[nums.length - 3] : y2
      const angle = Math.atan2(y2 - y1, x2 - x1)
      // 底边中心在线终点，尖端朝外延伸（tipOffset 来自 marker 定义）
      const marker = markers[markerId]
      const tipOffset = marker.tipOffset || 0
      const sx = 4 * Math.sin(angle)
      const sy = -4 * Math.cos(angle)
      const tipX = x2 + tipOffset * Math.cos(angle)
      const tipY = y2 + tipOffset * Math.sin(angle)
      const points = `${tipX.toFixed(1)},${tipY.toFixed(1)} ${(x2 + sx).toFixed(1)},${(y2 + sy).toFixed(1)} ${(x2 - sx).toFixed(1)},${(y2 - sy).toFixed(1)}`
      const combined = (before + ' ' + after).replace(/\s*marker-end="[^"]*"/, '')
      return `<path ${combined}/><polygon points="${points}" fill="${marker.fill}"/>`
    }
  )

  const container = canvasRef.value
  if (!container) return
  // 等待浏览器完成 layout 计算，确保 container 有正确的 clientWidth/Height
  await new Promise(resolve => requestAnimationFrame(resolve))
  // 给 flex 布局再多一帧时间来稳定
  await new Promise(resolve => requestAnimationFrame(resolve))
  const w = container.clientWidth || 800
  const h = container.clientHeight || 500

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
    try {
      // 合并散落的 line+polygon 为 Group（Fabric.js 可能不自动识别 <g> 包裹的箭头对）
      const merged = mergeArrows(objects)

      // 将 Text 转为 Textbox，实现 Office 式自动换行 + 缩放时字体大小不变
      const convertToTextbox = (obj) => {
        if (!obj) return obj
        if (obj.type === 'text') {
          try {
            const textbox = new window.fabric.Textbox(obj.text || '', {
              left: obj.left || 0, top: obj.top || 0,
              width: Math.max((obj.width || 80) + 20, 40),
              fontSize: obj.fontSize || 12, fontFamily: obj.fontFamily || 'sans-serif',
              fontWeight: obj.fontWeight || 'normal', fontStyle: obj.fontStyle || 'normal',
              fill: obj.fill || '#000000',
              stroke: obj.stroke || '', strokeWidth: obj.strokeWidth || 0,
              textAlign: obj.textAlign || 'left',
              lineHeight: obj.lineHeight || 1.16,
              charSpacing: obj.charSpacing || 0,
              opacity: obj.opacity != null ? obj.opacity : 1,
              angle: obj.angle || 0,
              originX: obj.originX || 'left', originY: obj.originY || 'top',
              selectable: true, evented: true,
              editable: true, splitByGrapheme: true,
            })
            return textbox
          } catch (e) {
            console.warn('[SvgEditor] Text→Textbox 转换失败，保留原 Text:', e)
            return obj
          }
        }
        if (obj._objects) {
          obj._objects = obj._objects.map(convertToTextbox)
        }
        return obj
      }
      const converted = merged.map(convertToTextbox)
      const setInteractive = (o) => {
        o.set({ selectable: true, evented: true })
        // 递归设置 group 成员，确保子对象也可交互
        if (o._objects) o._objects.forEach(setInteractive)
      }
      converted.forEach(obj => {
        setInteractive(obj)
        fc.add(obj)
      })
      fc.renderAll()
      zoomFit(fc)
      saveState(fc)
    } catch (e) {
      console.error('[SvgEditor] SVG 加载失败:', e)
    } finally {
      loading.value = false
      fabricCanvas.value = fc
    }
  })

  // 事件
  fc.on('selection:created', () => updateSelection(fc))
  fc.on('selection:updated', () => updateSelection(fc))
  fc.on('selection:cleared', () => { selectionInfo.value = '' })
  fc.on('object:modified', (e) => {
    // Textbox 缩放归一化：将 scaleX/scaleY 转为 width/height，fontSize 不变
    const obj = e.target
    if (obj && (obj.type === 'textbox' || obj.type === 'i-text')) {
      if (obj.__scalingFontSize != null) {
        const origFontSize = obj.__scalingFontSize
        const newWidth = Math.max(obj.width * obj.scaleX, 30)
        obj.set({ width: newWidth, scaleX: 1, scaleY: 1, fontSize: origFontSize })
        delete obj.__scalingFontSize
        obj.setCoords()
        fc.requestRenderAll()
      }
    }
    saveState(fc)
  })

  // Textbox 缩放时保持字体大小不变（Office 行为：拖四角只改框大小，不改字号）
  fc.on('object:scaling', (e) => {
    const obj = e.target
    if (!obj || (obj.type !== 'textbox' && obj.type !== 'i-text')) return
    if (obj.__scalingFontSize == null) {
      obj.__scalingFontSize = obj.fontSize
    }
    // 用 fontSize/scaleY 抵消 Fabric.js 对字号的视觉缩放
    obj.set({ fontSize: obj.__scalingFontSize / Math.max(obj.scaleY, 0.1) })
  })

  // 快捷键
  keyHandlerFn.value = (e) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(fc) }
      if (e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(fc) }
      if (e.key === 'y') { e.preventDefault(); redo(fc) }
      if (e.key === 'c') { e.preventDefault(); copyObj(fc) }
      if (e.key === 'v') { e.preventDefault(); pasteObj(fc) }
      if (e.key === 's') { e.preventDefault(); save() }
      if (e.key === 'b') { e.preventDefault(); toggleBold(fc) }
      if (e.key === 'i') { e.preventDefault(); toggleItalic(fc) }
      if (e.key === 'u') { e.preventDefault(); toggleUnderline(fc) }
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault(); deleteObj(fc)
      }
    }
    if (e.key === 'Escape') emit('close')
  }
  document.addEventListener('keydown', keyHandlerFn.value)
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
  if (active.strokeWidth) currentStrokeWidth.value = active.strokeWidth
  if (active.strokeDashArray) currentStrokeDash.value = true
  else currentStrokeDash.value = false
  // 文字格式
  if (active.fontSize) currentFontSize.value = active.fontSize
  if (active.fontWeight) currentFontWeight.value = active.fontWeight
  if (active.fontStyle) currentFontStyle.value = active.fontStyle
  if (active.underline !== undefined) currentUnderline.value = active.underline
  if (active.textAlign) currentTextAlign.value = active.textAlign
  if (active.fill && typeof active.fill === 'string') currentTextFill.value = active.fill
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
function applyStrokeWidth(fc, w) { const a = fc.getActiveObject(); if (a) { a.set('strokeWidth', w); currentStrokeWidth.value = w; fc.renderAll(); saveState(fc) } }
function toggleStrokeDash(fc) {
  const a = fc.getActiveObject()
  if (!a) return
  const next = !currentStrokeDash.value
  a.set('strokeDashArray', next ? [6, 3] : null)
  currentStrokeDash.value = next
  fc.renderAll(); saveState(fc)
}
function applyFontSize(fc, size) { const a = fc.getActiveObject(); if (a && (a.type === 'textbox' || a.type === 'i-text')) { a.set('fontSize', size); fc.renderAll(); saveState(fc) } }
function toggleBold(fc) {
  const a = fc.getActiveObject()
  if (!a || (a.type !== 'textbox' && a.type !== 'i-text')) return
  const next = a.fontWeight === 'bold' ? 'normal' : 'bold'
  a.set('fontWeight', next)
  currentFontWeight.value = next
  fc.renderAll(); saveState(fc)
}
function toggleItalic(fc) {
  const a = fc.getActiveObject()
  if (!a || (a.type !== 'textbox' && a.type !== 'i-text')) return
  const next = a.fontStyle === 'italic' ? 'normal' : 'italic'
  a.set('fontStyle', next)
  currentFontStyle.value = next
  fc.renderAll(); saveState(fc)
}
function toggleUnderline(fc) {
  const a = fc.getActiveObject()
  if (!a || (a.type !== 'textbox' && a.type !== 'i-text')) return
  const next = !a.underline
  a.set('underline', next)
  currentUnderline.value = next
  fc.renderAll(); saveState(fc)
}
function applyTextAlign(fc, align) {
  const a = fc.getActiveObject()
  if (!a || (a.type !== 'textbox' && a.type !== 'i-text')) return
  a.set('textAlign', align)
  currentTextAlign.value = align
  fc.renderAll(); saveState(fc)
}
function applyTextFill(fc, hex) {
  const a = fc.getActiveObject()
  if (!a || (a.type !== 'textbox' && a.type !== 'i-text')) return
  a.set('fill', hex)
  currentTextFill.value = hex
  fc.renderAll(); saveState(fc)
}
// 层级控制
function layerForward(fc) { const a = fc.getActiveObject(); if (a) { fc.bringForward(a); fc.renderAll(); saveState(fc) } }
function layerBackward(fc) { const a = fc.getActiveObject(); if (a) { fc.sendBackwards(a); fc.renderAll(); saveState(fc) } }
function layerToFront(fc) { const a = fc.getActiveObject(); if (a) { fc.bringToFront(a); fc.renderAll(); saveState(fc) } }
function layerToBack(fc) { const a = fc.getActiveObject(); if (a) { fc.sendToBack(a); fc.renderAll(); saveState(fc) } }
// 等间距分布
function distribute(fc, dir) {
  const objs = fc.getActiveObject()?._objects
  if (!objs || objs.length < 3) return
  if (dir === 'horizontal') {
    objs.sort((a, b) => a.left - b.left)
    const first = objs[0].left
    const lastObj = objs[objs.length - 1]
    const last = lastObj.left + lastObj.width * (lastObj.scaleX || 1)
    const totalWidth = objs.reduce((s, o) => s + o.width * (o.scaleX || 1), 0)
    const gap = (last - first - totalWidth) / (objs.length - 1)
    let x = first
    for (const o of objs) {
      o.set('left', x)
      x += o.width * (o.scaleX || 1) + gap
    }
  } else {
    objs.sort((a, b) => a.top - b.top)
    const first = objs[0].top
    const lastObj = objs[objs.length - 1]
    const last = lastObj.top + lastObj.height * (lastObj.scaleY || 1)
    const totalHeight = objs.reduce((s, o) => s + o.height * (o.scaleY || 1), 0)
    const gap = (last - first - totalHeight) / (objs.length - 1)
    let y = first
    for (const o of objs) {
      o.set('top', y)
      y += o.height * (o.scaleY || 1) + gap
    }
  }
  fc.renderAll(); saveState(fc)
}

// --- Fabric.js toSVG() 格式清理 ---
// 将 Fabric.js 输出的 SVG 还原为原始简洁格式
function cleanFabricSvg(svg) {
  let s = svg

  // 1. 移除 Fabric.js 附加的头部信息
  s = s.replace(/<\?xml[^?]*\?>\s*/g, '')
  s = s.replace(/<!DOCTYPE[^>]*>\s*/g, '')
  s = s.replace(/<desc>[^<]*<\/desc>\s*/g, '')
  s = s.replace(/<defs>\s*<\/defs>\s*/g, '')
  s = s.replace(/ xmlns:xlink="[^"]*"/g, '')
  s = s.replace(/ version="[^"]*"/g, '')
  s = s.replace(/ xml:space="preserve"/g, '')

  // 提取 style 属性中的核心属性并转为直接属性
  function extractStyleAttrs(styleStr) {
    if (!styleStr) return ''
    const keep = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray',
      'fill-rule', 'opacity', 'font-family', 'font-size', 'font-weight',
      'font-style', 'text-anchor']
    const result = []
    for (const prop of styleStr.split(';')) {
      const [key, val] = prop.split(':').map(p => p.trim())
      if (key && val && keep.includes(key)) {
        result.push(`${key}="${val}"`)
      }
    }
    return result.join(' ')
  }

  // 2. 展开 Fabric.js 的 Group 包裹（矩阵平移 → 绝对坐标）
  // Fabric.js 将每个元素包裹在 <g transform="matrix(1 0 0 1 tx ty)"> 中
  // 需要将子元素的坐标转为绝对坐标
  s = s.replace(
    /<g\s+transform="matrix\(1\s+0\s+0\s+1\s+([\d.\-]+)\s+([\d.\-]+)\)"[^>]*>\s*([\s\S]*?)<\/g>/g,
    (full, txStr, tyStr, inner) => {
      const tx = parseFloat(txStr)
      const ty = parseFloat(tyStr)
      // 只处理单个子元素的情况
      const trimmed = inner.trim()

      // 处理 <text><tspan> 结构
      const textMatch = trimmed.match(
        /^(<text[^>]*>)\s*<tspan\s+x="([\d.\-]+)"\s+y="([\d.\-]+)"[^>]*>([\s\S]*?)<\/tspan>\s*<\/text>$/
      )
      if (textMatch) {
        const origAttrs = textMatch[1]
        const localX = parseFloat(textMatch[2])
        const localY = parseFloat(textMatch[3])
        const content = textMatch[4]
        const absX = tx + localX
        const absY = ty + localY
        let attrs = origAttrs
          .replace(/\s+xml:space="preserve"/g, '')
          .replace(/^<text/, `<text x="${absX.toFixed(1)}" y="${absY.toFixed(1)}"`)
          .replace(/>$/, '')
        return `${attrs}>${content}</text>`
      }

      // 处理 <rect> 结构
      const rectMatch = trimmed.match(
        /^(<rect[^>]*?)\s+style="[^"]*"([^>]*\/>)\s*$/
      )
      if (rectMatch) {
        let attrs = trimmed
          .replace(/ x="([\d.\-]+)"/, (m, x) => ` x="${(tx + parseFloat(x)).toFixed(1)}"`)
          .replace(/ y="([\d.\-]+)"/, (m, y) => ` y="${(ty + parseFloat(y)).toFixed(1)}"`)
        return attrs
      }

      // 处理 <line> 结构
      const lineMatch = trimmed.match(
        /^(<line[^>]*?)\s+style="[^"]*"([^>]*\/>)\s*$/
      )
      if (lineMatch) {
        let attrs = trimmed
        attrs = attrs.replace(/ x1="([\d.\-]+)"/, (m, v) => ` x1="${(tx + parseFloat(v)).toFixed(1)}"`)
        attrs = attrs.replace(/ y1="([\d.\-]+)"/, (m, v) => ` y1="${(ty + parseFloat(v)).toFixed(1)}"`)
        attrs = attrs.replace(/ x2="([\d.\-]+)"/, (m, v) => ` x2="${(tx + parseFloat(v)).toFixed(1)}"`)
        attrs = attrs.replace(/ y2="([\d.\-]+)"/, (m, v) => ` y2="${(ty + parseFloat(v)).toFixed(1)}"`)
        return attrs
      }

      // 处理 <polygon> 结构
      const polyMatch = trimmed.match(
        /^(<polygon[^>]*?)\s+style="[^"]*"([^>]*\/>)\s*$/
      )
      if (polyMatch) {
        let attrs = trimmed.replace(/ points="([^"]+)"/, (m, pts) => {
          const newPts = pts.trim().split(/\s+/).map((pair) => {
            const [x, y] = pair.split(',').map(Number)
            return `${(tx + x).toFixed(1)},${(ty + y).toFixed(1)}`
          }).join(' ')
          return ` points="${newPts}"`
        })
        return attrs
      }

      // 多个子元素或无法识别，保留原始 Group
      return full
    }
  )

  // 3. 清理 Fabric.js 特有的冗余属性（保留 style 中的核心属性）
  // 不再提取 style 为直接属性，保留 style 原样

  // 4. 清理多余的空白行
  s = s.replace(/\n\s*\n/g, '\n')

  return s.trim()
}

async function save() {
  if (!fabricCanvas.value) return
  saving.value = true
  const fc = fabricCanvas.value
  let svgText = fc.toSVG()

  // 清理 Fabric.js 的格式，还原为简洁 SVG
  svgText = cleanFabricSvg(svgText)

  // Fabric.js toSVG() 输出 rgb() 格式色值（如 fill: rgb(51,51,51)），
  // 必须先转为 hex（如 #333333），CSS 变量替换才能命中
  svgText = svgText.replace(
    /rgb\((\d+),\s*(\d+),\s*(\d+)\)/gi,
    (_, r, g, b) => '#' + [r, g, b].map(x => parseInt(x).toString(16).padStart(2, '0').toUpperCase()).join('')
  )

  // 移除 Fabric.js 自动添加的画布背景 rect（会干扰原始 SVG 的背景设计）
  // Fabric.js toSVG() 可能输出 <rect ... /> 或 <rect ...></rect>，两种都要匹配
  svgText = svgText.replace(/<rect\s+x="0"\s+y="0"\s+width="100%"\s+height="100%"\s+fill="#F5F5F5"\s*\/?>\s*(?:<\/rect>)?\s*/gi, '')

  // 恢复原始 viewBox（Fabric.js 会基于 canvas content bounds 重新计算 viewBox）
  if (originalViewBox.value) {
    svgText = svgText.replace(/viewBox="[^"]*"/, `viewBox="${originalViewBox.value}"`)
  }

  // 移除 Fabric.js 添加的 width/height（canvas 尺寸 ≠ SVG 逻辑尺寸，会破坏响应式缩放）
  // 只保留 viewBox 让浏览器自动计算比例
  svgText = svgText.replace(/\s+width="[^"]*"/, '').replace(/\s+height="[^"]*"/, '')

  // 色值 → CSS 变量（此时已全部转为 hex，可以正常命中）
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
// 打开时聚焦 overlay，确保 Escape 键生效
onMounted(() => { nextTick(() => { overlayRef.value?.focus() }) })
</script>

<template>
  <div class="editor-overlay" @click.self="emit('close')" @keydown.escape="emit('close')" tabindex="-1" ref="overlayRef">
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
        <div class="sep" />
        <div class="layer-group">
          <button @click="layerForward(fabricCanvas)" title="上移一层">⬆</button>
          <button @click="layerBackward(fabricCanvas)" title="下移一层">⬇</button>
          <button @click="layerToFront(fabricCanvas)" title="置顶">⏫</button>
          <button @click="layerToBack(fabricCanvas)" title="置底">⏬</button>
        </div>
        <div class="sep" />
        <div class="dist-group">
          <button @click="distribute(fabricCanvas,'horizontal')" title="水平等间距分布">⇔</button>
          <button @click="distribute(fabricCanvas,'vertical')" title="垂直等间距分布">⇕</button>
        </div>
        <div class="spacer" />
        <span class="info">{{ selectionInfo }}</span>
        <div class="sep" />
        <div class="color-row">
          <span class="label">填充</span>
          <input type="color" :value="currentFill" @input="applyFill(fabricCanvas, $event.target.value)" />
          <span class="label">边框</span>
          <input type="color" :value="currentStroke" @input="applyStroke(fabricCanvas, $event.target.value)" />
          <span class="label">粗细</span>
          <select class="stroke-width-select" :value="currentStrokeWidth" @change="applyStrokeWidth(fabricCanvas, +$event.target.value)">
            <option v-for="w in [0.5,1,1.5,2,2.5,3,4,5]" :key="w" :value="w">{{ w }}</option>
          </select>
          <button @click="toggleStrokeDash(fabricCanvas)" title="虚线" :class="{ active: currentStrokeDash }" style="font-size:10px">╌</button>
        </div>
        <div class="sep" />
        <!-- 文字格式 -->
        <div class="text-format-group">
          <select class="font-size-select" :value="currentFontSize" @change="applyFontSize(fabricCanvas, +$event.target.value)">
            <option v-for="s in [8,9,10,11,12,14,16,18,20,24,28,32,36,48,64,72,96]" :key="s" :value="s">{{ s }}</option>
          </select>
          <button @click="toggleBold(fabricCanvas)" title="加粗" :class="{ active: currentFontWeight === 'bold' }"><b>B</b></button>
          <button @click="toggleItalic(fabricCanvas)" title="斜体" :class="{ active: currentFontStyle === 'italic' }"><i>I</i></button>
          <button @click="toggleUnderline(fabricCanvas)" title="下划线" :class="{ active: currentUnderline }"><u>U</u></button>
          <input type="color" :value="currentTextFill" @input="applyTextFill(fabricCanvas, $event.target.value)" title="文字颜色" />
          <div class="sep" />
          <button @click="applyTextAlign(fabricCanvas,'left')" title="文字左对齐" :class="{ active: currentTextAlign === 'left' }">≡</button>
          <button @click="applyTextAlign(fabricCanvas,'center')" title="文字居中" :class="{ active: currentTextAlign === 'center' }">≡</button>
          <button @click="applyTextAlign(fabricCanvas,'right')" title="文字右对齐" :class="{ active: currentTextAlign === 'right' }">≡</button>
        </div>
        <div class="sep" />
        <button class="btn-save" title="保存" @click="save" :disabled="saving">{{ saving ? '保存中...' : '💾 保存' }}</button>
        <button title="关闭" @click="emit('close')">✕</button>
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
.layer-group { display: flex; gap: 1px; }
.dist-group { display: flex; gap: 1px; }
.color-row { display: flex; align-items: center; gap: 4px; }
.color-row .label { font-size: 10px; color: #888; }
.color-row input[type="color"] { width: 24px; height: 24px; border: 1px solid #555; border-radius: 3px; cursor: pointer; padding: 0; }
.color-row .stroke-width-select {
  width: 42px; height: 24px; background: #333; color: #ccc; border: 1px solid #555;
  border-radius: 3px; font-size: 11px; padding: 0 2px;
}
.color-row button.active { background: #0078d4; color: #fff; }
.text-format-group { display: flex; align-items: center; gap: 2px; }
.text-format-group .font-size-select {
  width: 52px; height: 24px; background: #333; color: #ccc; border: 1px solid #555;
  border-radius: 3px; font-size: 11px; padding: 0 2px;
}
.text-format-group button {
  width: 24px; height: 24px; font-size: 12px;
}
.text-format-group button.active { background: #0078d4; color: #fff; }
.text-format-group input[type="color"] { width: 20px; height: 24px; border: 1px solid #555; border-radius: 3px; cursor: pointer; padding: 0; }
.editor-canvas { flex: 1; position: relative; overflow: hidden; }
.editor-canvas canvas { position: absolute; top: 0; left: 0; }
.loading {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: #1e1e1e; color: #888; font-size: 14px;
}
</style>
