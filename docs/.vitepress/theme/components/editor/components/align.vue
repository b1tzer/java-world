<!-- 原生 align.vue 适配版 -->
<template>
  <div v-if="isMultiple" class="attr-item-box">
    <Divider plain orientation="left"><h4>对齐</h4></Divider>
    <div class="bg-item">
      <Tooltip :content="$t('attrSeting.align.left')"><Button @click="left" size="small" type="text"><leftIcon /></Button></Tooltip>
      <Tooltip :content="$t('attrSeting.align.centerX')"><Button @click="xcenter" size="small" type="text"><centerxIcon /></Button></Tooltip>
      <Tooltip :content="$t('attrSeting.align.right')"><Button @click="right" size="small" type="text"><rightIcon /></Button></Tooltip>
      <Tooltip :content="$t('attrSeting.align.top')"><Button @click="top" size="small" type="text"><topIcon /></Button></Tooltip>
      <Tooltip :content="$t('attrSeting.align.centerY')"><Button @click="ycenter" size="small" type="text"><centeryIcon /></Button></Tooltip>
      <Tooltip :content="$t('attrSeting.align.bottom')"><Button @click="bottom" size="small" type="text"><bottomIcon /></Button></Tooltip>
      <Tooltip :content="$t('attrSeting.align.averageX')"><Button @click="xequation" size="small" type="text"><sxIcon /></Button></Tooltip>
      <Tooltip :content="$t('attrSeting.align.averageY')"><Button @click="yequation" size="small" type="text"><syIcon /></Button></Tooltip>
    </div>
  </div>
</template>
<script setup>
import useSelect from '../useSelect.js'
import leftIcon from '../icons/align/left.svg'
import rightIcon from '../icons/align/right.svg'
import topIcon from '../icons/align/top.svg'
import bottomIcon from '../icons/align/bottom.svg'
import sxIcon from '../icons/align/averageX.svg'
import syIcon from '../icons/align/averageY.svg'
import centerxIcon from '../icons/align/centerX.svg'
import centeryIcon from '../icons/align/centerY.svg'
const { canvasEditor, isMultiple } = useSelect()
const left = () => canvasEditor.left()
const right = () => canvasEditor.right()
const xcenter = () => canvasEditor.xcenter()
const ycenter = () => canvasEditor.ycenter()
const top = () => canvasEditor.top()
const bottom = () => canvasEditor.bottom()
const xequation = () => canvasEditor.xequation()
const yequation = () => canvasEditor.yequation()
</script>
