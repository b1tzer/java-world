# Java World

从语言到架构的 Java 完整知识体系。七卷五十六章，构建后端工程师的完整能力栈。

**📖 在线阅读：[https://thestack.xpro.wang/java-world/](https://thestack.xpro.wang/java-world/)**

## 内容结构

全书按能力递进编排，每一卷回答一个核心问题：

```
第七卷 性能与架构    → 系统如何演进？
第六卷 企业架构      → 底层能力如何组合？
第五卷 数据访问      → 数据如何持久化？
第四卷 网络与通信    → 数据如何传输？
第三卷 Java 并发     → 多线程如何协作？
第二卷 JVM Runtime   → 代码如何执行？
第一卷 Java 语言     → 代码如何表达？
```

| 卷 | 主题 | 章数 |
|----|------|------|
| 第一卷 | Java 语言 — 类型系统、面向对象、泛型、注解与 Lambda | 4 |
| 第二卷 | JVM Runtime — 字节码、类加载、内存模型、GC、JIT、线上排查 | 6 |
| 第三卷 | Java 并发 — JMM、volatile、synchronized、AQS、线程池、异步编程 | 11 |
| 第四卷 | 网络与通信 — TCP/IP、NIO、Netty、HTTP、Servlet、RPC | 10 |
| 第五卷 | 数据访问 — JDBC、MyBatis、ORM、数据库原理、Spring 事务 | 7 |
| 第六卷 | 企业架构 — Spring IoC/AOP/MVC/Boot、微服务、治理、安全 | 9 |
| 第七卷 | 性能与架构 — 架构思想、DDD、高并发/高可用、分布式、性能工程 | 9 |

## 技术栈

- [VitePress](https://vitepress.dev/) 1.6 — 静态站点生成器
- GitHub Actions + GitHub Pages — 自动部署

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建静态站点
npm run build

# 预览构建产物
npm run preview
```

## 项目结构

```
docs/                        # VitePress 源目录
├── .vitepress/config.mts    # 站点配置
├── 01-java-language/        # 第一卷（index.md + 4 章）
├── 02-jvm-runtime/          # 第二卷（index.md + 6 章）
├── 03-java-concurrency/     # 第三卷（index.md + 11 章）
├── 04-java-network/         # 第四卷（index.md + 10 章）
├── 05-java-data-access/     # 第五卷（index.md + 7 章）
├── 06-java-enterprise/      # 第六卷（index.md + 9 章）
├── 07-performance-architecture/ # 第七卷（index.md + 9 章）
└── index.md                 # 首页
```

## 部署

推送到 `main` 分支后，GitHub Actions 自动构建并部署到 GitHub Pages。

## 致谢

本书内容由 [MiMo](https://github.com/XiaomiMiMo) 协助生成。MiMo 是小米开源的推理模型，在长文写作与技术内容组织方面提供了重要帮助。

## License

MIT
