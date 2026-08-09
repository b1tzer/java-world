<script setup>
/**
 * SVG 编辑器 — 直接集成 vue-fabric-editor 的 Editor 核心（非 iframe）
 *
 * 从 @kuaitu/core 提取的 Editor 类 + 必要插件，在组件内部直接创建 Fabric.js 画布。
 * 用户打开即编辑，保存直接写回文件。
 */
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { fabric } from 'fabric'

const props = defineProps({ src: { type: String, required: true } })
const emit = defineEmits(['close', 'saved'])

const canvasRef = ref(null)
const loading = ref(true)
const saving = ref(false)
let canvasEditor = null
let canvas = null
let _keyHandler = null

onMounted(async () => {
  await nextTick()

  // 1. 加载 SVG 内容
  const base = import.meta.env.BASE_URL || '/'
  const url = props.src.startsWith('/') ? base + props.src.slice(1) : props.src
  let svgContent = ''
  try {
    const resp = await fetch(url)
    if (resp.ok) svgContent = await resp.text()
    else { loading.value = false; return }
  } catch (e) {
    console.error('[SvgEditor] SVG 加载失败:', url, e)
    loading.value = false
    return
  }

  // 2. 创建 Fabric 画布
  canvas = new fabric.Canvas(canvasRef.value, {
    width: 800,
    height: 600,
    fireRightClick: true,
    stopContextMenu: true,
    controlsAboveOverlay: true,
    preserveObjectStacking: true,
    backgroundColor: '#f1f1f1',
  })

  // 3. 动态导入 Editor 和插件（避免 SSR 报错）
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
    import('@kuaitu/core/plugin/WorkspacePlugin'),
  ])

  // 4. 初始化 Editor
  canvasEditor = new Editor()
  canvasEditor.init(canvas)

  // 5. 挂载必要插件
  canvasEditor
    .use(DringPlugin)
    .use(AlignGuidLinePlugin)
    .use(ControlsPlugin)
    .use(CenterAlignPlugin)
    .use(LayerPlugin)
    .use(CopyPlugin)
    .use(MoveHotKeyPlugin)
    .use(DeleteHotKeyPlugin)
    .use(GroupPlugin)
    .use(HistoryPlugin)

  // 6. 将 SVG 加载到画布
  try {
    await loadSvgToCanvas(svgContent)
  } catch (e) {
    console.error('[SvgEditor] SVG 渲染失败:', e)
  }

  loading.value = false

  // 7. 键盘监听
  _keyHandler = (e) => {
    if (e.key === 'Escape') emit('close')
  }
  document.addEventListener('keydown', _keyHandler)
})

onUnmounted(() => {
  if (_keyHandler) document.removeEventListener('keydown', _keyHandler)
  if (canvasEditor) canvasEditor.destory()
  canvas = null
  canvasEditor = null
})

/**
 * 将 SVG 字符串渲染到 Fabric 画布
 */
function loadSvgToCanvas(svgContent) {
  return new Promise((resolve, reject) => {
    // 预处理：移除 XML 声明
    const cleaned = svgContent.replace(/<\?xml[^?]*\?>\s*/g, '')
    fabric.loadSVGFromString(cleaned, (objects, options) => {
      if (!objects || objects.length === 0) {
        reject(new Error('SVG 解析结果为空'))
        return
      }
      // 使用 SVG 原始 viewBox 尺寸
      const vbMatch = cleaned.match(/viewBox="([^"]+)"/)
      if (vbMatch) {
        const [, , w, h] = vbMatch[1].split(/\s+/).map(Number)
        if (w && h) {
          canvas.setWidth(w)
          canvas.setHeight(h)
        }
      }
      // 添加到画布
      objects.forEach((obj) => {
        canvas.add(obj)
      })
      canvas.renderAll()
      // 标记第一个历史快照
      canvas.fire('object:modified')
      resolve(true)
    })
  })
}

/** 保存 SVG 到文件 */
async function handleSave() {
  saving.value = true
  try {
    const svg = canvas.toSVG()
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
</script>

<template>
  <div class="editor-overlay" @click.self="emit('close')">
    <div class="editor-panel">
      <div class="editor-toolbar">
        <span class="title">✏️ {{ src }}</span>
        <span v-if="loading" class="info">加载中…</span>
        <span v-if="saving" class="info">保存中…</span>
        <div class="spacer" />
        <button class="btn-save" @click="handleSave" :disabled="saving">
          💾 保存
        </button>
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
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
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
  padding: 10px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  flex-shrink: 0;
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
  padding: 20px;
  background: #f1f1f1;
}
</style>
