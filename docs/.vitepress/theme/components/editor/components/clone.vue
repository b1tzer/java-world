<!-- 原生 clone.vue 适配版 -->
<template>
  <Tooltip v-if="isOne" :content="$t('quick.copy')">
    <Button long @click="clone" icon="ios-copy" type="text"></Button>
  </Tooltip>
</template>
<script setup>
import useSelect from '../useSelect.js'
import { debounce } from 'lodash-es'
const { canvasEditor, isOne } = useSelect()
const clone = debounce(() => canvasEditor.clone(), 300)
</script>
