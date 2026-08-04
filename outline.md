# Java 知识体系大纲

以培养中级 Java 开发者、构建从语言到架构的完整能力栈为目标。全书共七卷，按能力递进顺序编排——每一卷回答一个核心问题，每一卷都是下一卷的基础。

---

## 能力递进路线

```
    第七卷 性能与架构（系统如何演进？）
                        ↑
    第六卷 企业架构（底层能力如何组合？）
              ↑
    第五卷 数据访问      第四卷 网络通信
   （数据如何持久化？）  （数据如何传输？）
              ↑               ↑
    第三卷 并发（多线程如何协作？）
                ↑
    第二卷 JVM Runtime（代码如何执行？）
                ↑
    第一卷 Java 语言（代码如何表达？）
```

下面简述各卷的定位与覆盖范围，详细章节见下文。

**第一卷《Java 语言》**——不是语法教学，而是围绕设计哲学、类型系统、面向对象、泛型、注解、Lambda 展开，回答"Java 为什么这样设计"。重点在语言本质：类型擦除、注解生命周期、`invokedynamic` 等编译器与运行时协作机制。

**第二卷《JVM Runtime》**——从 Class 文件到机器码的完整生命周期。覆盖字节码、类加载、内存模型、对象布局、GC、JIT 编译、线上排查。目标是建立"一行代码如何被 JVM 执行"的完整世界观。

**第三卷《Java 并发》**——按"问题产生 → 线程模型 → JMM → volatile → synchronized → AQS → CAS → 并发集合 → 线程池 → 异步编程 → 诊断优化"顺序组织。不是线程 API 教程，而是理解 Java 如何在多核计算机上正确高效运行。

**第四卷《Java 网络与通信》**——从网络本质（字节流跨机器传输）出发，覆盖 TCP/IP、Socket、BIO → NIO → Netty、HTTP/Servlet、RPC、长连接，最终落地到网络故障排查。

**第五卷《Java 数据访问与持久化》**——核心链路：**Java 对象 → ORM → SQL → 事务 → 数据库 → 缓存**。覆盖 JDBC、MyBatis、Hibernate/JPA、数据库原理、Spring 事务、Redis 缓存、性能优化。MQ 和 ES 不在本卷范围内（归属第七卷）。

**第六卷《Java 企业架构》**——以 Spring 为媒介，讲清企业应用的运行模型：IoC/DI → Bean 生命周期 → AOP → MVC → Spring Boot 自动装配 → ORM 集成 → 微服务 → 治理 → 安全 → 部署 → 可观测性。让读者能"理解为什么这样设计企业系统"。

**第七卷《性能与架构》**——把前六卷能力整合为系统设计能力。覆盖架构思想、分层设计、DDD、高并发与高可用、分布式一致性、分库分表、消息驱动、API 治理、云原生、性能工程，最终以三个综合案例完成全书闭环。

---

## 1. 第一卷：Java 语言（Language）

这一卷的目标不是讲语法，而是回答：**Java 为什么会这样设计？**

### 1.1 Java 的设计哲学

不是 Hello World，而是建立世界观——理解 Java 存在的根本理由：

- 为什么需要 JVM？
- 为什么跨平台？
- 为什么需要 GC？
- 为什么需要字节码？
- 为什么不是 C++？

### 1.2 类型系统（Type System）

核心问题是：**Java 到底如何表示一个对象？**

- 基本类型与引用类型
- 对象模型
- 包装类与自动装箱
- `equals` / `hashCode` / identity
- `String` 与不可变对象

### 1.3 面向对象

不是复述继承、封装、多态的概念，而是追问原因：

- 接口为什么存在？
- 抽象类为什么存在？
- 组合为什么优于继承？
- SOLID 与设计原则

### 1.4 泛型

很多人第一次真正理解编译器，就从这里开始：

- 为什么擦除？
- Signature 与桥接方法
- `checkcast`
- PECS 原则
- TypeToken 与反射恢复泛型
- 泛型与 JVM

### 1.5 注解

理解注解的生命周期与编译期/运行期处理机制：

- SOURCE / CLASS / RUNTIME
- Annotation Processor（APT）
- Spring 如何利用注解

### 1.6 Lambda 与函数式编程

这一章自然引出 JVM——`invokedynamic` 是语言演进与运行时协作的典型案例：

- 函数式接口
- Lambda 表达式
- MethodHandle
- `invokedynamic`
- Stream
- Optional

---

## 2. 第二卷：JVM Runtime

本卷是 Java 开发者的核心能力区，围绕**一行 Java 代码从源码到机器执行的完整生命周期**展开。

### 2.1 Class 文件与字节码

- ClassFile 结构：Magic、Version、Constant Pool、Attribute
- 字节码指令

### 2.2 类加载机制

- ClassLoader 与双亲委派
- 打破双亲委派：SPI、Tomcat、OSGi、Spring Boot Loader

### 2.3 JVM 内存模型

建立完整的内存世界观：

- Heap / Stack / Native
- Method Area 与 Metaspace
- StringTable 与 ConstantPool

### 2.4 对象

这是很多教程缺失的一章，专门覆盖对象的完整生命周期：

- 对象创建与对象布局
- Mark Word
- 压缩指针
- TLAB
- 逃逸分析
- 锁状态

### 2.5 垃圾回收（GC）

- GC Roots 与引用类型
- 年轻代 / 老年代
- CMS、G1、ZGC、Shenandoah

### 2.6 即时编译（JIT）

解释**为什么 Java 会越来越快**：

- 解释器 / C1 / C2
- OSR（栈上替换）
- 逃逸分析、锁消除、标量替换、内联
- Profile 预热

### 2.7 JVM 调优与线上排查

真正贴近开发实战：

- OOM、CPU 100%、Full GC 诊断
- Dump 与 MAT 分析
- Arthas
- JFR、JMC

---

## 3. 第三卷：Java 并发（Concurrency）

按"问题产生 → 线程模型 → JMM → 锁机制 → AQS → 工程实践"的顺序组织。本卷强依赖第二卷的 JVM 内存模型、对象布局、Monitor 和 JIT 知识。

### 3.1 为什么需要并发

- 从单核到多核：物理极限推动的必然
- 并发 vs 并行
- 并发带来的核心问题：数据竞争、不确定结果
- 并发体系全景图

### 3.2 Java 线程模型

- 线程是什么：进程 vs 线程
- Java Thread 的本质：1:1 映射到 OS 线程
- 创建方式的演进：`Thread` → `Runnable` → `Callable` → `CompletableFuture`
- 线程生命周期：NEW → RUNNABLE → BLOCKED/WAITING → TERMINATED

### 3.3 Java Memory Model（JMM）

这是并发编程的**理论核心**：

- 为什么需要 JMM：CPU 缓存 + 编译器优化导致的不一致
- 三大核心问题：原子性、可见性、有序性
- happens-before 规则：volatile 规则、锁规则、程序顺序规则、传递性
- 重排序与内存屏障

### 3.4 volatile：轻量级同步机制

- volatile 的两大保证：可见性 + 禁止特定重排序
- 底层实现：内存屏障 + MESI 缓存一致性协议
- 为什么不能保证 `i++`？——读-改-写非原子
- 经典应用：双重检查锁（DCL）中的 `volatile`

### 3.5 synchronized：Java 内置锁机制

- 三种使用形式：实例方法、静态方法、同步代码块
- 本质：`monitorenter` / `monitorexit` 指令 + Monitor
- 与对象头 Mark Word 的关联（连接第二卷对象模型）
- 锁升级：无锁 → 偏向锁 → 轻量级锁 → 重量级锁（JDK 15+ 默认关闭偏向锁）
- 性能演进：JDK 1.2 的重量级 → JDK 1.6 的锁优化 → JIT 锁消除/锁粗化

### 3.6 Lock 与 AQS：JUC 的核心框架

- `Lock` vs `synchronized`：可中断、超时、公平锁、多条件队列
- AQS 核心三元素：`state`（同步状态）+ CLH 队列（等待队列）+ Node（队列节点）
- AQS 获取/释放锁的完整流程
- 基于 AQS 的工具：`ReentrantLock`、`Semaphore`、`CountDownLatch`、`ReentrantReadWriteLock`

### 3.7 原子类与 CAS：无锁并发思想

- 为什么需要无锁：避免阻塞、上下文切换、死锁
- CAS 原理：Compare And Swap 一条 CPU 指令完成原子操作
- 底层支持：`Unsafe` / `VarHandle` → `cmpxchg` 指令
- CAS 的三大问题：ABA、自旋消耗、单变量限制
- Atomic 系列演进：`AtomicInteger` → `LongAdder`（分段累加）→ `LongAccumulator`

### 3.8 并发集合：高性能数据结构

- 普通集合为什么不安全：`ArrayList` 越界、`HashMap` 死循环
- `ConcurrentHashMap`：JDK 7 Segment 分段锁 → JDK 8 CAS + `synchronized` 桶级锁
- `CopyOnWriteArrayList`：读无锁、写时复制，适合读多写极少
- `BlockingQueue`：生产者-消费者基石，`ArrayBlockingQueue` / `LinkedBlockingQueue` / `SynchronousQueue`

### 3.9 线程池：任务调度与资源管理

- 为什么需要线程池：控制资源、复用线程、管理生命周期
- `ThreadPoolExecutor` 核心参数：`corePoolSize` / `maximumPoolSize` / `workQueue` / 拒绝策略
- 任务执行流程：核心线程 → 队列 → 扩容 → 拒绝
- 四种拒绝策略：Abort / CallerRuns / Discard / DiscardOldest
- 工程实践：线程命名、参数调优（CPU密集型 vs IO密集型）、线程隔离

### 3.10 并发编程模型：异步与响应式

- `CompletableFuture`：声明式异步组合（`thenApply` / `thenCompose` / `allOf`）
- 响应式编程思想：事件驱动、非阻塞、背压（Backpressure）
- Actor 模型：不共享状态，只传递消息，天然无锁

### 3.11 并发问题诊断与性能优化

- 常见问题：死锁、活锁、饥饿
- Thread Dump 分析（连接第二卷诊断工具）
- 优化策略：减少锁粒度、无锁设计、读写分离、批处理、异步化

---

## 4. 第四卷：Java 网络与通信

从网络通信的本质（字节流在计算机之间的传输）出发，按"网络基础 → 传输层 → Socket → I/O 模型演进 → 高性能框架 → 应用协议 → 企业通信"的顺序组织。

### 4.1 网络通信基础

- 为什么程序需要网络：从单机到分布式
- 网络通信的本质：发送 bytes，接收 bytes
- 网络分层模型：OSI 七层 vs TCP/IP 四层
- 数据封装旅程：Application Data → Segment → Packet → Frame

### 4.2 TCP/IP：可靠通信的基础

- TCP vs UDP：为什么需要可靠传输
- 三次握手与四次挥手：不只是背流程，理解"为什么"
- TCP 数据传输机制：序列号、ACK、重传、滑动窗口
- TCP 粘包与拆包：字节流 ≠ 消息协议，三种解决方案
- TCP 性能参数：Nagle、KeepAlive、TIME-WAIT

### 4.3 Java Socket 编程

- Socket 是什么：IP + Port，网络通信端点
- BIO 模型：一个连接一个线程，阻塞在读上
- BIO 为什么无法支撑高并发：内存、调度、上下文切换

### 4.4 Java NIO：高性能网络模型

- 为什么需要 NIO：从阻塞等待到事件通知
- 核心组件：Channel（双向通道）、Buffer（数据容器）、Selector（多路复用器）
- Reactor 模型：Event Loop + Selector → Channel → Handler
- NIO 的真实限制：编程复杂、epoll 空轮询 Bug

### 4.5 Netty：Java 高性能网络框架

- 为什么需要 Netty：封装 NIO 复杂性
- 核心架构：Bootstrap → EventLoopGroup → Channel → Pipeline → Handler
- EventLoop 线程模型：一个线程管理多个 Channel，无锁设计
- ChannelPipeline：责任链模式实现可扩展的请求处理
- ByteBuf：比 ByteBuffer 更好用的内存模型
- 编解码机制：彻底解决 TCP 粘包拆包

### 4.6 HTTP 协议：应用层通信标准

- HTTP 报文结构与方法语义
- 状态码体系（2xx/3xx/4xx/5xx）
- HTTP/1.1（Keep-Alive、Pipeline）→ HTTP/2（多路复用、二进制分帧）→ HTTP/3（QUIC）

### 4.7 Java Web 通信模型：Servlet 到 Spring MVC

- Servlet 网络模型：Connector → Container → Servlet
- Tomcat 网络架构
- Spring MVC 请求流程：DispatcherServlet → HandlerMapping → Controller → Response
- Web 框架如何隐藏网络复杂度

### 4.8 RPC 与微服务通信

- RPC vs HTTP：面向方法 vs 面向资源
- RPC 核心组成：代理 → 序列化 → 协议 → 传输
- 序列化机制对比：JSON、Protobuf、Hessian
- 服务发现与负载均衡

### 4.9 长连接与实时通信

- 短连接 vs 长连接
- WebSocket：全双工实时通信
- SSE：服务端事件推送
- IM 系统设计思想：在线状态、消息路由、心跳检测

### 4.10 网络性能分析与故障排查

- 常见网络问题：Timeout、Connection Refused、Connection Reset
- 抓包分析：tcpdump + Wireshark
- Java 网络诊断：netstat、jstack、Arthas
- 高并发网络优化：连接池、KeepAlive、I/O 模型选择、限流

---

## 5. 第五卷：Java 数据访问与持久化

核心链路：**Java 对象 → ORM → SQL → 事务 → 数据库 → 缓存**。回答数据访问每一层为什么这样设计、它们之间如何协作。

> MQ 与 ES 不在此卷范围：MQ 归属第七卷（核心问题是服务间通信）；ES 归属第七卷或作为附录。

### 5.1 持久化思想：Java 对象如何保存

- 内存对象的困境：JVM 退出对象消失，但业务数据必须持久
- 对象模型 vs 关系模型：Object-Relational Impedance Mismatch
- 持久化的三种层次：文件存储 → JDBC → ORM

### 5.2 JDBC：Java 数据访问的底层抽象

- 一套 API，操作所有关系数据库
- 核心接口：`DataSource`、`Connection`、`PreparedStatement`、`ResultSet`
- PreparedStatement 的两大价值：防注入 + 预编译性能
- JDBC 的三大性能瓶颈：连接创建慢、逐条插入慢、模板代码多

### 5.3 MyBatis：Java 世界里的 SQL 映射框架

- 设计哲学：**SQL 由你写，映射由我做**
- 核心流程：Mapper 代理 → SqlSession → Executor → JDBC
- Mapper 动态代理（连接第二卷反射、第六卷 AOP）
- 一级缓存（SqlSession）与二级缓存（Mapper 级别）
- 插件机制：基于责任链模式的 Interceptor

### 5.4 ORM 深入：对象与关系如何转换

- MyBatis vs Hibernate/JPA：SQL 中心 vs 对象中心
- Entity 生命周期：Transient → Persistent → Detached
- Lazy Loading：性能收益与 `LazyInitializationException` 陷阱
- N+1 查询问题：`JOIN FETCH` / `@BatchSize` 的解决思路

### 5.5 数据库核心原理（Java 开发者视角）

- SQL 执行流程：Parser → Optimizer → Executor
- B+Tree 索引原理：聚簇索引 vs 非聚簇索引（回表问题）
- 慢 SQL 分析：`EXPLAIN` 的 `type`、`key`、`rows`、`Extra`
- 数据库锁：行锁、乐观锁、悲观锁
- 事务隔离级别：脏读、不可重复读、幻读与对应的 MVCC 实现

### 5.6 Spring 事务管理：声明式事务的 Java 实现

- `@Transactional` 原理：AOP Proxy 拦截 → 开启事务 → 执行业务 → commit/rollback
- 事务传播机制：`REQUIRED` / `REQUIRES_NEW` / `NESTED`
- 事务失效五大场景：同类调用、非 public、异常被 catch、MyISAM、多线程

### 5.7 Redis 与 Java 缓存体系

> 重点：**Java 应用如何使用缓存**，不展开 Redis 集群架构

- Java 客户端演进：Jedis → Lettuce（Spring Boot 2.x 默认） → Redisson
- Spring Cache 抽象：`@Cacheable` / `@CacheEvict` / `@CachePut`
- 缓存一致性：Cache Aside、Read/Write Through、延迟双删
- 三大经典问题：穿透（布隆过滤器）、击穿（互斥锁）、雪崩（过期随机化）
- 分布式能力：分布式锁（`SET NX EX`）、分布式计数器

### 5.8 数据访问性能优化

- 连接池（HikariCP）：核心参数与连接泄漏检测
- 批处理：合并网络往返，吞吐量提升 10~100 倍
- 链路分析：Controller → Service → DAO → Database/Redis
- 排雷：慢查询（EXPLAIN）、连接耗尽、数据库雪崩、死锁

---

## 6. 第六卷：Java 企业架构

讲清如何用 Spring 生态把语言、运行时、网络、数据这些底层能力组合成可设计、可启动、可组织、可扩展、可治理的企业级系统。

### 6.1 企业级 Java 应用的发展演进

- 从单机程序到企业系统：用户量 → 数据量 → 业务复杂度 → 必须拆分
- 企业系统的六大核心维度：对象管理、事务、安全、配置、部署、可观测性
- 从 Java EE（EJB）到 Spring 生态：为什么 Spring 赢了
- 现代技术栈全景：Framework → Boot → Cloud → 数据层 → 基础设施

### 6.2 Spring 核心思想：IoC 与依赖管理

- 为什么需要 IoC：从"我 new"到"容器管理"
- Bean 的本质：被 Spring 容器管理的对象
- Bean 完整生命周期：实例化 → 注入 → Aware 回调 → 初始化 → 就绪 → 销毁
- ApplicationContext vs BeanFactory
- 依赖注入的三种方式：构造器注入（首选）、Setter 注入、字段注入

### 6.3 Spring 容器源码机制

- Spring 启动全流程：BeanDefinition 扫描 → 注册 → 实例化 → 注入 → 初始化
- BeanDefinition：Spring 不直接保存对象，而是保存对象定义
- BeanFactory 创建对象的详细步骤
- 循环依赖与三级缓存：A↔B 的解决原理，构造器注入的局限

### 6.4 Spring AOP：面向切面编程

- 为什么需要 AOP：横切关注点（日志、权限、事务）的模块化管理
- 核心概念：Aspect、JoinPoint、Pointcut、Advice、Weaving
- 动态代理：JDK Proxy（接口代理） vs CGLIB（子类代理）
- AOP 实现机制：BeanPostProcessor → Proxy → Interceptor Chain → Target
- AOP 的边界：自调用失效、非 public 方法无效

### 6.5 Spring MVC：Web 请求处理模型

- Servlet 到 Spring MVC：Tomcat → DispatcherServlet → Controller
- DispatcherServlet 核心流程：HandlerMapping → HandlerAdapter → Controller → ViewResolver
- 参数解析机制：`HandlerMethodArgumentResolver`（`@RequestParam`、`@RequestBody`）
- 返回值处理与 `HttpMessageConverter`
- 异常处理：`@ExceptionHandler`、`@ControllerAdvice`

### 6.6 Spring Boot：约定优于配置

- 为什么需要 Spring Boot：简化配置、内嵌服务器、Actuator 监控
- 启动流程：`SpringApplication.run()` → Context → AutoConfiguration → 内嵌 Web 服务器
- 自动配置原理：`@ConditionalOnClass` + `@ConditionalOnMissingBean` + `@EnableConfigurationProperties`
- Starter 机制：一个 Starter = 依赖集合 + 自动配置类
- 配置体系：`application.yml`、`@ConfigurationProperties`、Profile 切换

### 6.7 Spring 整合数据访问框架

> 第五卷已讲清 MyBatis/Hibernate 本身的工作机制。第六卷只讲一件事：**Spring 容器如何整合它们**。

- 回顾：独立 MyBatis 的工作方式（Mapper → SqlSession → JDBC），以及三个整合核心问题：Mapper 谁创建？SqlSession 谁管理？事务谁协调？
- `@MapperScan`：利用 `ImportBeanDefinitionRegistrar` 扩展点，将 Mapper 接口注册为 `MapperFactoryBean` 的 BeanDefinition（连接 6.3 容器源码机制）
- `SqlSessionTemplate`：线程安全封装 + 事务感知（有活跃事务复用同一 SqlSession，无事务方法结束即关闭）
- 为什么 Spring 整合后一级缓存"失效"：无事务时每次查询新建 SqlSession——不是 bug，是设计选择
- `mybatis-spring-boot-starter` 自动配置：`MybatisAutoConfiguration` → 自动创建 SqlSessionFactory + SqlSessionTemplate + 自动扫描 Mapper
- 数据访问层设计：Controller → Service → Repository/DAO → Mapper，DIP 分层

### 6.8 微服务架构：从应用到系统

- 为什么需要微服务：部署耦合、扩展困难、技术栈锁定
- 核心原则：独立部署、独立扩展、数据独立、团队自治
- 服务注册与发现：Nacos / Eureka
- API Gateway：统一入口 + 路由 + 鉴权 + 限流
- 服务调用：OpenFeign（REST）、Dubbo（RPC）、gRPC（跨语言）

### 6.9 分布式系统治理

- 配置中心：集中管理 + 动态刷新（Nacos Config）
- 服务容错：超时、重试、熔断（Circuit Breaker）
- 限流与降级：Sentinel 的流量控制与系统保护
- 分布式链路追踪：TraceID + SpanID → SkyWalking / Jaeger

### 6.10 企业系统安全

- 身份认证：Session-Cookie、JWT、OAuth 2.0
- Spring Security 核心机制：Filter Chain → AuthenticationManager → SecurityContextHolder
- 权限模型：RBAC（基于角色）、ABAC（基于属性）
- 数据安全：HTTPS 传输加密、存储加密、日志脱敏、操作审计

### 6.11 企业应用部署与运行

- 打包方式：Fat Jar（内嵌 Tomcat） vs War（外部容器）
- Docker 容器化：Dockerfile → Image → Container
- Kubernetes 基础：Pod、Service、Deployment、ConfigMap
- 多环境配置管理：dev / test / staging / prod

### 6.12 企业系统可观测性

- 日志体系：Logback → Filebeat → ES → Kibana
- 指标监控：Micrometer → Prometheus → Grafana
- 链路追踪：OpenTelemetry → SkyWalking / Jaeger
- 线上问题定位：Metrics 发现 → Tracing 定位 → Logging 查看详情

---

## 7. 第七卷：性能与架构

把前六卷所有能力整合为系统设计能力。回答：系统为什么这样拆？如何保证高可用与高并发？如何权衡一致性、性能和成本？

### 7.1 软件系统架构思想：从代码到系统

- 代码设计 vs 架构设计：class 怎么组织 vs 系统怎么拆分与协作
- 架构存在的必要性：性能、可维护性、扩展性、稳定性
- 架构本质：在约束（用户规模、成本、团队、业务复杂度）下寻找合理结构
- 架构演进：单体 → 垂直拆分 → SOA → 微服务 → 云原生

### 7.2 分层架构与模块设计

- 为什么需要分层：控制依赖方向（Controller → Service → Repository）
- 六边形架构：Ports & Adapters，业务核心不依赖外部
- Clean Architecture：依赖只从外向内
- 模块边界：高内聚、低耦合、单一职责

### 7.3 领域驱动设计（DDD）

- 为什么传统 CRUD 在复杂系统中失效：业务规则散落在 Service 的 if/else 中
- 核心概念：Entity、Value Object、Aggregate、Aggregate Root
- 领域建模过程：业务分析 → 识别概念 → 划分 Bounded Context → 代码落地
- 战略设计：Bounded Context、Context Map
- 战术设计：Repository、Domain Service、Application Service

### 7.4 高并发系统设计

- 高并发本质：CPU、内存、I/O、数据库的资源竞争
- 流量模型：QPS、TPS、RT（P50/P99）、并发数
- 水平扩展 vs 垂直扩展：无状态是核心前提
- 经典架构：CDN → Gateway → Service → Cache → Database，逐层消峰

### 7.5 高可用系统设计

- 可用性量化：99.9%（年停机 8.76h）→ 99.99%（52min）→ 99.999%（5min）
- 消除单点故障（SPOF）
- 冗余设计：主备、集群、多副本
- 故障隔离：服务隔离、线程池隔离、舱壁模式
- 优雅降级：Fallback、熔断、降级策略

### 7.6 分布式系统核心问题

- 分布式复杂性的根源：网络不可靠
- CAP 理论：分区发生时，C 和 A 之间的取舍
- 一致性模型：强一致、弱一致、最终一致
- 分布式事务：2PC、TCC（Try-Confirm-Cancel）、Saga
- 分布式锁：Redis、ZooKeeper、数据库方案对比

### 7.7 大规模数据系统设计

- 数据增长路径：百万 → 千万 → 上亿，不拆分无法继续
- 分库分表三问：分片键选什么？如何路由？如何扩容？
- Elasticsearch 倒排索引应对全文检索
- 数据冷热分离：热数据（高性能）、温数据（普通库）、冷数据（归档）
- 数据一致性：双写 vs 异步同步（Canal） vs 最终一致 + 对账

### 7.8 消息驱动架构

- 同步链路的局限 → 异步解耦（MQ）
- 事件驱动：生产者发布事件，消费者订阅事件，互不相知
- Kafka 的角色：日志采集、数据同步、异步解耦、流计算
- 消息可靠性：持久化、消费者 ACK、幂等消费、死信队列

### 7.9 API 治理与服务设计

- REST 核心：面向资源，GET/POST/PUT/DELETE 的语义
- API 版本管理：URL 前缀或 Header
- 服务注册发现（Nacos/Eureka）
- 服务治理：限流（令牌桶/漏桶）、熔断（Resilience4j）、重试、降级
- 灰度发布：金丝雀、蓝绿部署、流量切分

### 7.10 云原生架构

- 演进：物理机 → 虚拟化 → 容器化 → Serverless
- Docker：Image（构建） + Container（运行），环境一致
- Kubernetes：Pod、Deployment、Service、ConfigMap/Secret
- Service Mesh（Istio）：将通信控制下沉到 Sidecar，服务无感知

### 7.11 系统性能工程

- 性能指标：Latency、Throughput、Error Rate、Saturation
- 分析方法：Profiling（Arthas/JProfiler）、Benchmark（JMH）、压测（JMeter/wrk）
- JVM 与系统性能连接：CPU 100% → Arthas `thread -n 3`；内存泄漏 → MAT；频繁 GC → `jstat`
- 优化方法论：监控发现问题 → 定位瓶颈 → 假设 → 改动 → 验证 → 持续监控

### 7.12 架构案例分析

全书能力的综合运用：

- **高并发秒杀系统**：网关限流 + Redis 预减库存（Lua）+ MQ 异步订单 + 分布式事务
- **社交 Feed 流**：大 V 拉取 / 普通用户推送 + 热点缓存 + 版本号同步 + 分片存储
- **支付系统**：TCC 保证一致性 + 全局交易号幂等 + 定时对账 + 安全审计