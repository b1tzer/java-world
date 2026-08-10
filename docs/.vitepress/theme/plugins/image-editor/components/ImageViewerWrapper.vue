<template>
  <ClientOnly>
    <div v-if="loading" class="ie-loading">
      <div class="ie-loading-spinner"></div>
      <span>加载中...</span>
    </div>
    <div v-else-if="error" class="ie-error">
      <span>加载失败: {{ error.message }}</span>
    </div>
    <ImageEditor
      v-else-if="mode === 'edit'"
      :src="resolvedSrc"
      :title="alt"
      @save="onSave"
      @export="onExport"
    />
    <ImageViewer
      v-else
      :src="resolvedSrc"
      :alt="alt"
      :mode="mode"
      @loaded="onLoaded"
      @error="onError"
    />
  </ClientOnly>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import ImageViewer from './ImageViewer.vue'
import ImageEditor from './ImageEditor.vue'

const props = withDefaults(defineProps<{
  src: string
  alt?: string
  mode?: 'view' | 'edit'
}>(), {
  mode: 'view',
})

const emit = defineEmits<{
  (e: 'save', data: object): void
  (e: 'export', format: string, data: string): void
}>()

const loading = ref(true)
const error = ref<Error | null>(null)
const resolvedSrc = ref('')

function onLoaded() {
  loading.value = false
}

function onError(err: Error) {
  loading.value = false
  error.value = err
}

function onSave(data: object) {
  emit('save', data)
}

function onExport(format: string, data: string) {
  emit('export', format, data)
}

// 解析相对路径
function resolveSrc(src: string): string {
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return src
  }
  return src
}

onMounted(() => {
  console.log('[ImageViewerWrapper] mounted, src:', props.src, 'mode:', props.mode)
  resolvedSrc.value = resolveSrc(props.src)
  loading.value = false
})
</script>
