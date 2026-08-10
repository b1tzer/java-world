# 图片编辑器测试页面

## 自动识别测试

下面是标准 Markdown 图片语法，后缀为 `.editor.json`，会被自动渲染为可交互编辑器：

![架构图](./images/architecture.editor.json)

## 普通图片对比

下面是普通 PNG 图片，不会被干预：

![Logo](/logo.svg)

## 使用说明

在 Markdown 中使用标准图片语法即可：

```markdown
![架构图](./images/architecture.editor.json)
```

- `.editor.json` 结尾的文件会自动渲染为 fabric.js 编辑器
- 其他格式（.png、.jpg、.svg）正常渲染为 `<img>`
- 鼠标悬停显示浮动工具栏（缩放、全屏、下载）
- 支持明暗色主题自动切换
