<script setup>
/**
 * SVG 编辑器 — vue-fabric-editor 原生工具栏集成版
 *
 * 直接复用原生组件：history / tools / layer / clone / del / group / flip / align
 * 通过 provide('fabric') + provide('canvasEditor') 传递给子组件（inject 模式）
 */
import { ref, provide, onMounted, onUnmounted, nextTick } from 'vue'
import { fabric } from 'fabric'

// ═══════ 原生工具栏组件 ═══════
import History from './editor/components/history.vue'
import Tools   from './editor/components/tools.vue'
import Layer   from './editor/components/layer.vue'
import Clone   from './editor/components/clone.vue'
import Del     from './editor/components/del.vue'
import Group   from './editor/components/group.vue'
import Flip    from './editor/components/flip.vue'
import Align   from './editor/components/align.vue'

// ═══════ CSS 变量映射 ═══════
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

const props = defineProps({
  src:            { type: String, required: true },
  resolveCssVars: { type: [Boolean, String], default: true },
  mode:           { type: String, default: 'light' },
})
const emit = defineEmits(['close', 'saved'])

const canvasRef  = ref(null)
const loading    = ref(true)
const saving     = ref(false)
const leftTab    = ref('tools')   // tools | layer
const leftOpen   = ref(true)

let canvasEditor = null
let canvas       = null
let _keyHandler  = null
let _originalViewBox = ''
let _cssVarEnabled  = false
let _cssVarMode     = 'light'

// ═══════ 初始化 ═══════
onMounted(async () => {
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

  canvas = new fabric.Canvas(canvasRef.value, {
    width:  processed.svgWidth  || 800,
    height: processed.svgHeight || 600,
    fireRightClick: true, stopContextMenu: true,
    controlsAboveOverlay: true, preserveObjectStacking: true,
    backgroundColor: '#f1f1f1',
  })

  // 提供给原生组件（通过 inject）
  provide('fabric', fabric)
  provide('canvasEditor', canvasEditor)  // 先 provide 引用，后面再赋实际值

  const [
    { default: Editor }, { default: DringPlugin },
    { default: ControlsPlugin }, { default: LayerPlugin },
    { default: CopyPlugin }, { default: GroupPlugin },
    { default: HistoryPlugin }, { default: AlignGuidLinePlugin },
    { default: CenterAlignPlugin }, { default: MoveHotKeyPlugin },
    { default: DeleteHotKeyPlugin }, { default: DrawLinePlugin },
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
    import('@kuaitu/core/plugin/DrawLinePlugin'),
  ])

  canvasEditor = new Editor()
  canvasEditor.init(canvas)
  canvasEditor.use(DringPlugin).use(ControlsPlugin).use(LayerPlugin)
    .use(CopyPlugin).use(GroupPlugin).use(HistoryPlugin)
    .use(AlignGuidLinePlugin).use(CenterAlignPlugin)
    .use(MoveHotKeyPlugin).use(DeleteHotKeyPlugin).use(DrawLinePlugin)

  try { await loadSvgToCanvas(processed.svg) } catch (e) { /* */ }
  loading.value = false

  _keyHandler = (e) => { if (e.key === 'Escape') emit('close') }
  document.addEventListener('keydown', _keyHandler)
})

onUnmounted(() => {
  if (_keyHandler) document.removeEventListener('keydown', _keyHandler)
  if (canvasEditor) canvasEditor.destory()
  canvas = null; canvasEditor = null
})

function preprocessSvg(svg) {
  let s = svg.replace(/<\?xml[^?]*\?>\s*/g, '')
  if (_cssVarEnabled) {
    const varmap = _cssVarMode === 'dark' ? DARK_VAR_TO_HEX : LIGHT_VAR_TO_HEX
    for (const [k, v] of Object.entries(varmap)) s = s.replaceAll(`var(${k})`, v)
  }
  s = s.replace(/<stop(\s[^>]*?)style="stop-color:\s*([^;"]+);\s*stop-opacity:\s*([^"]+)"([^>]*?)>/g,
    '<stop$1stop-color="$2" stop-opacity="$3"$4>')
  const vb = (s.match(/viewBox="([^"]+)"/) || [])[1] || ''
  _originalViewBox = vb
  const parts = vb.split(/[\s,]+/).map(Number)
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

function toggleTab(tab) {
  if (leftTab.value === tab) { leftOpen.value = !leftOpen.value; return }
  leftTab.value = tab; leftOpen.value = true
}
</script>

<template>
  <div class="editor-overlay" @click.self="emit('close')">
    <div class="editor-panel">
      <!-- ═══════ 顶部工具栏（原生） ═══════ -->
      <div class="editor-topbar">
        <History />
        <div class="topbar-divider" />
        <Clone /><Del />
        <div class="topbar-divider" />
        <Group />
        <div class="topbar-divider" />
        <Flip />
        <div class="topbar-divider" />
        <Align />

        <div class="topbar-spacer" />
        <span v-if="loading" class="topbar-info">加载中…</span>
        <span v-if="saving" class="topbar-info">保存中…</span>
        <Button class="topbar-save-btn" type="primary" size="small" @click="handleSave" :disabled="saving" icon="ios-save">保存</Button>
        <Button class="topbar-close-btn" type="text" size="small" @click="emit('close')" icon="ios-close"></Button>
      </div>

      <!-- ═══════ 主体：左侧面板 + 画布 ═══════ -->
      <div class="editor-main">
        <!-- 左侧标签按钮 -->
        <div class="left-tab-bar">
          <Button class="left-tab-btn" :class="{ active: leftTab === 'tools' && leftOpen }" @click="toggleTab('tools')" type="text" size="small" long>
            <Icon type="md-images" size="20" /><span class="tab-label">元素</span>
          </Button>
          <Button class="left-tab-btn" :class="{ active: leftTab === 'layer' && leftOpen }" @click="toggleTab('layer')" type="text" size="small" long>
            <Icon type="md-reorder" size="20" /><span class="tab-label">图层</span>
          </Button>
        </div>

        <!-- 工具面板 -->
        <div v-show="leftOpen" class="left-panel">
          <div v-if="leftTab === 'tools'" class="panel-content">
            <Tools />
          </div>
          <div v-if="leftTab === 'layer'" class="panel-content">
            <Layer />
          </div>
        </div>

        <!-- 画布区域 -->
        <div class="canvas-wrap">
          <div class="canvas-box">
            <canvas ref="canvasRef" id="svg-editor-canvas"></canvas>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ═══════ 覆盖层 ═══════ */
.editor-overlay { position: fixed; inset: 0; z-index: 9999; background: rgba(15,15,15,.72); backdrop-filter: blur(12px); display: flex; align-items: center; justify-content: center; animation: ovIn .2s ease; }
@keyframes ovIn { from { opacity: 0 } to { opacity: 1 } }
.editor-panel { width: 96vw; height: 92vh; background: #fff; border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 32px 80px rgba(0,0,0,.4); animation: pnIn .25s cubic-bezier(.16,1,.3,1); }
@keyframes pnIn { from { opacity: 0; transform: scale(.96) translateY(8px) } to { opacity: 1; transform: scale(1) translateY(0) } }

/* ═══════ 顶部工具栏 ═══════ */
.editor-topbar { display: flex; align-items: center; gap: 2px; padding: 4px 10px; background: #fff; border-bottom: 1px solid #eef2f8; flex-shrink: 0; min-height: 44px; overflow-x: auto; }
.topbar-divider { width: 1px; height: 22px; background: #e8e8e8; margin: 0 4px; flex-shrink: 0; }
.topbar-spacer { flex: 1; }
.topbar-info { font-size: 11px; color: #aaa; margin: 0 6px; flex-shrink: 0; }
.topbar-save-btn { margin-right: 6px; }
.topbar-close-btn { font-size: 18px; }

/* ═══════ 主体 ═══════ */
.editor-main { flex: 1; display: flex; overflow: hidden; }

/* ═══════ 左侧标签栏 ═══════ */
.left-tab-bar { width: 64px; background: #fff; border-right: 1px solid #eef2f8; flex-shrink: 0; padding: 8px 0; display: flex; flex-direction: column; }
.left-tab-btn { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 10px 2px; font-size: 11px; border-radius: 0; border: none; color: #666; }
.left-tab-btn:hover { color: #2d8cf0; }
.left-tab-btn.active { color: #2d8cf0; border-right: 2px solid #2d8cf0; background: #f0faff; }
.tab-label { line-height: 1; font-size: 10px; }

/* ═══════ 工具面板 ═══════ */
.left-panel { width: 280px; border-right: 1px solid #eef2f8; background: #fafafa; overflow-y: auto; flex-shrink: 0; }
.panel-content { padding: 0; }

/* ═══════ 画布 ═══════ */
.canvas-wrap { flex: 1; overflow: auto; background: #f1f1f1; }
.canvas-box { display: flex; align-items: flex-start; justify-content: center; padding: 32px; min-width: 100%; min-height: 100%; }
</style>
