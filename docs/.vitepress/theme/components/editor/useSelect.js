/**
 * useSelect — 原生 vue-fabric-editor 组件的 inject 适配层
 *
 * 原生组件通过 inject('fabric') 和 inject('canvasEditor') 获取实例。
 * 此 hook 封装 inject + 选择状态追踪。
 */
import { inject, computed, reactive, onMounted, onBeforeUnmount } from 'vue'

// ═══ 事件类型（与 @kuaitu/core EventType 对齐）═══
const SelectMode = { EMPTY: 'empty', ONE: 'one', MULTI: 'multiple' }
const SelectEvent = { ONE: 'selectOne', MULTI: 'selectMulti', CANCEL: 'selectCancel' }

export default function useSelect() {
  const fabric = inject('fabric')
  const canvasEditor = inject('canvasEditor')

  const mixinState = reactive({
    mSelectMode: SelectMode.EMPTY,
    mSelectOneType: '',
    mSelectId: '',
    mSelectIds: [],
    mSelectActive: [],
  })

  let _callback = () => {}

  canvasEditor?.on?.(SelectEvent.ONE, (arr) => {
    mixinState.mSelectMode = SelectMode.ONE
    const [item] = arr
    if (item) {
      mixinState.mSelectActive = [item]
      mixinState.mSelectId = item.id
      mixinState.mSelectOneType = item.type
      mixinState.mSelectIds = [item.id]
    }
    _callback()
  })

  canvasEditor?.on?.(SelectEvent.MULTI, (arr) => {
    mixinState.mSelectMode = SelectMode.MULTI
    mixinState.mSelectId = ''
    mixinState.mSelectIds = arr.map(it => it.id)
    _callback()
  })

  canvasEditor?.on?.(SelectEvent.CANCEL, () => {
    mixinState.mSelectId = ''
    mixinState.mSelectIds = []
    mixinState.mSelectMode = SelectMode.EMPTY
    mixinState.mSelectOneType = ''
    _callback()
  })

  onBeforeUnmount(() => {
    canvasEditor?.off?.(SelectEvent.ONE)
    canvasEditor?.off?.(SelectEvent.MULTI)
    canvasEditor?.off?.(SelectEvent.CANCEL)
  })

  const isOne = computed(() => mixinState.mSelectMode === 'one')
  const isMultiple = computed(() => mixinState.mSelectMode === 'multiple')
  const isGroup = computed(() => mixinState.mSelectMode === 'one' && mixinState.mSelectOneType === 'group')
  const selectType = computed(() => mixinState.mSelectOneType)

  return { fabric, canvasEditor, mixinState, isOne, isMultiple, isGroup, selectType }
}
