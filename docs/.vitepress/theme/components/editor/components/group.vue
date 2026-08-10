<!-- 原生 group.vue 适配版 -->
<template>
  <div v-if="isMultiple || isGroup" class="attr-item-box">
    <div class="bg-item">
      <Button v-if="isMultiple" long :disabled="!isMultiple" @click="group" type="text">
        <groupIcon width="14" height="14"></groupIcon>
        {{ $t('attrSeting.group') }}
      </Button>
      <Button v-if="isGroup" long :disabled="!isGroup" @click="unGroup" type="text">
        <unGroupIcon width="14" height="14"></unGroupIcon>
        {{ $t('attrSeting.unGroup') }}
      </Button>
    </div>
  </div>
</template>
<script setup>
import useSelect from '../useSelect.js'
import groupIcon from '../icons/group/group.svg'
import unGroupIcon from '../icons/group/unGroup.svg'
const { isGroup, isMultiple, canvasEditor } = useSelect()
const unGroup = () => canvasEditor.unGroup()
const group = () => canvasEditor.group()
</script>
<style scoped lang="less">
:deep(.ivu-btn) { &[disabled] svg { opacity: .2 } }
</style>
