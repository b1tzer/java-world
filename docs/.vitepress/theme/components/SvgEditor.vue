<script setup>
/**
 * SVG 编辑器 — 直接集成 vue-fabric-editor 的 Editor 核心（非 iframe）
 *
 * props:
 *   src             - SVG 文件路径
 *   resolveCssVars  - 是否处理 CSS 变量（默认 true，可选 light/dark 模式）
 *   mode            - 明暗模式 'light' | 'dark'（默认 'light'）
 */
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { fabric } from 'fabric'

// ═══════════ CSS 变量 ↔ hex 映射表（内联，避免模块导入问题）═══════════
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
  resolveCssVars: { type: [Boolean, String], default: true }, // true / 'light' / 'dark'
  mode:           { type: String, default: 'light' },          // 'light' | 'dark'
})
const emit = defineEmits(['close', 'saved'])

const canvasRef = ref(null)
const loading = ref(true)
const saving = ref(false)
let canvasEditor = null
let canvas = null
let _keyHandler = null
let _originalViewBox = ''
let _cssVarEnabled = false    // 实际是否启用 CSS 变量解析
let _cssVarMode = 'light'     // 实际使用的模式

onMounted(async () => {
  await nextTick()

  // 确定 CSS 变量解析模式
  if (props.resolveCssVars === true || props.resolveCssVars === 'true') {
    _cssVarEnabled = true
    _cssVarMode = props.mode || 'light'
  } else if (typeof props.resolveCssVars === 'string') {
    _cssVarEnabled = true
    _cssVarMode = props.resolveCssVars
  }

  // 1. 加载 SVG 内容
  const base = import.meta.env.BASE_URL || '/'
  const url = props.src.startsWith('/') ? base + props.src.slice(1) : props.src
  let rawSvg = ''
  try {
    const resp = await fetch(url)
    if (resp.ok) rawSvg = await resp.text()
    else { loading.value = false; return }
  } catch (e) {
    console.error('[SvgEditor] SVG 加载失败:', url, e)
    loading.value = false
    return
  }

  // 2. 预处理 SVG
  const processed = preprocessSvg(rawSvg)

  // 3. 创建 Fabric 画布
  canvas = new fabric.Canvas(canvasRef.value, {
    width:  processed.svgWidth  || 800,
    height: processed.svgHeight || 600,
    fireRightClick: true,
    stopContextMenu: true,
    controlsAboveOverlay: true,
    preserveObjectStacking: true,
    backgroundColor: '#f1f1f1',
  })

  // 4. 动态导入 Editor 和插件
  const [
    { default: Editor },
    { default: DringPlugin },
    { default: AlignGuidLinePlugin },
    { default: ControlsPlugin },
    { default: CenterAlignPlugin },
    { default: LayerPlugin },
    { default: CopyPlugin },
    { default: MoveHotKeyPlugin },
    { default: DeleteHotKeyPlugin },
    { default: GroupPlugin },
    { default: HistoryPlugin },
  ] = await Promise.all([
    import('@kuaitu/core'),
    import('@kuaitu/core/plugin/DringPlugin'),
    import('@kuaitu/core/plugin/AlignGuidLinePlugin'),
    import('@kuaitu/core/plugin/ControlsPlugin'),
    import('@kuaitu/core/plugin/CenterAlignPlugin'),
    import('@kuaitu/core/plugin/LayerPlugin'),
    import('@kuaitu/core/plugin/CopyPlugin'),
    import('@kuaitu/core/plugin/MoveHotKeyPlugin'),
    import('@kuaitu/core/plugin/DeleteHotKeyPlugin'),
    import('@kuaitu/core/plugin/GroupPlugin'),
    import('@kuaitu/core/plugin/HistoryPlugin'),
  ])

  canvasEditor = new Editor()
  canvasEditor.init(canvas)
  canvasEditor
    .use(DringPlugin).use(AlignGuidLinePlugin).use(ControlsPlugin)
    .use(CenterAlignPlugin).use(LayerPlugin).use(CopyPlugin)
    .use(MoveHotKeyPlugin).use(DeleteHotKeyPlugin).use(GroupPlugin)
    .use(HistoryPlugin)

  // 5. 将预处理后的 SVG 加载到画布
  try {
    await loadSvgToCanvas(processed.svg)
  } catch (e) {
    console.error('[SvgEditor] SVG 渲染失败:', e)
  }

  loading.value = false

  // 6. Esc 关闭
  _keyHandler = (e) => { if (e.key === 'Escape') emit('close') }
  document.addEventListener('keydown', _keyHandler)
})

onUnmounted(() => {
  if (_keyHandler) document.removeEventListener('keydown', _keyHandler)
  if (canvasEditor) canvasEditor.destory()
  canvas = null
  canvasEditor = null
})

// ═══════════ 预处理 ═══════════

function preprocessSvg(svg) {
  let s = svg.replace(/<\?xml[^?]*\?>\s*/g, '')

  // 1. CSS 变量 → hex
  if (_cssVarEnabled) {
    const varMap = _cssVarMode === 'dark' ? DARK_VAR_TO_HEX : LIGHT_VAR_TO_HEX
    for (const [varName, hex] of Object.entries(varMap)) {
      s = s.replaceAll(`var(${varName})`, hex)
    }
  }

  // 2. 修复 <stop style="stop-color:..."> → 直接属性（Fabric.js 对 style 解析有限）
  s = s.replace(
    /<stop(\s[^>]*?)style="stop-color:\s*([^;"]+);\s*stop-opacity:\s*([^"]+)"([^>]*?)>/g,
    '<stop$1stop-color="$2" stop-opacity="$3"$4>'
  )

  // 3. 提取 viewBox
  const vbMatch = s.match(/viewBox="([^"]+)"/)
  _originalViewBox = vbMatch ? vbMatch[1] : ''
  const parts = _originalViewBox ? _originalViewBox.split(/[\s,]+/).map(Number) : []
  const svgWidth  = parts.length >= 4 ? Math.round(parts[2]) : 0
  const svgHeight = parts.length >= 4 ? Math.round(parts[3]) : 0

  return { svg: s, svgWidth, svgHeight }
}

// ═══════════ 画布加载 ═══════════

function loadSvgToCanvas(svgContent) {
  return new Promise((resolve, reject) => {
    fabric.loadSVGFromString(svgContent, (objects, options) => {
      if (!objects || objects.length === 0) {
        reject(new Error('SVG 解析结果为空'))
        return
      }
      objects.forEach(obj => canvas.add(obj))
      canvas.renderAll()
      canvas.fire('object:modified') // 历史快照
      resolve(true)
    })
  })
}

// ═══════════ 保存 ═══════════

async function handleSave() {
  saving.value = true
  try {
    let svg = canvas.toSVG()

    if (_cssVarEnabled) {
      svg = postprocessSvg(svg)
    }

    const resp = await fetch('/__svg-save__', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: props.src, content: svg }),
    })
    if (resp.ok) { emit('saved'); emit('close') }
    else { alert('保存失败: ' + await resp.text()) }
  } catch (e) {
    alert('保存失败: ' + e.message)
  }
  saving.value = false
}

// ═══════════ 后处理 ═══════════

function postprocessSvg(svg) {
  let s = svg

  // 1. 移除 Fabric.js 冗余头部
  s = s.replace(/<\?xml[^?]*\?>\s*/g, '')
  s = s.replace(/<!DOCTYPE[^>]*>\s*/g, '')
  s = s.replace(/<desc>[^<]*<\/desc>\s*/g, '')
  s = s.replace(/<defs>\s*<\/defs>\s*/g, '')
  s = s.replace(/ xmlns:xlink="[^"]*"/g, '')
  s = s.replace(/ version="[^"]*"/g, '')
  s = s.replace(/ xml:space="preserve"/g, '')

  // 2. rgb() → hex
  s = s.replace(
    /rgb\((\d+),\s*(\d+),\s*(\d+)\)/gi,
    (_, r, g, b) => '#' + [r, g, b].map(x => parseInt(x).toString(16).padStart(2, '0').toUpperCase()).join('')
  )

  // 3. hex → CSS 变量
  const hexMap = _cssVarMode === 'dark' ? DARK_HEX_TO_VAR : LIGHT_HEX_TO_VAR
  for (const [hex, varName] of Object.entries(hexMap)) {
    s = s.replace(new RegExp(hex, 'gi'), `var(${varName})`)
  }

  // 4. 恢复原始 viewBox，移除 fabric 自动添加的宽高
  if (_originalViewBox) {
    s = s.replace(/viewBox="[^"]*"/, `viewBox="${_originalViewBox}"`)
  }
  s = s.replace(/\s+width="[^"]*"/, '').replace(/\s+height="[^"]*"/, '')

  // 5. 展开 Group transform → 绝对坐标
  s = unwrapGroups(s)

  // 6. 移除画布背景 rect
  s = s.replace(/<rect\s+x="0"\s+y="0"\s+width="100%"\s+height="100%"\s+fill="#F5F5F5"\s*\/?>\s*/gi, '')

  // 7. 清理多余空白
  s = s.replace(/\n\s*\n/g, '\n')

  return s.trim()
}

/**
 * 展开 Fabric.js Group 的矩阵平移
 */
function unwrapGroups(svg) {
  return svg.replace(
    /<g\s+transform="matrix\(1\s+0\s+0\s+1\s+([\d.\-]+)\s+([\d.\-]+)\)"[^>]*>\s*([\s\S]*?)<\/g>/g,
    (full, txStr, tyStr, inner) => {
      const tx = parseFloat(txStr), ty = parseFloat(tyStr), trimmed = inner.trim()

      const textMatch = trimmed.match(/^(<text[^>]*>)\s*<tspan\s+x="([\d.\-]+)"\s+y="([\d.\-]+)"[^>]*>([\s\S]*?)<\/tspan>\s*<\/text>$/)
      if (textMatch) {
        const [, origAttrs, lx, ly, content] = textMatch
        const absX = tx + parseFloat(lx), absY = ty + parseFloat(ly)
        let attrs = origAttrs.replace(/\s+xml:space="preserve"/g, '').replace(/^<text/, `<text x="${absX.toFixed(1)}" y="${absY.toFixed(1)}"`).replace(/>$/, '')
        return `${attrs}>${content}</text>`
      }

      const rectMatch = trimmed.match(/^(<rect[^>]*?)\s+style="[^"]*"([^>]*\/>)\s*$/)
      if (rectMatch) {
        return trimmed.replace(/ x="([\d.\-]+)"/, (m, v) => ` x="${(tx + parseFloat(v)).toFixed(1)}"`)
          .replace(/ y="([\d.\-]+)"/, (m, v) => ` y="${(ty + parseFloat(v)).toFixed(1)}"`)
      }

      const lineMatch = trimmed.match(/^(<line[^>]*?)\s+style="[^"]*"([^>]*\/>)\s*$/)
      if (lineMatch) {
        return trimmed.replace(/ x1="([\d.\-]+)"/, (m, v) => ` x1="${(tx + parseFloat(v)).toFixed(1)}"`)
          .replace(/ y1="([\d.\-]+)"/, (m, v) => ` y1="${(ty + parseFloat(v)).toFixed(1)}"`)
          .replace(/ x2="([\d.\-]+)"/, (m, v) => ` x2="${(tx + parseFloat(v)).toFixed(1)}"`)
          .replace(/ y2="([\d.\-]+)"/, (m, v) => ` y2="${(ty + parseFloat(v)).toFixed(1)}"`)
      }

      const polyMatch = trimmed.match(/^(<polygon[^>]*?)\s+style="[^"]*"([^>]*\/>)\s*$/)
      if (polyMatch) {
        return trimmed.replace(/ points="([^"]+)"/, (m, pts) => {
          const newPts = pts.trim().split(/\s+/).map(pair => {
            const [x, y] = pair.split(',').map(Number)
            return `${(tx + x).toFixed(1)},${(ty + y).toFixed(1)}`
          }).join(' ')
          return ` points="${newPts}"`
        })
      }

      return full
    }
  )
}
</script>

<template>
  <div class="editor-overlay" @click.self="emit('close')">
    <div class="editor-panel">
      <div class="editor-toolbar">
        <span class="title">✏️ {{ src }}</span>
        <span v-if="loading" class="info">加载中…</span>
        <span v-if="saving" class="info">保存中…</span>
        <div class="spacer" />
        <button class="btn-save" @click="handleSave" :disabled="saving">💾 保存</button>
        <button class="btn-close" @click="emit('close')" title="关闭 (Esc)">✕</button>
      </div>
      <div class="editor-body">
        <canvas ref="canvasRef" id="svg-editor-canvas"></canvas>
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(15, 15, 15, 0.75);
  backdrop-filter: blur(12px);
  display: flex; align-items: center; justify-content: center;
  animation: overlayIn 0.2s ease;
}
@keyframes overlayIn { from { opacity: 0; } to { opacity: 1; } }
.editor-panel {
  width: 95vw; height: 90vh;
  background: #fff; border-radius: 12px; overflow: hidden;
  display: flex; flex-direction: column;
  box-shadow: 0 32px 80px rgba(0,0,0,0.4);
  animation: panelIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes panelIn {
  from { opacity: 0; transform: scale(0.96) translateY(8px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
.editor-toolbar {
  display: flex; align-items: center;
  padding: 10px 16px; background: #f8f9fa;
  border-bottom: 1px solid #e9ecef; flex-shrink: 0;
}
.editor-toolbar .title {
  font-size: 13px; color: #666;
  max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.editor-toolbar .info { font-size: 12px; color: #999; margin-left: 12px; }
.editor-toolbar .spacer { flex: 1; }
.btn-save {
  margin-right: 8px; padding: 4px 12px;
  background: #0078d4; color: #fff; border: none; border-radius: 4px;
  font-size: 12px; cursor: pointer;
}
.btn-save:hover { background: #106ebe; }
.btn-save:disabled { opacity: 0.5; cursor: default; }
.btn-close {
  width: 32px; height: 32px; border: none; border-radius: 6px;
  background: transparent; color: #666; font-size: 18px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.btn-close:hover { background: #e9ecef; color: #333; }
.editor-body {
  flex: 1; overflow: auto;
  display: flex; align-items: flex-start; justify-content: center;
  padding: 20px; background: #f1f1f1;
}
</style>
