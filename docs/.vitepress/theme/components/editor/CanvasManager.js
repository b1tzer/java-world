/**
 * Canvas 管理器 — 封装 Fabric.js 画布生命周期与缩放/平移/辅助线
 *
 * 职责：
 *   - 初始化/销毁 Fabric.js 画布
 *   - 缩放控制（zoomIn/zoomOut/zoomFit）
 *   - 画布平移（空格+拖拽）
 *   - 对齐辅助线（移动时参考线 + 松手吸附）
 *   - 对象交互配置（控制点、悬停、选择事件）
 *
 * 依赖：全局 fabric（由 loadFabric 保证可用）
 */

import { getObjBounds } from './plugins/selection.js'

const SNAP_THRESHOLD = 8
const GUIDE_LINE_STYLE = 'rgba(0, 120, 212, 0.5)'
const GUIDE_LINE_DASH = [4, 4]

export class CanvasManager {
  constructor() {
    this.canvas = null
    this._zoomLevel = 100
    this._guideLines = []
    this._bgRects = []
    this._spacePressed = false
    this._isPanning = false
    this._lastPanPoint = { x: 0, y: 0 }
    this._onZoomChange = null // 缩放回调
    this._onGuideLinesChange = null // 辅助线回调
    this._onSelectionChange = null // 选择回调
    this._onModified = null // 修改回调
  }

  /**
   * 初始化画布
   * @param {HTMLCanvasElement} canvasEl
   * @param {number} containerW - 容器宽度
   * @param {number} containerH - 容器高度
   */
  init(canvasEl, containerW, containerH) {
    const fc = new window.fabric.Canvas(canvasEl, {
      width: containerW,
      height: containerH,
      backgroundColor: '#f5f5f5',
      selection: true,
      preserveObjectStacking: true,
      perPixelTargetFind: false,
      targetFindTolerance: 8,
      controlsAboveOverlay: true,
    })

    this._setupControls()
    this._setupCanvasEvents(fc)
    this._setupGuideLines(fc)
    this._setupInteractionEvents(fc)

    this.canvas = fc
    return fc
  }

  /**
   * 配置控制点样式
   */
  _setupControls() {
    window.fabric.Object.prototype.set({
      transparentCorners: false,
      cornerSize: 10,
      cornerStrokeColor: '#0078d4',
      cornerColor: '#ffffff',
      cornerStyle: 'circle',
      borderColor: '#0078d4',
      borderScaleFactor: 1.5,
      borderDashArray: [4, 2],
      padding: 8,
      perPixelTargetFind: false,
    })
  }

  /**
   * 缩放/平移事件
   */
  _setupCanvasEvents(fc) {
    // 滚轮缩放（无需 Ctrl）
    fc.on('mouse:wheel', (opt) => {
      opt.e.preventDefault()
      opt.e.stopPropagation()
      const delta = opt.e.deltaY
      let zoom = fc.getZoom()
      zoom *= 0.999 ** delta
      zoom = Math.min(Math.max(0.1, zoom), 5)
      fc.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom)
      this._zoomLevel = Math.round(zoom * 100)
      this._notifyZoom()
    })

    // 空格+拖拽平移
    fc.on('mouse:down', (opt) => {
      if (!this._spacePressed) return
      this._isPanning = true
      this._lastPanPoint = { x: opt.e.clientX, y: opt.e.clientY }
      fc.selection = false
      fc.setCursor('grabbing')
    })

    fc.on('mouse:move', (opt) => {
      if (!this._isPanning) return
      const dx = opt.e.clientX - this._lastPanPoint.x
      const dy = opt.e.clientY - this._lastPanPoint.y
      fc.relativePan({ x: dx, y: dy })
      this._lastPanPoint = { x: opt.e.clientX, y: opt.e.clientY }
    })

    fc.on('mouse:up', () => {
      if (this._isPanning) {
        this._isPanning = false
        fc.selection = true
        fc.setCursor('default')
      }
    })
  }

  /**
   * 对齐辅助线
   */
  _setupGuideLines(fc) {
    // 移动时：显示参考线
    fc.on('object:moving', (opt) => {
      const obj = opt.target
      if (!obj) return
      const lines = []
      const objBounds = getObjBounds(obj)
      const objects = fc.getObjects().filter(o => o !== obj && o.visible)

      for (const other of objects) {
        const ob = getObjBounds(other)
        const vChecks = [
          { objX: objBounds.centerX, otherX: ob.centerX },
          { objX: objBounds.left, otherX: ob.left },
          { objX: objBounds.right, otherX: ob.right },
        ]
        for (const check of vChecks) {
          if (Math.abs(check.objX - check.otherX) < SNAP_THRESHOLD) {
            lines.push({ type: 'vertical', x: check.otherX })
          }
        }
        const hChecks = [
          { objY: objBounds.centerY, otherY: ob.centerY },
          { objY: objBounds.top, otherY: ob.top },
          { objY: objBounds.bottom, otherY: ob.bottom },
        ]
        for (const check of hChecks) {
          if (Math.abs(check.objY - check.otherY) < SNAP_THRESHOLD) {
            lines.push({ type: 'horizontal', y: check.otherY })
          }
        }
      }
      this._guideLines = lines
      this._notifyGuideLines()
      fc.requestRenderAll()
    })

    // 松手时：吸附
    fc.on('object:modified', (opt) => {
      const obj = opt.target
      if (obj && this._guideLines.length) {
        const z = fc.getZoom()
        const bounds = getObjBounds(obj)
        for (const line of this._guideLines) {
          if (line.type === 'vertical') {
            const diff = line.x - bounds.centerX
            if (Math.abs(diff) < SNAP_THRESHOLD) obj.set('left', obj.left + diff / z)
          } else {
            const diff = line.y - bounds.centerY
            if (Math.abs(diff) < SNAP_THRESHOLD) obj.set('top', obj.top + diff / z)
          }
        }
        obj.setCoords()
      }
      this._guideLines = []
      this._notifyGuideLines()
      fc.requestRenderAll()
      if (this._onModified) this._onModified()
    })

    fc.on('selection:cleared', () => { this._guideLines = []; this._notifyGuideLines() })

    // 自定义渲染参考线
    fc.on('after:render', () => {
      if (!this._guideLines.length) return
      const ctx = fc.getContext()
      ctx.save()
      ctx.strokeStyle = GUIDE_LINE_STYLE
      ctx.lineWidth = 1
      ctx.setLineDash(GUIDE_LINE_DASH)
      const vpt = fc.viewportTransform
      for (const line of this._guideLines) {
        ctx.beginPath()
        if (line.type === 'vertical') {
          const x = line.x * vpt[0] + vpt[4]
          ctx.moveTo(x, 0); ctx.lineTo(x, fc.height)
        } else {
          const y = line.y * vpt[3] + vpt[5]
          ctx.moveTo(0, y); ctx.lineTo(fc.width, y)
        }
        ctx.stroke()
      }
      ctx.restore()
    })
  }

  /**
   * 交互事件（悬停、选择、文字缩放）
   */
  _setupInteractionEvents(fc) {
    fc.on('object:added', (e) => {
      if (e.target) {
        e.target.set({ selectable: true, evented: true })
        if (e.target._objects) e.target._objects.forEach(o => o.set({ selectable: true, evented: true }))
      }
    })

    fc.on('mouse:over', (e) => {
      if (e.target && e.target.selectable) {
        fc.setCursor('pointer')
        if (!fc.getActiveObject()) {
          e.target._origBorderColor = e.target.borderColor
          e.target.set({ borderColor: '#0078d4' })
          fc.requestRenderAll()
        }
      }
    })

    fc.on('mouse:out', (e) => {
      fc.setCursor('default')
      if (e.target && !fc.getActiveObject()) {
        e.target.set({ borderColor: e.target._origBorderColor || '#0078d4' })
        fc.requestRenderAll()
      }
    })

    fc.on('selection:created', () => this._notifySelection())
    fc.on('selection:updated', () => this._notifySelection())
    fc.on('selection:cleared', () => this._notifySelection())

    // Textbox 缩放时保持字号不变（Office 行为）
    fc.on('object:scaling', (e) => {
      const obj = e.target
      if (!obj || (obj.type !== 'textbox' && obj.type !== 'i-text')) return
      if (obj.__scalingFontSize == null) obj.__scalingFontSize = obj.fontSize
      obj.set({ fontSize: obj.__scalingFontSize / Math.max(obj.scaleY, 0.1) })
    })

    fc.on('object:modified', (e) => {
      const obj = e.target
      if (obj && (obj.type === 'textbox' || obj.type === 'i-text')) {
        if (obj.__scalingFontSize != null) {
          const origFontSize = obj.__scalingFontSize
          const newWidth = Math.max(obj.width * obj.scaleX, 30)
          obj.set({ width: newWidth, scaleX: 1, scaleY: 1, fontSize: origFontSize })
          delete obj.__scalingFontSize
          obj.setCoords()
          fc.requestRenderAll()
        }
      }
    })
  }

  /**
   * 设置空格键状态（由外部 keydown/keyup 控制）
   */
  setSpacePressed(pressed) { this._spacePressed = pressed; if (!pressed && !this._isPanning) this.canvas?.setCursor('default') }

  // ── 缩放 ──
  zoomIn() {
    let z = this.canvas.getZoom() * 1.2
    z = Math.min(z, 5)
    this.canvas.setZoom(z)
    this._zoomLevel = Math.round(z * 100)
    this._notifyZoom()
  }

  zoomOut() {
    let z = this.canvas.getZoom() / 1.2
    z = Math.max(z, 0.1)
    this.canvas.setZoom(z)
    this._zoomLevel = Math.round(z * 100)
    this._notifyZoom()
  }

  zoomFit() {
    const fc = this.canvas
    const objects = fc.getObjects()
    if (!objects.length) return
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    objects.forEach(o => {
      const b = o.getBoundingRect()
      minX = Math.min(minX, b.left); minY = Math.min(minY, b.top)
      maxX = Math.max(maxX, b.left + b.width); maxY = Math.max(maxY, b.top + b.height)
    })
    const bw = maxX - minX, bh = maxY - minY
    const cw = fc.width, ch = fc.height
    const z = Math.min((cw - 60) / bw, (ch - 60) / bh, 2)
    const vpt = [z, 0, 0, z, (cw - bw * z) / 2 - minX * z, (ch - bh * z) / 2 - minY * z]
    fc.setViewportTransform(vpt)
    fc.requestRenderAll()
    this._zoomLevel = Math.round(z * 100)
    this._notifyZoom()
  }

  getZoomLevel() { return this._zoomLevel }

  // ── 背景白板管理 ──
  addBackground(svgWidth, svgHeight) {
    if (svgWidth <= 0 || svgHeight <= 0) return
    const shadow = new window.fabric.Rect({
      left: -1, top: -1, width: svgWidth + 2, height: svgHeight + 2,
      fill: 'transparent', stroke: 'rgba(0,0,0,0.15)', strokeWidth: 3,
      selectable: false, evented: false, excludeFromExport: true,
    })
    const bg = new window.fabric.Rect({
      left: 0, top: 0, width: svgWidth, height: svgHeight,
      fill: '#ffffff', stroke: '#cccccc', strokeWidth: 1,
      selectable: false, evented: false, excludeFromExport: true,
    })
    this._bgRects = [shadow, bg]
    this.canvas.add(shadow)
    this.canvas.add(bg)
    shadow.sendToBack()
    bg.sendToBack()
  }

  removeBg() { this._bgRects.forEach(r => this.canvas.remove(r)) }

  reAddBg() {
    if (!this._bgRects.length) return
    const fc = this.canvas
    fc.getObjects().filter(o => o.excludeFromExport).forEach(o => fc.remove(o))
    this._bgRects.forEach(r => { fc.add(r); r.set({ selectable: false, evented: false, hoverCursor: 'default' }); r.sendToBack() })
    fc.requestRenderAll()
  }

  // ── 回调注册 ──
  onZoomChange(fn) { this._onZoomChange = fn }
  onGuideLinesChange(fn) { this._onGuideLinesChange = fn }
  onSelectionChange(fn) { this._onSelectionChange = fn }
  onModified(fn) { this._onModified = fn }

  _notifyZoom() { if (this._onZoomChange) this._onZoomChange(this._zoomLevel) }
  _notifyGuideLines() { if (this._onGuideLinesChange) this._onGuideLinesChange(this._guideLines) }
  _notifySelection() { if (this._onSelectionChange) this._onSelectionChange() }

  // ── 生命周期 ──
  dispose() {
    if (this.canvas) {
      this.canvas.dispose()
      this.canvas = null
    }
  }
}
