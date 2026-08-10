import DefaultTheme from 'vitepress/theme'
import SvgDiagram from './components/SvgDiagram.vue'
import SvgEditor from './components/SvgEditor.vue'
import ViewUIPlus from 'view-ui-plus'
import 'view-ui-plus/dist/styles/viewuiplus.css'
import { i18n } from './components/editor/i18n.js'
import './custom.css'

const { Button, Icon, Tooltip, Divider, Row, Col, ButtonGroup } = ViewUIPlus

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.use(i18n)
    app.component('Button', Button)
    app.component('Icon', Icon)
    app.component('Tooltip', Tooltip)
    app.component('Divider', Divider)
    app.component('Row', Row)
    app.component('Col', Col)
    app.component('ButtonGroup', ButtonGroup)
    app.component('SvgDiagram', SvgDiagram)
    app.component('SvgEditor', SvgEditor)
  }
}
