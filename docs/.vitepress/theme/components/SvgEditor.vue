<script setup>
/**
 * SVG 编辑器 — 基于 vue-fabric-editor 的 iframe 集成
 *
 * 通过 postMessage 将 SVG 数据传到 iframe 内的 vue-fabric-editor，
 * 接收用户编辑后的保存结果。
 */
import { ref, onMounted, onUnmounted, nextTick } from 'vue'

const props = defineProps({ src: { type: String, required: true } })
const emit = defineEmits(['close', 'saved'])

const iframeRef = ref(null)
const loading = ref(true)
const saving = ref(false)
let _keyHandler = null
let _msgHandler = null

onMounted(async () => {
  await nextTick()

  // 加载 SVG 内容
  const base = import.meta.env.BASE_URL || '/'
  const url = props.src.startsWith('/') ? base + props.src.slice(1) : props.src
  let svgContent = ''
  try {
    const resp = await fetch(url)
    if (resp.ok) svgContent = await resp.text()
  } catch (e) {
    console.error('[SvgEditor] 加载 SVG 失败:', url, e)
    loading.value = false
    return
  }

  // 监听 iframe 消息
  _msgHandler = (event) => {
    const data = event.data
    if (!data || data.source !== 'svg-editor-iframe') return
    if (data.type === 'ready') {
      // iframe 就绪，发送 SVG 数据
      iframeRef.value?.contentWindow?.postMessage({
        source: 'svg-editor-parent',
        path: props.src,
        content: svgContent,
      }, '*')
      loading.value = false
    }
    if (data.type === 'save') {
      handleSave(data.content)
    }
  }
  window.addEventListener('message', _msgHandler)

  // 键盘监听
  _keyHandler = (e) => {
    if (e.key === 'Escape') emit('close')
  }
  document.addEventListener('keydown', _keyHandler)
})

onUnmounted(() => {
  if (_keyHandler) document.removeEventListener('keydown', _keyHandler)
  if (_msgHandler) window.removeEventListener('message', _msgHandler)
})

async function handleSave(svgContent) {
  saving.value = true
  try {
    const resp = await fetch('/__svg-save__', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: props.src, content: svgContent }),
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

// 编辑器 URL：VitePress 中 public/ 静态文件需要通过完整路径访问
// /java-world/editor/         → VitePress SPA 路由拦截 → 404 页面（因为不存在 editor/index.md）
// /java-world/editor/index.html → 正确返回 docs/public/editor/index.html
const editorUrl = `${import.meta.env.BASE_URL || '/'}editor/index.html`
</script>

<template>
  <div class="editor-overlay" @click.self="emit('close')">
    <div class="editor-panel">
      <div class="editor-toolbar">
        <span class="title">✏️ {{ src }}</span>
        <span v-if="loading" class="info">加载中…</span>
        <span v-if="saving" class="info">保存中…</span>
        <div class="spacer" />
        <button class="btn-close" @click="emit('close')" title="关闭 (Esc)">✕</button>
      </div>
      <div class="editor-body">
        <iframe
          ref="iframeRef"
          :src="editorUrl"
          class="editor-iframe"
        />
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
.btn-close {
  width: 32px; height: 32px; border: none; border-radius: 6px;
  background: transparent; color: #666; font-size: 18px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.btn-close:hover { background: #e9ecef; color: #333; }

.editor-body { flex: 1; overflow: hidden; position: relative; }
.editor-iframe {
  width: 100%; height: 100%; border: none;
}
</style>
