<!--
  原生 vue-fabric-editor history.vue — 撤销/重做（已适配）
-->
<template>
  <div style="display: inline-block">
    <Tooltip :content="`${$t('history.revocation')}(${canUndo})`">
      <Button @click="undo" type="text" size="small" :disabled="!canUndo">
        <Icon type="ios-undo" size="20" />
      </Button>
    </Tooltip>
    <Tooltip :content="`${$t('history.redo')}(${canRedo})`">
      <Button @click="redo" type="text" size="small" :disabled="!canRedo">
        <Icon type="ios-redo" size="20" />
      </Button>
    </Tooltip>
  </div>
</template>

<script setup>
import useSelect from '../useSelect.js'
const { canvasEditor } = useSelect()
const canUndo = ref(0)
const canRedo = ref(0)

const undo = () => canvasEditor.undo()
const redo = () => canvasEditor.redo()

import { ref, onMounted } from 'vue'
onMounted(() => {
  canvasEditor?.on?.('historyUpdate', (u, r) => { canUndo.value = u; canRedo.value = r })
})
</script>
