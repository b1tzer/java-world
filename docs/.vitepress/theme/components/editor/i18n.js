/**
 * 轻量 i18n — 替代 vue-i18n 供原生 vue-fabric-editor 组件使用
 */
export function createI18n() {
  const messages = {
    zh: {
      'history.revocation': '撤销',
      'history.redo': '重做',
      'common_elements': '基本元素',
      'draw_elements': '绘制元素',
      'code_img': '码图',
      'everything_is_fine': '一切正常',
      'everything_goes_well': '一切顺利',
      'layers': '图层',
      'attrSeting.align.left': '左对齐',
      'attrSeting.align.centerX': '水平居中',
      'attrSeting.align.right': '右对齐',
      'attrSeting.align.top': '顶部对齐',
      'attrSeting.align.centerY': '垂直居中',
      'attrSeting.align.bottom': '底部对齐',
      'attrSeting.align.averageX': '水平平均分布',
      'attrSeting.align.averageY': '垂直平均分布',
      'attrSeting.flip.name': '翻转',
      'attrSeting.flip.x': '水平翻转',
      'attrSeting.flip.y': '垂直翻转',
      'attrSeting.group': '组合',
      'attrSeting.unGroup': '取消组合',
      'quick.copy': '复制',
      'quick.del': '删除',
      'grid': '网格',
      'templates': '模板',
      'elements': '元素',
      'font_style': '字体',
      'material.cartoon': '素材',
      'mine': '我的',
    },
  }
  const locale = 'zh'
  const t = (key) => messages[locale]?.[key] || key
  return { install(app) { app.config.globalProperties.$t = t }, global: { t } }
}

export const i18n = createI18n()
