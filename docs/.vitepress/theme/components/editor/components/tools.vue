<!-- 原生 tools.vue 适配版 -->
<template>
  <div>
    <Divider plain orientation="left">{{ $t('common_elements') }}</Divider>
    <div class="tool-box">
      <span @click="() => addText()" :draggable="true" @dragend="addText"><textIcon width="26" height="26"></textIcon></span>
      <span @click="() => addTextBox()" :draggable="true" @dragend="addTextBox"><textBoxIcon width="26" height="26"></textBoxIcon></span>
      <span @click="() => addRect()" :draggable="true" @dragend="addRect"><rectIcon width="26" height="26"></rectIcon></span>
      <span @click="() => addCircle()" :draggable="true" @dragend="addCircle"><circleIcon width="26" height="26"></circleIcon></span>
      <span @click="() => addTriangle()" :draggable="true" @dragend="addTriangle"><triangleIcon width="26" height="26"></triangleIcon></span>
      <span @click="() => addPolygon()" :draggable="true" @dragend="addPolygon"><polygonIcon width="26" height="26"></polygonIcon></span>
    </div>
    <Divider plain orientation="left">{{ $t('draw_elements') }}</Divider>
    <div class="tool-box">
      <span @click="drawingLineModeSwitch('line')" :class="state.isDrawingLineMode && state.lineType === 'line' && 'bg'"><draw1Icon width="20" height="20"></draw1Icon></span>
      <span @click="drawingLineModeSwitch('arrow')" :class="state.isDrawingLineMode && state.lineType === 'arrow' && 'bg'"><draw2Icon width="20" height="20"></draw2Icon></span>
      <span @click="drawingLineModeSwitch('thinTailArrow')" :class="state.isDrawingLineMode && state.lineType === 'thinTailArrow' && 'bg'"><draw3Icon width="20" height="20"></draw3Icon></span>
      <span @click="drawPolygon" :class="state.isDrawingLineMode && state.lineType === 'polygon' && 'bg'"><draw4Icon width="20" height="20"></draw4Icon></span>
      <span @click="freeDraw" :class="state.isDrawingLineMode && state.lineType === 'freeDraw' && 'bg'"><Icon type="md-brush" :size="22" /></span>
    </div>
    <Divider plain orientation="left">{{ $t('code_img') }}</Divider>
    <div class="tool-box">
      <span @click="canvasEditor.addQrCode"><qrCodeIcon></qrCodeIcon></span>
      <span @click="canvasEditor.addBarcode"><barCodeIcon></barCodeIcon></span>
    </div>
  </div>
</template>

<script setup>
import { reactive, onDeactivated } from 'vue'
import { getPolygonVertices } from '../utils.js'
import useSelect from '../useSelect.js'
import { i18n } from '../i18n.js'
import circleIcon from '../icons/tools/circle.svg'
import draw1Icon from '../icons/tools/draw1.svg'
import draw2Icon from '../icons/tools/draw2.svg'
import draw3Icon from '../icons/tools/draw3.svg'
import draw4Icon from '../icons/tools/draw4.svg'
import polygonIcon from '../icons/tools/polygon.svg'
import rectIcon from '../icons/tools/rect.svg'
import textIcon from '../icons/tools/text.svg'
import textBoxIcon from '../icons/tools/textBox.svg'
import triangleIcon from '../icons/tools/triangle.svg'
import qrCodeIcon from '../icons/tools/qrCode.svg'
import barCodeIcon from '../icons/tools/barCode.svg'

const { t } = i18n.global
const LINE_TYPE = { polygon: 'polygon', freeDraw: 'freeDraw', pathText: 'pathText' }
const defaultPosition = { shadow: '', fontFamily: 'arial' }

const { fabric, canvasEditor } = useSelect()
const state = reactive({ isDrawingLineMode: false, lineType: false })

const addText = (event) => { cancelDraw(); canvasEditor.addBaseType(new fabric.IText(t('everything_is_fine'), { ...defaultPosition, fontSize: 80, fill: '#000000FF' }), { center: true, event }) }
const addTextBox = (event) => { cancelDraw(); canvasEditor.addBaseType(new fabric.Textbox(t('everything_goes_well'), { ...defaultPosition, splitByGrapheme: true, width: 400, fontSize: 80, fill: '#000000FF' }), { center: true, event }) }
const addTriangle = (event) => { cancelDraw(); canvasEditor.addBaseType(new fabric.Triangle({ ...defaultPosition, width: 400, height: 400, fill: '#92706BFF', name: '三角形' }), { center: true, event }) }
const addPolygon = (event) => { cancelDraw(); const p = new fabric.Polygon(getPolygonVertices(5, 200), { ...defaultPosition, fill: '#CCCCCCFF', name: '多边形' }); p.set({ width: 400, height: 400, pathOffset: { x: 0, y: 0 } }); canvasEditor.addBaseType(p, { center: true, event }) }
const addCircle = (event) => { cancelDraw(); canvasEditor.addBaseType(new fabric.Circle({ ...defaultPosition, radius: 150, fill: '#57606BFF', name: '圆形' }), { center: true, event }) }
const addRect = (event) => { cancelDraw(); canvasEditor.addBaseType(new fabric.Rect({ ...defaultPosition, fill: '#F57274FF', width: 400, height: 400, name: '矩形' }), { center: true, event }) }

const ensureObjectSelEvStatus = (evented, selectable) => {
  canvasEditor.canvas.forEachObject((obj) => { if (obj.id !== 'workspace') { obj.selectable = selectable; obj.evented = evented } })
}
const endConflictTools = () => { canvasEditor.discardPolygon(); canvasEditor.endDraw(); canvasEditor.endTextPathDraw() }
const endDrawingLineMode = () => { state.isDrawingLineMode = false; state.lineType = ''; canvasEditor.setMode(false); canvasEditor.setLineType('') }
const cancelDraw = () => { if (!state.isDrawingLineMode) return; state.isDrawingLineMode = false; state.lineType = ''; canvasEditor.setMode(false); endConflictTools(); ensureObjectSelEvStatus(true, true) }

const drawPolygon = () => {
  if (state.lineType !== LINE_TYPE.polygon) {
    endConflictTools(); endDrawingLineMode(); state.lineType = LINE_TYPE.polygon; state.isDrawingLineMode = true
    canvasEditor.beginDrawPolygon(() => { state.lineType = false; state.isDrawingLineMode = false; ensureObjectSelEvStatus(true, true) })
    canvasEditor.endDraw(); ensureObjectSelEvStatus(false, false)
  } else { canvasEditor.discardPolygon() }
}
const freeDraw = () => {
  if (state.lineType === LINE_TYPE.freeDraw) { canvasEditor.endDraw(); state.lineType = false; state.isDrawingLineMode = false }
  else { endConflictTools(); endDrawingLineMode(); state.lineType = LINE_TYPE.freeDraw; state.isDrawingLineMode = true; canvasEditor.startDraw({ width: 20 }) }
}
const drawingLineModeSwitch = (type) => {
  if ([LINE_TYPE.polygon, LINE_TYPE.freeDraw, LINE_TYPE.pathText].includes(state.lineType)) endConflictTools()
  if (state.lineType === type) { state.isDrawingLineMode = false; state.lineType = '' }
  else { state.isDrawingLineMode = true; state.lineType = type }
  canvasEditor.setMode(state.isDrawingLineMode); canvasEditor.setLineType(type)
  ensureObjectSelEvStatus(!state.isDrawingLineMode, !state.isDrawingLineMode)
}
onDeactivated(() => cancelDraw())
</script>

<style scoped lang="less">
.tool-box { display: flex; justify-content: space-around;
  span { flex: 1; text-align: center; padding: 5px 0; background: #f6f6f6; margin-left: 2px; cursor: pointer;
    &:hover { background: #edf9ff; svg { fill: #2d8cf0 } }
  }
  .bg { background: #d8d8d8; &:hover svg { fill: #2d8cf0 } }
}
</style>
