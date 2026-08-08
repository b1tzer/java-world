import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'
import fs from 'fs'
import path from 'path'

export default withMermaid(
  defineConfig({
  title: 'Java World',
  description: '从语言到架构的 Java 完整知识体系',
  lang: 'zh-CN',
  base: '/java-world/',
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
  ],

  vite: {
    plugins: [
      {
        name: 'svg-save-api',
        configureServer(server) {
          server.middlewares.use('/__svg-save__', (req, res, next) => {
            if (req.method !== 'POST') return next()
            let body = ''
            req.on('data', chunk => body += chunk)
            req.on('end', () => {
              try {
                const { path: svgPath, content } = JSON.parse(body)
                // 安全检查：只允许写入 public/diagrams/ 下的 .svg 文件
                const diagramsDir = path.resolve(__dirname, '../public/diagrams')
                const fullPath = path.resolve(__dirname, '../public', svgPath.replace(/^\//, ''))
                if (!fullPath.startsWith(diagramsDir) || !fullPath.endsWith('.svg')) {
                  res.statusCode = 403
                  res.end('Forbidden: only SVG files in public/diagrams/ are allowed')
                  return
                }
                fs.writeFileSync(fullPath, content, 'utf-8')
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ ok: true, file: fullPath }))
                console.log(`[svg-save] ${path.basename(fullPath)} saved`)
              } catch (e) {
                res.statusCode = 500
                res.end(e.message)
              }
            })
          })
        }
      }
    ]
  },

  themeConfig: {
    siteTitle: 'Java World',
    logo: '/java-world/logo.svg',

    nav: [
      { text: '首页', link: '/' },
      { text: '开始阅读', link: '/01-java-language/' },
      {
        text: '卷一 · Java 语言',
        items: [
          { text: '类型系统', link: '/01-java-language/chapter-01-type-system' },
          { text: '面向对象', link: '/01-java-language/chapter-02-oop' },
          { text: '泛型', link: '/01-java-language/chapter-03-generics' },
          { text: '注解与 Lambda', link: '/01-java-language/chapter-04-annotation-lambda' },
        ]
      },
      {
        text: '卷二 · JVM Runtime',
        items: [
          { text: '字节码与类加载', link: '/02-jvm-runtime/chapter-01-bytecode-classloading' },
          { text: '内存模型', link: '/02-jvm-runtime/chapter-02-memory-model' },
          { text: '对象模型', link: '/02-jvm-runtime/chapter-03-object-model' },
          { text: 'GC', link: '/02-jvm-runtime/chapter-04-gc' },
          { text: 'JIT', link: '/02-jvm-runtime/chapter-05-jit' },
          { text: '线上排查', link: '/02-jvm-runtime/chapter-06-diagnostics' },
        ]
      },
      {
        text: '卷三 · 并发',
        items: [
          { text: '线程模型', link: '/03-java-concurrency/chapter-02-thread-model' },
          { text: 'JMM', link: '/03-java-concurrency/chapter-04-jmm' },
          { text: 'synchronized', link: '/03-java-concurrency/chapter-06-synchronized' },
          { text: '线程池', link: '/03-java-concurrency/chapter-10-thread-pool' },
          { text: '虚拟线程', link: '/03-java-concurrency/chapter-12-virtual-thread' },
        ]
      },
      {
        text: '更多',
        items: [
          { text: '卷四 · 网络', link: '/04-java-network/' },
          { text: '卷五 · 数据访问', link: '/05-java-data-access/' },
          { text: '卷六 · 企业架构', link: '/06-java-enterprise/' },
          { text: '卷七 · 性能与架构', link: '/07-performance-architecture/' },
        ]
      },
    ],

    sidebar: {
      '/01-java-language/': [
        {
          text: '第一卷 · Java 语言',
          items: [
            { text: '总览', link: '/01-java-language/' },
            { text: '第一章 类型系统', link: '/01-java-language/chapter-01-type-system' },
            { text: '第二章 面向对象', link: '/01-java-language/chapter-02-oop' },
            { text: '第三章 泛型', link: '/01-java-language/chapter-03-generics' },
            { text: '第四章 注解与 Lambda', link: '/01-java-language/chapter-04-annotation-lambda' },
          ]
        }
      ],
      '/02-jvm-runtime/': [
        {
          text: '第二卷 · JVM Runtime',
          items: [
            { text: '总览', link: '/02-jvm-runtime/' },
            { text: '第一章 字节码与类加载', link: '/02-jvm-runtime/chapter-01-bytecode-classloading' },
            { text: '第二章 内存模型', link: '/02-jvm-runtime/chapter-02-memory-model' },
            { text: '第三章 对象模型', link: '/02-jvm-runtime/chapter-03-object-model' },
            { text: '第四章 GC', link: '/02-jvm-runtime/chapter-04-gc' },
            { text: '第五章 JIT', link: '/02-jvm-runtime/chapter-05-jit' },
            { text: '第六章 线上排查', link: '/02-jvm-runtime/chapter-06-diagnostics' },
          ]
        }
      ],
      '/03-java-concurrency/': [
        {
          text: '第三卷 · Java 并发',
          items: [
            { text: '总览', link: '/03-java-concurrency/' },
            { text: '第一章 为什么需要并发', link: '/03-java-concurrency/chapter-01-why-concurrency' },
            { text: '第二章 线程模型', link: '/03-java-concurrency/chapter-02-thread-model' },
            { text: '第三章 ThreadLocal', link: '/03-java-concurrency/chapter-03-threadlocal' },
            { text: '第四章 JMM', link: '/03-java-concurrency/chapter-04-jmm' },
            { text: '第五章 volatile', link: '/03-java-concurrency/chapter-05-volatile' },
            { text: '第六章 synchronized', link: '/03-java-concurrency/chapter-06-synchronized' },
            { text: '第七章 CAS 与原子类', link: '/03-java-concurrency/chapter-07-cas-atomic' },
            { text: '第八章 LockSupport 与 AQS', link: '/03-java-concurrency/chapter-08-locksupport-aqs' },
            { text: '第九章 并发集合', link: '/03-java-concurrency/chapter-09-concurrent-collections' },
            { text: '第十章 线程池', link: '/03-java-concurrency/chapter-10-thread-pool' },
            { text: '第十一章 异步编程', link: '/03-java-concurrency/chapter-11-async-model' },
            { text: '第十二章 虚拟线程', link: '/03-java-concurrency/chapter-12-virtual-thread' },
            { text: '第十三章 并发排查', link: '/03-java-concurrency/chapter-13-diagnostics' },
          ]
        }
      ],
      '/04-java-network/': [
        {
          text: '第四卷 · 网络与通信',
          items: [
            { text: '总览', link: '/04-java-network/' },
            { text: '第一章 网络基础', link: '/04-java-network/chapter-01-network-basics' },
            { text: '第二章 TCP/IP', link: '/04-java-network/chapter-02-tcp-ip' },
            { text: '第三章 Socket', link: '/04-java-network/chapter-03-socket' },
            { text: '第四章 NIO', link: '/04-java-network/chapter-04-nio' },
            { text: '第五章 Netty', link: '/04-java-network/chapter-05-netty' },
            { text: '第六章 HTTP', link: '/04-java-network/chapter-06-http' },
            { text: '第七章 Servlet 与 Spring MVC', link: '/04-java-network/chapter-07-servlet-springmvc' },
            { text: '第八章 RPC', link: '/04-java-network/chapter-08-rpc' },
            { text: '第九章 长连接', link: '/04-java-network/chapter-09-long-connection' },
            { text: '第十章 网络排查', link: '/04-java-network/chapter-10-network-diagnostics' },
          ]
        }
      ],
      '/05-java-data-access/': [
        {
          text: '第五卷 · 数据访问',
          items: [
            { text: '总览', link: '/05-java-data-access/' },
            { text: '第一章 持久化思想', link: '/05-java-data-access/chapter-01-persistence-thought' },
            { text: '第二章 JDBC', link: '/05-java-data-access/chapter-02-jdbc' },
            { text: '第三章 MyBatis', link: '/05-java-data-access/chapter-03-mybatis' },
            { text: '第四章 ORM 深入', link: '/05-java-data-access/chapter-04-orm-deep' },
            { text: '第五章 数据库原理', link: '/05-java-data-access/chapter-05-db-principles' },
            { text: '第六章 Spring 事务', link: '/05-java-data-access/chapter-06-spring-transaction' },
            { text: '第七章 性能优化', link: '/05-java-data-access/chapter-07-performance' },
          ]
        }
      ],
      '/06-java-enterprise/': [
        {
          text: '第六卷 · 企业架构',
          items: [
            { text: '总览', link: '/06-java-enterprise/' },
            { text: '第一章 Spring Core', link: '/06-java-enterprise/chapter-01-spring-core' },
            { text: '第二章 容器与 AOP', link: '/06-java-enterprise/chapter-02-container-aop' },
            { text: '第三章 Spring MVC', link: '/06-java-enterprise/chapter-03-spring-mvc' },
            { text: '第四章 Spring Boot', link: '/06-java-enterprise/chapter-04-spring-boot' },
            { text: '第五章 数据集成', link: '/06-java-enterprise/chapter-05-data-integration' },
            { text: '第六章 微服务', link: '/06-java-enterprise/chapter-06-microservices' },
            { text: '第七章 治理', link: '/06-java-enterprise/chapter-07-governance' },
            { text: '第八章 安全与部署', link: '/06-java-enterprise/chapter-08-security-deploy' },
            { text: '第九章 可观测性', link: '/06-java-enterprise/chapter-09-observability' },
          ]
        }
      ],
      '/07-performance-architecture/': [
        {
          text: '第七卷 · 性能与架构',
          items: [
            { text: '总览', link: '/07-performance-architecture/' },
            { text: '第一章 架构思想', link: '/07-performance-architecture/chapter-01-architecture' },
            { text: '第二章 DDD', link: '/07-performance-architecture/chapter-02-ddd' },
            { text: '第三章 高并发', link: '/07-performance-architecture/chapter-03-high-concurrency' },
            { text: '第四章 高可用', link: '/07-performance-architecture/chapter-04-high-availability' },
            { text: '第五章 分布式', link: '/07-performance-architecture/chapter-05-distributed' },
            { text: '第六章 性能工程', link: '/07-performance-architecture/chapter-06-performance-engineering' },
            { text: '第七章 架构演进', link: '/07-performance-architecture/chapter-07-evolution' },
            { text: '第八章 工程效能', link: '/07-performance-architecture/chapter-08-engineering' },
            { text: '第九章 综合案例', link: '/07-performance-architecture/chapter-09-case-studies' },
          ]
        }
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/b1tzer/java-world' },
    ],

    footer: {
      message: 'Java World — 从语言到架构的完整知识体系',
      copyright: '© 2024 Java World'
    },

    search: {
      provider: 'local'
    },

    outline: {
      level: [2, 3],
      label: '页面导航'
    },

    lastUpdated: {
      text: '最后更新于',
    },

    docFooter: {
      prev: '上一篇',
      next: '下一篇'
    },
  }
}))
