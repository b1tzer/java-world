// SVG 编辑器自测脚本 - 代码静态分析
import { readFileSync } from 'fs'

const file = readFileSync('docs/.vitepress/theme/components/SvgEditor.vue', 'utf8')

const tests = [
  // P0
  { name: 'T1: 文字格式工具栏', check: () => file.includes('toggleBold') && file.includes('toggleItalic') && file.includes('toggleUnderline') },
  { name: 'T2: 层级控制', check: () => file.includes('layerForward') && file.includes('layerBackward') && file.includes('layerToFront') && file.includes('layerToBack') },
  { name: 'T3: 等间距分布', check: () => file.includes('distribute') && file.includes('horizontal') && file.includes('vertical') },
  { name: 'T4: 边框粗细样式', check: () => file.includes('applyStrokeWidth') && file.includes('toggleStrokeDash') },
  // P1
  { name: 'T5: 旋转支持', check: () => file.includes('applyRotation') && file.includes('currentRotation') && file.includes('旋转') },
  { name: 'T6: 组合/取消组合', check: () => file.includes('groupSelected') && file.includes('ungroupSelected') && file.includes('Ctrl+G') },
  { name: 'T7: 画布缩放平移', check: () => file.includes('setupCanvasEvents') && file.includes('zoomToPoint') && file.includes('relativePan') && file.includes('spacePressed') },
  { name: 'T8: 对齐辅助线', check: () => file.includes('setupGuideLines') && file.includes('SNAP_THRESHOLD') && file.includes('guideLines') },
  // P2
  { name: 'T9: 透明度控制', check: () => file.includes('applyOpacity') && file.includes('currentOpacity') && file.includes('opacity-slider') },
  { name: 'T10: 渐变填充', check: () => file.includes('applyGradient') && file.includes('gradientType') && file.includes('linear') && file.includes('radial') },
  { name: 'T11: 阴影效果', check: () => file.includes('toggleShadow') && file.includes('applyShadow') && file.includes('shadowEnabled') },
  // 快捷键
  { name: '快捷键: Ctrl+B/I/U', check: () => file.includes("key === 'b'") && file.includes("key === 'i'") && file.includes("key === 'u'") },
  { name: '快捷键: Ctrl+Z/Y', check: () => file.includes("key === 'z'") && file.includes("key === 'y'") },
  { name: '快捷键: Delete', check: () => file.includes("key === 'Delete'") },
  // UI组件
  { name: 'UI: 旋转角度输入框', check: () => file.includes('rotation-input') },
  { name: 'UI: 透明度滑块', check: () => file.includes('opacity-slider') },
  { name: 'UI: 渐变选择器', check: () => file.includes('gradient-select') },
  { name: 'UI: 阴影控件', check: () => file.includes('shadow-group') },
]

let pass = 0, fail = 0
const failures = []

console.log('🔍 SVG 编辑器静态代码分析\n')

for (const t of tests) {
  if (t.check()) {
    console.log(`✅ ${t.name}`)
    pass++
  } else {
    console.log(`❌ ${t.name}`)
    failures.push(t.name)
    fail++
  }
}

console.log(`\n${'='.repeat(40)}`)
console.log(`  通过: ${pass}  失败: ${fail}  总计: ${tests.length}`)
console.log(`${'='.repeat(40)}`)

if (fail > 0) {
  console.log('\n❌ 失败项:')
  failures.forEach(f => console.log(`  - ${f}`))
  process.exit(1)
} else {
  console.log('\n🎉 全部通过！')
}
