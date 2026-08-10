<template>
  <div class="ie-container ie-editor" :style="themeVars" :class="{ 'ie-fullscreen': isFullscreen }">
    <!-- 顶部工具栏 -->
    <div class="ie-editor-toolbar">
      <div class="ie-toolbar-group">
        <History />
        <div class="ie-toolbar-divider"></div>
        <Save />
        <Clone />
        <Del />
        <div class="ie-toolbar-divider"></div>
        <Flip />
        <Group />
        <Lock />
        <Hide />
        <div class="ie-toolbar-divider"></div>
        <CenterAlign />
        <Align />
      </div>
      <div class="ie-toolbar-spacer"></div>
      <Zoom />
      <div class="ie-toolbar-divider"></div>
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
        <Tools />
      </div>

      <!-- Canvas 画布区域 -->
      <div ref="canvasWrapperRef" class="ie-canvas-area" id="workspace">
        <canvas id="canvas"></canvas>
      </div>

      <!-- 右侧属性面板 -->
      <div class="ie-props-panel">
        <Attribute />
        <AttributeFont />
        <AttributeColor />
        <AttributeBorder />
        <AttributeShadow />
        <AttributePostion />
        <AttributeRounded />
        <AttributeTextContent />
        <Filters />
        <ClipImage />
        <ImgStroke />
        <Layer />
      </div>
    </div>

    <!-- 状态栏 -->
    <div class="ie-status-bar">
      <span>{{ canvasWidth }} × {{ canvasHeight }}</span>
      <span>{{ Math.round(zoom * 100) }}%</span>
      <span v-if="selectedCount > 0">已选 {{ selectedCount }} 个元素</span>
      <span v-else>未选中</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, provide, onMounted, onUnmounted, reactive } from 'vue'
import { fabric } from 'fabric'
import Editor from '../kuaitu-core/Editor'
import type { IEditor } from '../kuaitu-core/interface/Editor'
import { useTheme } from '../composables/useTheme'

// 导入对方的插件
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
import PolygonModifyPlugin from '../kuaitu-core/plugin/PolygonModifyPlugin'
import DrawPolygonPlugin from '../kuaitu-core/plugin/DrawPolygonPlugin'
import FreeDrawPlugin from '../kuaitu-core/plugin/FreeDrawPlugin'
import SimpleClipImagePlugin from '../kuaitu-core/plugin/SimpleClipImagePlugin'
import LockPlugin from '../kuaitu-core/plugin/LockPlugin'
import AddBaseTypePlugin from '../kuaitu-core/plugin/AddBaseTypePlugin'
import ResizePlugin from '../kuaitu-core/plugin/ResizePlugin'

// 导入对方的 UI 组件
import History from '../kuaitu-components/history.vue'
import Save from '../kuaitu-components/save.vue'
import Clone from '../kuaitu-components/clone.vue'
import Del from '../kuaitu-components/del.vue'
import Flip from '../kuaitu-components/flip.vue'
import Group from '../kuaitu-components/group.vue'
import Lock from '../kuaitu-components/lock.vue'
import Hide from '../kuaitu-components/hide.vue'
import CenterAlign from '../kuaitu-components/centerAlign.vue'
import Align from '../kuaitu-components/align.vue'
import Zoom from '../kuaitu-components/zoom.vue'
import Tools from '../kuaitu-components/tools.vue'
import Attribute from '../kuaitu-components/attribute.vue'
import AttributeFont from '../kuaitu-components/attributeFont.vue'
import AttributeColor from '../kuaitu-components/attributeColor.vue'
import AttributeBorder from '../kuaitu-components/attributeBorder.vue'
import AttributeShadow from '../kuaitu-components/attributeShadow.vue'
import AttributePostion from '../kuaitu-components/attributePostion.vue'
import AttributeRounded from '../kuaitu-components/attributeRounded.vue'
import AttributeTextContent from '../kuaitu-components/attributeTextContent.vue'
import Filters from '../kuaitu-components/filters.vue'
import ClipImage from '../kuaitu-components/clipImage.vue'
import ImgStroke from '../kuaitu-components/imgStroke.vue'
import Layer from '../kuaitu-components/layer.vue'

const props = defineProps<{
  src?: string
}>()

const isFullscreen = ref(false)
const canvasWidth = ref(900)
const canvasHeight = ref(1200)
const zoom = ref(1)
const selectedCount = ref(0)
const canvasWrapperRef = ref<HTMLElement>()

const { themeVars } = useTheme()

// 创建编辑器实例
const canvasEditor = new Editor() as IEditor

const state = reactive({
  show: false,
})

onMounted(() => {
  const canvas = new fabric.Canvas('canvas', {
    fireRightClick: true,
    stopContextMenu: true,
    controlsAboveOverlay: true,
    preserveObjectStacking: true,
  })

  // 初始化编辑器
  canvasEditor.init(canvas)
  canvasEditor
    .use(DringPlugin)
    .use(PolygonModifyPlugin)
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

  state.show = true

  // 监听选择事件
  canvas.on('selection:created', updateSelection)
  canvas.on('selection:updated', updateSelection)
  canvas.on('selection:cleared', () => {
    selectedCount.value = 0
  })

  // 如果有 src，加载 JSON
  if (props.src) {
    loadJson(props.src)
  }
})

onUnmounted(() => {
  canvasEditor.destory()
})

function updateSelection() {
  const actives = canvasEditor.canvas?.getActiveObjects() || []
  selectedCount.value = actives.length
}

async function loadJson(src: string) {
  try {
    const response = await fetch(src)
    if (!response.ok) throw new Error(`Failed to load: ${src}`)
    const json = await response.json()
    canvasEditor.loadJSON(json)
  } catch (err) {
    console.error('Failed to load JSON:', err)
  }
}

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
}

// 提供给子组件
provide('fabric', fabric)
provide('canvasEditor', canvasEditor)
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

.ie-toolbar-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

.ie-toolbar-spacer {
  flex: 1;
}

.ie-editor-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.ie-tool-panel {
  width: 200px;
  border-right: 1px solid var(--ie-border);
  background: var(--ie-bg-secondary);
  overflow-y: auto;
  padding: 8px;
  flex-shrink: 0;
}

.ie-canvas-area {
  flex: 1;
  overflow: hidden;
  background: var(--ie-canvas-grid);
  position: relative;
}

.ie-props-panel {
  width: 280px;
  border-left: 1px solid var(--ie-border);
  background: var(--ie-bg-secondary);
  overflow-y: auto;
  padding: 8px;
  flex-shrink: 0;
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

.ie-toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--ie-text);
  cursor: pointer;
}

.ie-toolbar-btn:hover {
  background: var(--ie-bg-secondary);
}

.ie-toolbar-btn svg {
  width: 16px;
  height: 16px;
  fill: currentColor;
}

.ie-toolbar-divider {
  width: 1px;
  height: 24px;
  background: var(--ie-border);
  margin: 0 4px;
}
</style>
