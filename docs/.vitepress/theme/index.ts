import DefaultTheme from 'vitepress/theme'
import SvgDiagram from './components/SvgDiagram.vue'
import SvgEditor from './components/SvgEditor.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('SvgDiagram', SvgDiagram)
    app.component('SvgEditor', SvgEditor)
  }
}
