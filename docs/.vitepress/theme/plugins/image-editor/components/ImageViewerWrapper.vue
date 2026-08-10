<template>
  <ClientOnly>
    <div v-if="loading" class="ie-loading">
      <div class="ie-loading-spinner"></div>
      <span>加载中...</span>
    </div>
    <div v-else-if="error" class="ie-error">
      <span>加载失败: {{ error.message }}</span>
    </div>
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

const props = withDefaults(defineProps<{
  src: string
  alt?: string
  mode?: 'view' | 'edit'
}>(), {
  mode: 'view',
})

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

// 解析相对路径
function resolveSrc(src: string): string {
  // 如果是绝对 URL，直接返回
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return src
  }

  // VitePress 中，md 文件中的相对路径会被 Vite 处理
  // 但 markdown-it 插件输出的是原始路径
  // 需要根据当前页面路径解析
  if (typeof window !== 'undefined') {
    const base = import.meta.env.BASE_URL || '/'
    const pagePath = window.location.pathname

    // 如果 src 以 ./ 开头，相对于当前页面
    if (src.startsWith('./')) {
      const dir = pagePath.substring(0, pagePath.lastIndexOf('/'))
      return base + dir.substring(base.length) + '/' + src.substring(2)
    }

    // 如果 src 以 / 开头，是绝对路径
    if (src.startsWith('/')) {
      return src
    }

    // 其他情况，相对于当前页面
    const dir = pagePath.substring(0, pagePath.lastIndexOf('/'))
    return base + dir.substring(base.length) + '/' + src
  }

  return src
}

onMounted(() => {
  resolvedSrc.value = resolveSrc(props.src)
  // 如果 resolvedSrc 是相对路径，直接使用 src（Vite 会处理）
  // 实际加载在 ImageViewer 组件中通过 fetch 完成
  resolvedSrc.value = props.src
})
</script>
