import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Java World',
  description: '从语言到架构的 Java 完整知识体系',
  lang: 'zh-CN',

  // GitHub Pages 部署路径
  base: '/java-world/',

  head: [
    ['link', { rel: 'icon', href: '/java-world/favicon.ico' }],
  ],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'Java World',

    // 顶部导航
    nav: [
      { text: '首页', link: '/' },
      {
        text: '全书目录',
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

    // 侧边栏
    sidebar: {
      '/01-java-language/': [
        {
          text: '第一卷 Java 语言',
          collapsed: false,
          items: [
            { text: '类型系统', link: '/01-java-language/chapter-01-type-system' },
            { text: '面向对象', link: '/01-java-language/chapter-02-oop' },
            { text: '泛型', link: '/01-java-language/chapter-03-generics' },
            { text: '注解与 Lambda', link: '/01-java-language/chapter-04-annotation-lambda' },
          ]
        }
      ],
      '/02-jvm-runtime/': [
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
        }
      ],
      '/03-java-concurrency/': [
        {
          text: '第三卷 Java 并发',
          collapsed: false,
          items: [
            { text: '为什么需要并发', link: '/03-java-concurrency/chapter-01-why-concurrency' },
            { text: '线程模型', link: '/03-java-concurrency/chapter-02-thread-model' },
            { text: 'Java 内存模型', link: '/03-java-concurrency/chapter-03-jmm' },
            { text: 'volatile', link: '/03-java-concurrency/chapter-04-volatile' },
            { text: 'synchronized', link: '/03-java-concurrency/chapter-05-synchronized' },
            { text: 'Lock 与 AQS', link: '/03-java-concurrency/chapter-06-lock-aqs' },
            { text: '原子类与 CAS', link: '/03-java-concurrency/chapter-07-atomic-cas' },
            { text: '并发集合', link: '/03-java-concurrency/chapter-08-concurrent-collections' },
            { text: '线程池', link: '/03-java-concurrency/chapter-09-thread-pool' },
            { text: '异步编程', link: '/03-java-concurrency/chapter-10-async-model' },
            { text: '诊断与优化', link: '/03-java-concurrency/chapter-11-diagnostics' },
          ]
        }
      ],
      '/04-java-network/': [
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
        }
      ],
      '/05-java-data-access/': [
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
        }
      ],
      '/06-java-enterprise/': [
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
        }
      ],
      '/07-performance-architecture/': [
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
        }
      ],
    },

    // 全文搜索
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

    // 页脚
    footer: {
      message: '基于 MIT 发布',
      copyright: '© 2024 Java World'
    },

    // 大纲显示深度
    outline: { level: [2, 3], label: '本章目录' },

    // 上/下页导航
    docFooter: { prev: '上一章', next: '下一章' },

    // 社交链接
    socialLinks: [
      { icon: 'github', link: 'https://github.com/b1tzer/java-world' }
    ],

    // 搜索快捷键
    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '菜单',
    darkModeSwitchLabel: '主题',
  },

  // Markdown 配置
  markdown: {
    lineNumbers: true,
  },
})
