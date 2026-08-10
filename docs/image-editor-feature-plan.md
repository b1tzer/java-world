# vue-fabric-editor 功能清单与 VitePress 插件规划

> 调研日期：2026-08-10
> 目标：明确对方有哪些功能，我们需要做哪些功能

---

## 一、对方完整功能清单（34 个插件 + 50+ 组件）

### 1.1 基础元素（AddBaseTypePlugin + tools.vue）

| 功能 | 对方组件 | 说明 |
|---|---|---|
| 纯文本 | addText() | IText，可直接编辑 |
| 文本框 | addTextBox() | Textbox，自动换行 |
| 矩形 | addRect() | 支持圆角 |
| 圆形 | addCircle() | Ellipse |
| 三角形 | addTriangle() | |
| 多边形 | addPolygon() | 可调边数（3-30） |
| 直线 | DrawLinePlugin | |
| 箭头 | DrawLinePlugin | 3种箭头样式 |
| 多边形绘制 | DrawPolygonPlugin | 自由绘制多边形 |
| 画笔 | FreeDrawPlugin | 自由绘画 |

### 1.2 图片编辑

| 功能 | 对方组件/插件 | 说明 |
|---|---|---|
| 插入图片 | MaterialPlugin / importFile | 拖拽 + 文件选择 |
| 图片裁剪 | SimpleClipImagePlugin + cropperDialog | 矩形/圆形/三角形/五边形裁剪 |
| 图片滤镜 | filters.vue | 灰度/反转/亮度/对比度/饱和度/模糊/噪点/像素化/棕褐色/复古/柯达/宝丽来等 |
| 图片描边 | ImageStroke | 图片描边效果 |
| 图片替换 | replaceImg.vue | 替换图片但保留样式 |
| PSD 导入 | PsdPlugin | 解析 PSD 文件 |

### 1.3 文字属性（12 个属性组件）

| 功能 | 对方组件 | 说明 |
|---|---|---|
| 字体选择 | attributeFont.vue | 自定义字体列表，字体预览 |
| 字号 | attributeFont.vue | 数值输入 |
| 对齐方式 | attributeFont.vue | 左/中/右/两端对齐 |
| 加粗/斜体/下划线/删除线 | attributeFont.vue | 文字样式 |
| 行高 | attributeFont.vue | |
| 字间距 | attributeFont.vue | |
| 文字颜色 | attributeColor.vue | 纯色/渐变 |
| 文字描边 | attributeBorder.vue | 颜色 + 宽度 + 虚线样式 |
| 文字阴影 | attributeShadow.vue | 颜色 + 模糊 + 偏移 |
| 文字内容 | attributeTextContent.vue | 多行文字编辑 |
| 文字浮雕 | attributeTextFloat.vue | |
| 路径文字 | PathTextPlugin | 文字沿路径排列 |

### 1.4 外观属性

| 功能 | 对方组件 | 说明 |
|---|---|---|
| 填充颜色 | colorSelector.vue | 纯色 + 渐变（线性/径向） |
| 描边颜色 + 宽度 + 虚线 | attributeBorder.vue | |
| 阴影 | attributeShadow.vue | 颜色/模糊/X偏移/Y偏移 |
| 透明度 | attribute.vue | 全局透明度 |
| 圆角 | attributeRounded.vue | 矩形圆角 |
| 渐变编辑器 | color-picker/ | 角度/色标/预设 |

### 1.5 变换与对齐

| 功能 | 对方组件/插件 | 说明 |
|---|---|---|
| 位置 (X/Y) | attributePostion.vue | 精确输入 |
| 尺寸 (W/H) | attributePostion.vue | 精确输入 |
| 旋转角度 | attributePostion.vue | |
| 水平翻转 | FlipPlugin + flip.vue | |
| 垂直翻转 | FlipPlugin + flip.vue | |
| 水平居中 | CenterAlignPlugin | 画布居中 |
| 垂直居中 | CenterAlignPlugin | 画布居中 |
| 多元素对齐 | GroupAlignPlugin + align.vue | 左/右/上/下/水平/垂直居中 |
| 辅助线吸附 | AlignGuidLinePlugin | 移动时显示参考线 |

### 1.6 图层与组合

| 功能 | 对方组件/插件 | 说明 |
|---|---|---|
| 图层列表 | layer.vue | 显示所有元素，点击选中 |
| 上移/下移/置顶/置底 | LayerPlugin | 层级调整 |
| 锁定/解锁 | LockPlugin + lock.vue | 锁定后不可编辑 |
| 显示/隐藏 | hide.vue | 隐藏元素 |
| 组合 | GroupPlugin + group.vue | 多元素组合 |
| 取消组合 | GroupPlugin | |
| 组合内文字编辑 | GroupTextEditorPlugin | |

### 1.7 历史记录

| 功能 | 对方组件/插件 | 说明 |
|---|---|---|
| 撤销 | HistoryPlugin | Ctrl+Z |
| 重做 | HistoryPlugin | Ctrl+Shift+Z |
| 历史状态显示 | history.vue | 显示可撤销/重做次数 |

### 1.8 导入导出

| 功能 | 对方组件/插件 | 说明 |
|---|---|---|
| 导入 JSON | ServersPlugin + importJSON.vue | |
| 导入 PSD | PsdPlugin | |
| 导入模板 | importTmpl.vue | 从模板库选择 |
| 导出 PNG | ServersPlugin + save.vue | |
| 导出 SVG | ServersPlugin | |
| 导出 JSON | ServersPlugin | |
| 复制到剪贴板 | ServersPlugin | |
| 预览 | previewCurrent.vue | |

### 1.9 画布控制

| 功能 | 对方组件/插件 | 说明 |
|---|---|---|
| 画布缩放 | WorkspacePlugin + zoom.vue | 滚轮 + 按钮 |
| 画布尺寸 | setSize.vue | 自定义宽高 |
| 背景颜色 | bgBar.vue | |
| 背景图片 | bgBar.vue | 上传/从库选择 |
| 标尺 | RulerPlugin | |
| 拖拽模式 | DringPlugin + dragMode.vue | 中键拖拽 |
| 水印 | WaterMarkPlugin + waterMark.vue | |
| 画布遮罩 | workspaceMask.vue | |

### 1.10 特殊功能

| 功能 | 对方组件/插件 | 说明 |
|---|---|---|
| 二维码 | QrCodePlugin | 生成二维码 |
| 条形码 | BarCodePlugin | 生成条形码 |
| 右键菜单 | ContextMenu.js | |
| 快捷键 | 各插件内置 | |
| 国际化 | vue-i18n | 中英文 |
| 拖拽添加 | ServersPlugin.dragAddItem | 从侧栏拖到画布 |

---

## 二、我们的编辑器现状（玩具级别）

| 功能 | 我们的实现 | 对比对方 |
|---|---|---|
| 添加矩形 | ✅ | 缺圆角、渐变 |
| 添加圆形 | ✅ | 缺椭圆参数 |
| 添加文字 | ✅ | 缺字体选择、行高、字间距 |
| 添加图片 | ✅ | 缺裁剪、滤镜、替换 |
| 画笔 | ✅ | |
| 选择 | ✅ | |
| 撤销/重做 | ❌ 占位 | 需要实现 |
| 导出 PNG | ✅ | |
| 导出 SVG | ✅ | |
| 导出 JSON | ✅ | |
| 位置/尺寸 | ✅ | 缺旋转 |
| 填充颜色 | ✅ | 缺渐变 |
| 描边 | ✅ | 缺虚线样式 |
| 透明度 | ✅ | |
| 加粗/斜体 | ✅ | 缺下划线/删除线 |
| 图层 | ❌ | 需要实现 |
| 组合 | ❌ | 需要实现 |
| 翻转 | ❌ | 需要实现 |
| 对齐 | ❌ | 需要实现 |
| 辅助线 | ❌ | 需要实现 |
| 标尺 | ❌ | 需要实现 |
| 滤镜 | ❌ | 需要实现 |
| 裁剪 | ❌ | 需要实现 |
| 阴影 | ❌ | 需要实现 |
| 渐变 | ❌ | 需要实现 |
| 快捷键 | 部分 | 需要完善 |
| 右键菜单 | ❌ | 需要实现 |
| 锁定/隐藏 | ❌ | 需要实现 |
| 二维码/条形码 | ❌ | 低优先级 |
| 水印 | ❌ | 低优先级 |
| 标尺 | ❌ | 中优先级 |
| PSD 导入 | ❌ | 低优先级 |
| 国际化 | ❌ | 不需要 |

---

## 三、功能优先级规划

### P0 - 核心编辑能力（必须做）

| 功能 | 说明 | 复杂度 |
|---|---|---|
| 撤销/重做 | HistoryPlugin，Ctrl+Z / Ctrl+Shift+Z | 中 |
| 图层列表 | 显示所有元素，点击选中，拖拽排序 | 中 |
| 上移/下移/置顶/置底 | 层级调整按钮 | 低 |
| 组合/取消组合 | Ctrl+G / Ctrl+Shift+G | 中 |
| 翻转 | 水平/垂直翻转 | 低 |
| 多元素对齐 | 左/右/上/下/水平/垂直居中 | 中 |
| 阴影 | 颜色/模糊/X偏移/Y偏移 | 低 |
| 渐变填充 | 线性/径向渐变，角度/色标 | 中 |
| 图片滤镜 | 灰度/复古/模糊/亮度/对比度等 | 中 |
| 图片裁剪 | 矩形/圆形裁剪 | 中 |
| 快捷键完善 | Delete/方向键/Ctrl+C/V/D/A | 低 |
| 右键菜单 | 复制/粘贴/删除/图层/组合 | 中 |

### P1 - 增强编辑能力（应该做）

| 功能 | 说明 | 复杂度 |
|---|---|---|
| 辅助线吸附 | 移动时显示参考线，松手吸附 | 中 |
| 标尺 | 画布边缘标尺 | 中 |
| 字体选择 | 自定义字体列表 | 中 |
| 行高/字间距 | 文字高级属性 | 低 |
| 下划线/删除线 | 文字样式 | 低 |
| 描边虚线样式 | 虚线/点线/点划线 | 低 |
| 圆角 | 矩形圆角参数 | 低 |
| 图片替换 | 保留样式替换图片 | 低 |
| 锁定/解锁 | 锁定后不可编辑 | 低 |
| 显示/隐藏 | 隐藏元素 | 低 |
| 画布背景 | 颜色 + 图片 | 低 |
| 拖拽添加 | 从侧栏拖到画布 | 中 |

### P2 - 高级功能（可以做）

| 功能 | 说明 | 复杂度 |
|---|---|---|
| 裁剪交互 | 可视化裁剪框 | 高 |
| 路径文字 | 文字沿路径排列 | 高 |
| 多边形编辑 | 编辑多边形顶点 | 高 |
| 二维码/条形码 | 生成二维码/条形码 | 中 |
| 水印 | 添加水印 | 低 |
| PSD 导入 | 解析 PSD 文件 | 高 |
| 模板系统 | 预设模板库 | 中 |

---

## 四、建议的实现顺序

### 第一批（1-2 周）：核心编辑能力
1. 撤销/重做（HistoryPlugin）
2. 图层列表（LayerPlugin）
3. 组合/取消组合（GroupPlugin）
4. 翻转（FlipPlugin）
5. 多元素对齐（GroupAlignPlugin）
6. 快捷键完善

### 第二批（1-2 周）：属性增强
7. 阴影属性面板
8. 渐变编辑器
9. 图片滤镜
10. 描边虚线样式
11. 圆角参数

### 第三批（1-2 周）：交互增强
12. 辅助线吸附
13. 标尺
14. 右键菜单
15. 拖拽添加
16. 图片裁剪

---

## 五、技术要点

### 5.1 参考 vue-fabric-editor 的插件架构
- 每个功能一个插件文件
- 插件通过 `static apis` 暴露 API
- 插件通过 `static events` 暴露事件
- 插件通过 `hotkeys` 注册快捷键
- 插件通过 `contextMenu` 注册右键菜单

### 5.2 属性面板组件化
- 每种属性一个独立组件
- 通过 `selectOne` / `selectMulti` 事件切换显示
- 属性变更实时同步到 fabric.js 对象

### 5.3 状态管理
- 使用 Vue 3 的 `reactive` + `ref`
- 监听 fabric.js 的 `selection:created` / `selection:updated` / `selection:cleared`
- 监听 `object:modified` 实时更新属性面板
