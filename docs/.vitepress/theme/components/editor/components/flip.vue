<!-- 原生 flip.vue 适配版 -->
<template>
  <div v-if="isOne" class="attr-item-box">
    <div class="bg-item">
      <Tooltip :content="$t('attrSeting.flip.x')">
        <Button long @click="flip('X')" type="text"><flipX width="14" height="14"></flipX></Button>
      </Tooltip>
      <Tooltip :content="$t('attrSeting.flip.y')">
        <Button long @click="flip('Y')" type="text"><flipY width="14" height="14"></flipY></Button>
      </Tooltip>
    </div>
  </div>
</template>
<script setup>
import useSelect from '../useSelect.js'
import flipX from '../icons/flip/x.svg'
import flipY from '../icons/flip/y.svg'
const { isOne, canvasEditor } = useSelect()
const flip = (type) => {
  const o = canvasEditor.canvas.getActiveObject()
  o.set(`flip${type}`, !o[`flip${type}`]).setCoords()
  canvasEditor.canvas.requestRenderAll()
}
</script>
