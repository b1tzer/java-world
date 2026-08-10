<!-- 原生 del.vue 适配版 -->
<template>
  <Tooltip v-if="isSelect" :content="$t('quick.del')">
    <Button long @click="del" icon="ios-trash" type="text"></Button>
  </Tooltip>
</template>
<script setup>
import useSelect from '../useSelect.js'
import { debounce } from 'lodash-es'
const { isSelect, canvasEditor } = useSelect()
const del = debounce(() => canvasEditor.del(), 300)
</script>
