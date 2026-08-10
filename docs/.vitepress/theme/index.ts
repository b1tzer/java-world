import DefaultTheme from 'vitepress/theme'
import SvgDiagram from './components/SvgDiagram.vue'
import { createImageEditor } from './plugins/image-editor'
import './custom.css'

const imageEditor = createImageEditor({
  patterns: [/\.editor\.json$/, /\.fabric\.json$/],
  defaultMode: 'view',
  theme: 'auto',
})

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('SvgDiagram', SvgDiagram)
    imageEditor.install(app)
  },
  extendsMarkdown(md) {
    imageEditor.extendMarkdown(md)
  },
}
