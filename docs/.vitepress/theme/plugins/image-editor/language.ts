import { createI18n } from 'vue-i18n'
import zh from './language/zh.json'
import en from './language/en.json'

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'en-US',
  messages: {
    'zh-CN': zh,
    'en-US': en,
  },
})

export default i18n
