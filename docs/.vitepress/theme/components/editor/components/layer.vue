<!-- 原生 layer.vue 适配版 -->
<template>
  <div class="box">
    <template v-if="list.length">
      <Divider plain orientation="left">{{ $t('layers') }}</Divider>
      <div class="layer-box">
        <div v-for="item in list" @click="select(item.id)" :key="item.id" :class="isSelect(item) && 'active'">
          <Row class="ellipsis">
            <Col span="20">
              <Tooltip :content="item.name || item.text || item.type" placement="left">
                <span :class="isSelect(item) && 'active'" v-html="iconType(item.type)"></span>
                | {{ textType(item.type, item) }}
              </Tooltip>
            </Col>
            <Col span="4">
              <Button long :icon="item.isLock ? 'md-lock' : 'md-unlock'" type="text" @click="doLock(item)"></Button>
            </Col>
          </Row>
        </div>
      </div>
      <div class="btn-box">
        <ButtonGroup v-show="isOne" size="small">
          <Button @click="up"><span v-html="btnIconType('up')"></span></Button>
          <Button @click="down"><span v-html="btnIconType('down')"></span></Button>
          <Button @click="upTop"><span v-html="btnIconType('upTop')"></span></Button>
          <Button @click="downTop"><span v-html="btnIconType('downTop')"></span></Button>
        </ButtonGroup>
      </div>
    </template>
    <template v-else><p class="empty-text">暂无图层</p></template>
  </div>
</template>

<script setup>
import { ref, unref } from 'vue'
import { uniqBy } from 'lodash-es'
import useSelect from '../useSelect.js'
import groupIcon from '../icons/layer/group.svg?raw'
import textbox from '../icons/layer/textbox.svg?raw'
import iText from '../icons/layer/iText.svg?raw'
import imageIcon from '../icons/layer/image.svg?raw'
import rectIcon from '../icons/layer/rect.svg?raw'
import circleIcon from '../icons/layer/circle.svg?raw'
import triangleIcon from '../icons/layer/triangle.svg?raw'
import polygonIcon from '../icons/layer/polygon.svg?raw'
import upIcon from '../icons/layer/up.svg?raw'
import downIcon from '../icons/layer/down.svg?raw'
import upTopIcon from '../icons/layer/upTop.svg?raw'
import downTopIcon from '../icons/layer/downTop.svg?raw'

const { canvasEditor, isOne, fabric, mixinState } = useSelect()
const list = ref([])

const isSelect = (item) => item.id === mixinState.mSelectId || mixinState.mSelectIds.includes(item.id)

const iconType = (type) => {
  const map = { group: groupIcon, textbox, 'i-text': iText, image: imageIcon, rect: rectIcon, circle: circleIcon, triangle: triangleIcon, polygon: polygonIcon }
  return map[type] || ''
}
const textType = (type, item) => {
  if (type.includes('text')) return item.name || item.text
  return { group: '组合', image: '图片', rect: '矩形', circle: '圆形', triangle: '三角形', polygon: '多边形', path: '路径' }[type] || '默认元素'
}
const select = (id) => {
  const info = canvasEditor.canvas.getObjects().find(it => it.id === id)
  canvasEditor.canvas.discardActiveObject(); canvasEditor.canvas.setActiveObject(info); canvasEditor.canvas.requestRenderAll()
}
const btnIconType = (type) => ({ up: upIcon, down: downIcon, upTop: upTopIcon, downTop: downTopIcon }[type])
const up = () => canvasEditor.up()
const upTop = () => canvasEditor.toFront()
const down = () => canvasEditor.down()
const downTop = () => canvasEditor.toBack()

const getList = () => {
  list.value = [...canvasEditor.canvas.getObjects().filter(item => !(item instanceof fabric.GuideLine || item.id === 'workspace'))]
    .reverse().map(item => ({ type: item.type, id: item.id, name: item.name, text: item.text, isLock: !item.selectable }))
  list.value = uniqBy(unref(list), 'id')
}
const doLock = (item) => { select(item.id); item.isLock ? canvasEditor.unLock() : canvasEditor.lock(); canvasEditor.canvas.discardActiveObject() }

import { onMounted } from 'vue'
onMounted(() => { getList(); canvasEditor?.canvas?.on?.('after:render', getList) })
</script>

<style scoped lang="less">
:deep(.ivu-tooltip-inner) { white-space: normal }
:deep(.ivu-tooltip) { display: block }
.box { width: 100% }
.layer-box { height: calc(100vh - 170px); overflow-y: auto; margin-bottom: 5px;
  .ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer }
  & > div { padding: 0 5px; margin: 3px 0; background: #f7f7f7; color: #c8c8c8; border-radius: 3px; font-size: 14px; line-height: 28px;
    &.active { color: #2d8cf0; background: #f0faff; font-weight: bold }
  }
}
.btn-box { width: 100%; margin-bottom: 20px; background: #f3f3f3;
  .ivu-btn-group { display: flex }
  .ivu-btn-group > .ivu-btn { flex: 1 }
}
svg { vertical-align: text-top }
:deep(.ivu-divider-plain) { &.ivu-divider-with-text-left { margin: 10px 0; font-size: 16px; font-weight: bold; color: #000 } }
.empty-text { width: 100%; text-align: center; padding-top: 10px; color: #999 }
</style>
<style lang="less">
span { svg { vertical-align: middle } &.active svg.icon { fill: #2d8cf0 } }
</style>
