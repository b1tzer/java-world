<script setup>
import { ref, onMounted, watch, computed } from 'vue'

const props = defineProps({
  src: { type: String, required: true }
})

const svgContent = ref('')
const isDev = import.meta.env.DEV
const showEditor = ref(false)
const hovered = ref(false)

async function loadSvg() {
  try {
    const base = import.meta.env.BASE_URL || '/'
    const url = props.src.startsWith('/') ? base + props.src.slice(1) : props.src
    const resp = await fetch(url)
    let text = await resp.text()
    text = text.replace(/<\?xml[^?]*\?>\s*/g, '')
    svgContent.value = text
  } catch (e) {
    console.error('Failed to load SVG:', props.src, e)
  }
}

onMounted(loadSvg)
watch(() => props.src, loadSvg)
</script>

<template>
  <div
    class="svg-container"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
  >
    <div v-html="svgContent" />

    <!-- Dev 模式：悬浮编辑按钮 -->
    <button
      v-if="isDev && hovered"
      class="svg-edit-btn"
      @click="showEditor = true"
    >
      ✏️ 编辑 SVG
    </button>

    <!-- 编辑器弹窗 -->
    <Teleport to="body">
      <SvgEditor
        v-if="showEditor"
        :src="src"
        @close="showEditor = false"
        @saved="loadSvg()"
      />
    </Teleport>
  </div>
</template>

<style scoped>
.svg-container {
  position: relative;
  display: flex;
  justify-content: center;
  margin: 1.5em 0;
  overflow-x: auto;
}

.svg-container :deep(> div) {
  display: contents;
}

.svg-container :deep(svg) {
  display: block;
  max-width: 100%;
  height: auto;
}

.svg-edit-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 4px 10px;
  background: rgba(0, 120, 212, 0.9);
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  z-index: 10;
  backdrop-filter: blur(4px);
  transition: background 0.15s;
}

.svg-edit-btn:hover {
  background: rgba(0, 120, 212, 1);
}
</style>
