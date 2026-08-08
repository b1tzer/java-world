import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openInEditor } from 'vitepress-plugin-open-in-editor'

const __dirname = dirname(fileURLToPath(import.meta.url))
const docsDir = resolve(__dirname, '..')
const SITE_BASE = '/java-world/'

// 一次实例化，导出三块能力给 VitePress 的不同扩展点使用。
const editorIntegration = openInEditor({
  docsDir,
  base: SITE_BASE,
  buttonText: '编辑此行',
})

export default withMermaid(
  defineConfig({
  title: 'Java World',
  description: '从语言到架构的 Java 完整知识体系',
  lang: 'zh-CN',
  base: SITE_BASE,
  lastUpdated: true,
  sitemap: {
    hostname: 'https://thestack.xpro.wang/java-world/',
  },

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/java-world/favicon.svg' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'Java World' }],
    ['meta', { property: 'og:description', content: '从语言到架构的 Java 完整知识体系 — 七卷五十八章' }],
    ['meta', { property: 'og:url', content: 'https://thestack.xpro.wang/java-world/' }],
    ['meta', { property: 'og:image', content: 'https://thestack.xpro.wang/java-world/logo.svg' }],
    ['meta', { name: 'twitter:card', content: 'summary' }],
    ['meta', { name: 'theme-color', content: '#2563eb' }],
    ['meta', { name: 'viewport', content: 'width=device-width,initial-scale=1' }],
    // open-in-editor 的样式与客户端脚本已由 vite 插件通过 transformIndexHtml 自动注入。
  ],

  themeConfig: {
    siteTitle: 'Java World',
    logo: '/java-world/logo.svg',

    nav: [
      { text: '首页', link: '/' },
      {
        text: '目录',
        items: [
          { text: '第一卷 Java 语言', link: '/01-java-language/' },
          { text: '第二卷 JVM Runtime', link: '/02-jvm-runtime/' },
          { text: '第三卷 Java 并发', link: '/03-java-concurrency/' },
          { text: '第四卷 网络与通信', link: '/04-java-network/' },
          { text: '第五卷 数据访问', link: '/05-java-data-access/' },
          { text: '第六卷 企业架构', link: '/06-java-enterprise/' },
          { text: '第七卷 性能与架构', link: '/07-performance-architecture/' },
        ]
      },
      { text: 'GitHub', link: 'https://github.com/b1tzer/java-world' },
    ],

    sidebar: [
      {
        text: '第一卷 Java 语言',
        collapsed: false,
        items: [
          { text: '类型系统', link: '/01-java-language/chapter-01-type-system' },
          { text: '面向对象', link: '/01-java-language/chapter-02-oop' },
          { text: '泛型', link: '/01-java-language/chapter-03-generics' },
          { text: '注解与 Lambda', link: '/01-java-language/chapter-04-annotation-lambda' },
        ]
      },
      {
        text: '第二卷 JVM Runtime',
        collapsed: false,
        items: [
          { text: '字节码与类加载', link: '/02-jvm-runtime/chapter-01-bytecode-classloading' },
          { text: 'JVM 运行时数据区', link: '/02-jvm-runtime/chapter-02-memory-model' },
          { text: '对象模型', link: '/02-jvm-runtime/chapter-03-object-model' },
          { text: '垃圾回收', link: '/02-jvm-runtime/chapter-04-gc' },
          { text: 'JIT 编译', link: '/02-jvm-runtime/chapter-05-jit' },
          { text: '线上排查与诊断', link: '/02-jvm-runtime/chapter-06-diagnostics' },
        ]
      },
      {
        text: '第三卷 Java 并发',
        collapsed: false,
        items: [
          { text: '并发的本质', link: '/03-java-concurrency/chapter-01-why-concurrency' },
          { text: '线程：Java 的执行单元', link: '/03-java-concurrency/chapter-02-thread-model' },
          { text: '线程封闭：ThreadLocal', link: '/03-java-concurrency/chapter-03-threadlocal' },
          { text: 'Java 内存模型（JMM）', link: '/03-java-concurrency/chapter-04-jmm' },
          { text: 'volatile', link: '/03-java-concurrency/chapter-05-volatile' },
          { text: 'synchronized', link: '/03-java-concurrency/chapter-06-synchronized' },
          { text: 'CAS 与原子类', link: '/03-java-concurrency/chapter-07-cas-atomic' },
          { text: 'LockSupport 与 AQS', link: '/03-java-concurrency/chapter-08-locksupport-aqs' },
          { text: '并发集合', link: '/03-java-concurrency/chapter-09-concurrent-collections' },
          { text: '线程池', link: '/03-java-concurrency/chapter-10-thread-pool' },
          { text: '异步编程', link: '/03-java-concurrency/chapter-11-async-model' },
          { text: '虚拟线程与结构化并发', link: '/03-java-concurrency/chapter-12-virtual-thread' },
          { text: '诊断与优化', link: '/03-java-concurrency/chapter-13-diagnostics' },
        ]
      },
      {
        text: '第四卷 网络与通信',
        collapsed: false,
        items: [
          { text: '网络通信基础', link: '/04-java-network/chapter-01-network-basics' },
          { text: 'TCP/IP', link: '/04-java-network/chapter-02-tcp-ip' },
          { text: 'Socket 编程', link: '/04-java-network/chapter-03-socket' },
          { text: 'Java NIO', link: '/04-java-network/chapter-04-nio' },
          { text: 'Netty', link: '/04-java-network/chapter-05-netty' },
          { text: 'HTTP 协议', link: '/04-java-network/chapter-06-http' },
          { text: 'Servlet 到 Spring MVC', link: '/04-java-network/chapter-07-servlet-springmvc' },
          { text: 'RPC 与微服务', link: '/04-java-network/chapter-08-rpc' },
          { text: '长连接与实时通信', link: '/04-java-network/chapter-09-long-connection' },
          { text: '网络诊断', link: '/04-java-network/chapter-10-network-diagnostics' },
        ]
      },
      {
        text: '第五卷 数据访问与持久化',
        collapsed: false,
        items: [
          { text: '持久化思想', link: '/05-java-data-access/chapter-01-persistence-thought' },
          { text: 'JDBC', link: '/05-java-data-access/chapter-02-jdbc' },
          { text: 'MyBatis', link: '/05-java-data-access/chapter-03-mybatis' },
          { text: 'ORM 深入', link: '/05-java-data-access/chapter-04-orm-deep' },
          { text: '数据库核心原理', link: '/05-java-data-access/chapter-05-db-principles' },
          { text: 'Spring 事务', link: '/05-java-data-access/chapter-06-spring-transaction' },
          { text: '性能优化', link: '/05-java-data-access/chapter-07-performance' },
        ]
      },
      {
        text: '第六卷 企业架构',
        collapsed: false,
        items: [
          { text: 'Spring 核心思想', link: '/06-java-enterprise/chapter-01-spring-core' },
          { text: '容器与 AOP', link: '/06-java-enterprise/chapter-02-container-aop' },
          { text: 'Spring MVC', link: '/06-java-enterprise/chapter-03-spring-mvc' },
          { text: 'Spring Boot', link: '/06-java-enterprise/chapter-04-spring-boot' },
          { text: '数据访问整合', link: '/06-java-enterprise/chapter-05-data-integration' },
          { text: '微服务架构', link: '/06-java-enterprise/chapter-06-microservices' },
          { text: '分布式治理', link: '/06-java-enterprise/chapter-07-governance' },
          { text: '安全与部署', link: '/06-java-enterprise/chapter-08-security-deploy' },
          { text: '可观测性', link: '/06-java-enterprise/chapter-09-observability' },
        ]
      },
      {
        text: '第七卷 性能与架构',
        collapsed: false,
        items: [
          { text: '架构思想', link: '/07-performance-architecture/chapter-01-architecture' },
          { text: '领域驱动设计', link: '/07-performance-architecture/chapter-02-ddd' },
          { text: '高并发设计', link: '/07-performance-architecture/chapter-03-high-concurrency' },
          { text: '高可用设计', link: '/07-performance-architecture/chapter-04-high-availability' },
          { text: '分布式系统', link: '/07-performance-architecture/chapter-05-distributed' },
          { text: '数据架构', link: '/07-performance-architecture/chapter-06-data-architecture' },
          { text: '消息驱动', link: '/07-performance-architecture/chapter-07-messaging' },
          { text: '性能工程', link: '/07-performance-architecture/chapter-08-performance' },
          { text: '架构案例', link: '/07-performance-architecture/chapter-09-case-studies' },
        ]
      },
    ],

    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索文档', buttonAriaLabel: '搜索' },
          modal: {
            noResultsText: '没有找到结果',
            resetButtonTitle: '清除查询',
            footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' }
          }
        }
      }
    },

    editLink: {
      pattern: editorIntegration.editLinkPattern,
      text: '在编辑器中打开源文件',
    },

    footer: {
      message: '基于 MIT 发布',
      copyright: '© 2026 Java World'
    },

    outline: { level: [2, 3], label: '本章目录' },
    docFooter: { prev: '上一章', next: '下一章' },
    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '菜单',
    darkModeSwitchLabel: '主题',

    socialLinks: [
      { icon: 'github', link: 'https://github.com/b1tzer/java-world' }
    ],
  },

  markdown: {
    lineNumbers: true,
    config(md) {
      editorIntegration.markdown(md)
    },
  },

  mermaid: {
    flowchart: {
      padding: 24,
    },
  },

  vite: {
    plugins: [editorIntegration.vite()],
  },
}))
