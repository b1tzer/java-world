<template>
  <div
    ref="containerRef"
    class="ie-container"
    :style="themeVars"
    :class="{ 'ie-fullscreen': isFullscreen }"
  >
    <div
      ref="canvasWrapperRef"
      class="ie-canvas-wrapper"
      :style="{ height: canvasHeight + 'px' }"
    >
      <canvas ref="canvasRef"></canvas>

      <!-- 浮动工具栏 -->
      <div class="ie-viewer-toolbar">
        <button class="ie-toolbar-btn" title="缩小" @click="zoomOut">
          <svg viewBox="0 0 24 24"><path d="M19 13H5v-2h14v2z"/></svg>
        </button>
        <button class="ie-toolbar-btn" title="放大" @click="zoomIn">
          <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
        </button>
        <button class="ie-toolbar-btn" title="适应画布" @click="zoomFit">
          <svg viewBox="0 0 24 24"><path d="M3 5v4h2V5h4V3H5c-1.1 0-2 .9-2 2zm2 10H3v4c0 1.1.9 2 2 2h4v-2H5v-4zm14 4h-4v2h4c1.1 0 2-.9 2-2v-4h-2v4zm0-16h-4v2h4v4h2V5c0-1.1-.9-2-2-2z"/></svg>
        </button>
        <div class="ie-toolbar-divider"></div>
        <button class="ie-toolbar-btn" :title="isFullscreen ? '退出全屏' : '全屏'" @click="toggleFullscreen">
          <svg viewBox="0 0 24 24">
            <path v-if="!isFullscreen" d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
            <path v-else d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
          </svg>
        </button>
        <button class="ie-toolbar-btn" title="下载" @click="downloadImage">
          <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useTheme } from '../composables/useTheme'

// 动态导入 fabric.js（避免 SSR 问题）
let fabricLib: any = null

const props = defineProps<{
  src: string
  alt?: string
  mode?: 'view' | 'edit'
}>()

const emit = defineEmits<{
  (e: 'loaded'): void
  (e: 'error', err: Error): void
}>()

const containerRef = ref<HTMLElement>()
const canvasWrapperRef = ref<HTMLElement>()
const canvasRef = ref<HTMLCanvasElement>()
const canvasHeight = ref(400)
const isFullscreen = ref(false)

const { themeVars, canvasBackground } = useTheme()

let fabricCanvas: any = null

// 初始化 fabric.js
async function initFabric() {
  if (!fabricLib) {
    const fabricModule = await import('fabric')
    fabricLib = fabricModule.fabric || fabricModule.default || fabricModule
  }
}

// 加载 JSON 数据
async function loadJson(src: string) {
  try {
    await initFabric()
    if (!fabricLib || !canvasRef.value) return

    // 获取 JSON 数据
    const response = await fetch(src)
    if (!response.ok) throw new Error(`Failed to load: ${src}`)
    const json = await response.json()

    // 初始化画布
    if (fabricCanvas) {
      fabricCanvas.dispose()
    }

    fabricCanvas = new fabricLib.Canvas(canvasRef.value, {
      selection: false,
      renderOnAddRemove: true,
    })

    // 加载 JSON
    fabricCanvas.loadFromJSON(json, () => {
      fabricCanvas!.renderAll()

      // 设置为只读
      fabricCanvas!.getObjects().forEach(obj => {
        obj.selectable = false
        obj.evented = false
      })

      // 适应画布
      zoomFit()
      emit('loaded')
    })
  } catch (err) {
    console.error('Failed to load fabric JSON:', err)
    emit('error', err as Error)
  }
}

// 缩放控制
function zoomIn() {
  if (!fabricCanvas) return
  const zoom = fabricCanvas.getZoom() * 1.1
  fabricCanvas.setZoom(zoom)
  fabricCanvas.renderAll()
}

function zoomOut() {
  if (!fabricCanvas) return
  const zoom = fabricCanvas.getZoom() * 0.9
  fabricCanvas.setZoom(zoom)
  fabricCanvas.renderAll()
}

function zoomFit() {
  if (!fabricCanvas || !canvasWrapperRef.value) return
  const wrapper = canvasWrapperRef.value
  const wrapperWidth = wrapper.clientWidth
  const wrapperHeight = wrapper.clientHeight

  // 找到 workspace 对象
  const workspace = fabricCanvas.getObjects().find(
    (obj: any) => obj.id === 'workspace'
  )

  if (workspace) {
    const scaleX = wrapperWidth / (workspace.width || 900)
    const scaleY = wrapperHeight / (workspace.height || 1200)
    const scale = Math.min(scaleX, scaleY) * 0.9

    fabricCanvas.setZoom(scale)

    // 居中
    const center = fabricCanvas.getCenter()
    fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0])
    fabricCanvas.zoomToPoint(
      new fabricLib.Point(center.left, center.top),
      scale
    )
  }

  fabricCanvas.renderAll()
}

// 全屏切换
function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
  nextTick(() => zoomFit())
}

// 下载图片
function downloadImage() {
  if (!fabricCanvas) return

  const workspace = fabricCanvas.getObjects().find(
    (obj: any) => obj.id === 'workspace'
  )

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
    link.download = 'image.png'
    link.href = dataUrl
    link.click()
  }
}

// 监听 src 变化
watch(() => props.src, (newSrc) => {
  if (newSrc) loadJson(newSrc)
})

// 监听全屏 ESC 键
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isFullscreen.value) {
    isFullscreen.value = false
  }
}

// 生命周期
onMounted(() => {
  if (props.src) loadJson(props.src)
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  fabricCanvas?.dispose()
  window.removeEventListener('keydown', handleKeydown)
})
</script>
