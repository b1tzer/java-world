import { ref, computed, watchEffect, onMounted, onUnmounted } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import type { ThemeVars } from '../types'

/**
 * 明暗色主题适配 composable
 * 监听 VitePress 主题变化，自动切换编辑器主题
 */
export function useTheme(): {
  isDark: Ref<boolean>
  themeVars: ComputedRef<ThemeVars>
  canvasBackground: ComputedRef<string>
} {
  const isDark = ref(false)

  // 监听 VitePress 主题变化
  const updateTheme = () => {
    const html = document.documentElement
    isDark.value = html.classList.contains('dark')
  }

  onMounted(() => {
    updateTheme()
    // 使用 MutationObserver 监听 class 变化
    const observer = new MutationObserver(updateTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
    onUnmounted(() => observer.disconnect())
  })

  // 主题变量
  const themeVars = computed<ThemeVars>(() => ({
    '--ie-bg': isDark.value ? '#1e1e1e' : '#ffffff',
    '--ie-bg-secondary': isDark.value ? '#252525' : '#f5f5f5',
    '--ie-text': isDark.value ? '#e0e0e0' : '#333333',
    '--ie-text-secondary': isDark.value ? '#a0a0a0' : '#666666',
    '--ie-border': isDark.value ? '#333333' : '#e0e0e0',
    '--ie-accent': '#2563eb',
    '--ie-shadow': isDark.value
      ? '0 2px 8px rgba(0, 0, 0, 0.4)'
      : '0 2px 8px rgba(0, 0, 0, 0.1)',
    '--ie-canvas-bg': isDark.value ? '#1a1a1a' : '#ffffff',
    '--ie-canvas-grid': isDark.value ? '#2a2a2a' : '#f0f0f0',
  }))

  // 画布背景色
  const canvasBackground = computed(() =>
    isDark.value ? '#1a1a1a' : '#ffffff'
  )

  return { isDark, themeVars, canvasBackground }
}
