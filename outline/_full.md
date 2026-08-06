# Java 知识体系大纲（优化版）

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

**设计原则：**
- 每卷只回答一个核心问题，不越界
- 同一主题只在一个卷中深入展开，其他卷引用即可
- 面向中级开发者，略过编译器/语言理论层面的过度铺垫

---

## 各卷定位与边界

**第一卷《Java 语言》**——回答"Java 为什么这样设计"。围绕类型系统、面向对象、泛型、注解、Lambda 展开。不是语法教学，而是理解 Java 的设计思想与抽象能力。共 4 章。

**第二卷《JVM Runtime》**——回答"一行代码如何被 JVM 执行"。覆盖字节码与类加载、内存模型、对象布局、GC、JIT、线上排查。共 6 章。

**第三卷《Java 并发》**——回答"多线程如何正确、高效地共享资源"。按 竞争本质 → 线程 → 线程封闭 → JMM → volatile → synchronized → CAS → AQS → 并发集合 → 线程池 → 异步编程 → 虚拟线程 → 诊断 组织。共 13 章。

**第四卷《Java 网络与通信》**——回答"数据如何从一个 JVM 到另一个 JVM"。覆盖 TCP/IP → Socket → NIO → Netty → HTTP → Servlet/Spring MVC → RPC → 长连接。共 10 章。

**第五卷《Java 数据访问与持久化》**——回答"Java 对象如何可靠持久化"。核心链路：JDBC → ORM → SQL → 事务 → 数据库。**只覆盖持久化**，缓存和 MQ 不在本卷范围。共 7 章。

**第六卷《Java 企业架构》**——回答"如何把底层能力组合成企业级系统"。以 Spring 为媒介，覆盖 IoC/AOP/MVC/Boot → ORM 整合 → 微服务 → 治理 → 安全 → 部署与可观测性。共 9 章。

**第七卷《性能与架构》**——回答"系统如何在高并发大规模场景下持续演进"。覆盖架构思想 → DDD → 高并发/高可用 → 分布式核心问题 → 数据架构（缓存/分库分表/MQ）→ 性能工程 → 综合案例。共 9 章。

---

## 主题归属原则（避免卷间重叠）

| 主题 | 归属卷 | 说明 |
|------|--------|------|
| 类型擦除、泛型原理 | 第一卷 | 语言层设计 |
| Class 文件结构、字节码 | 第二卷 | 运行时层 |
| Mark Word、锁状态、Monitor | 第二卷 | 对象模型 |
| synchronized、AQS、线程池 | 第三卷 | 并发层 |
| TCP、NIO、Netty、HTTP | 第四卷 | 网络层 |
| JDBC、MyBatis、Hibernate、SQL、事务 | 第五卷 | 持久化层 |
| **Redis/缓存体系** | **第七卷** | 数据架构（非持久化） |
| **MQ/消息驱动** | **第七卷** | 服务间通信架构 |
| **分库分表** | **第七卷** | 大规模数据架构 |
| **分布式事务（TCC/Saga）** | **第七卷** | 跨服务一致性 |
| Spring IoC/AOP/MVC/Boot | 第六卷 | 企业框架 |
| 微服务治理（限流/熔断/链路追踪） | 第六卷 | 企业治理 |
| Docker/K8s/部署/可观测性 | 第六卷 | 企业工程实践 |
| DDD、高并发架构、高可用架构 | 第七卷 | 系统设计 |
| 性能工程（JVM 调优/压测/Profiling） | 第七卷 | 综合能力 |

---

## 章节目录总览

### 第一卷 Java 语言（4 章）

1. **Java 基础与类型系统**（合并原设计哲学 + 类型系统）
   - Java 设计目标与核心理念
   - 基本类型与引用类型
   - 对象模型：引用 vs 对象
   - equals / hashCode / identity
   - String 与不可变对象
   - 类型转换与编译期检查

2. **面向对象**
   - 封装、继承、多态的本质
   - 接口 vs 抽象类
   - SOLID 原则
   - 组合优于继承

3. **泛型**
   - 为什么需要泛型：从 Object 到类型安全
   - 类型擦除：为什么运行时看不到泛型
   - 通配符与 PECS
   - 桥接方法与 Signature
   - 泛型在框架中的应用

4. **注解与 Lambda**
   - 注解：元数据驱动编程（生命周期 / APT / Spring 利用注解）
   - Lambda：行为抽象（函数式接口 / Stream / Optional / invokedynamic）

### 第二卷 JVM Runtime（6 章）

1. **字节码与类加载**
   - Class 文件结构概览（不要逐字段展开）
   - 字节码指令分类认知
   - 类加载生命周期与双亲委派
   - 打破双亲委派：SPI、Tomcat、OSGi

2. **JVM 内存模型**
   - 堆 / 栈 / 方法区 / Metaspace
   - 栈帧结构
   - StringTable

3. **对象模型**
   - 对象创建流程
   - 对象内存布局与 Mark Word
   - TLAB 与逃逸分析
   - 锁状态与对象头（连接第三卷 synchronized）

4. **垃圾回收**
   - 可达性分析与四种引用
   - 分代收集思想
   - 收集器演进：CMS → G1 → ZGC
   - 核心 GC 参数

5. **JIT 编译**
   - 解释器 / C1 / C2 分工
   - 方法内联（最重要的优化）
   - 逃逸分析的三种优化
   - 去优化

6. **线上排查与诊断**
   - OOM / CPU 100% / Full GC 诊断流程
   - Heap Dump 与 MAT
   - Thread Dump 分析
   - Arthas 核心命令
   - JVM 核心参数速查

### 第三卷 Java 并发（13 章）

1. **并发的本质：从竞争到协作**
   - 单核到多核的必然
   - 并发（Concurrency）与并行（Parallelism）的界线
   - 三种竞争：共享可变状态 / 资源竞争 / 时序依赖
   - Java 并发的两条主线：同步（Synchronization）与协调（Coordination）

2. **线程：Java 的执行单元**
   - 进程与线程：资源与执行的分离
   - Java Thread 与 OS Thread：1:1 模型的代价
   - 线程六种状态与真实触发条件
   - 创建方式演进：`Thread` → `Runnable`
   - 中断（Interruption）：优雅停止的唯一路径

3. **线程封闭：`ThreadLocal` 与无共享编程**
   - 共享 vs 封闭：应对竞争的两条路
   - `Thread.threadLocals` 与 `ThreadLocalMap` 存储结构
   - 弱引用 + 线性探测：内存泄漏与 `remove()` 的必要性
   - `InheritableThreadLocal` 与父子线程传递
   - 线程池场景的失效与 `TransmittableThreadLocal`

4. **Java 内存模型（JMM）：并发的理论骨架**
   - 硬件视角：CPU 缓存、写缓冲、指令重排
   - JMM 作为规范，不是内存布局
   - 三大问题：原子性 / 可见性 / 有序性
   - happens-before：JMM 的语义合约
   - `final` 的特殊语义与安全发布

5. **`volatile`：最轻的同步**
   - 可见性与有序性的两条保证
   - 内存屏障：`LoadLoad` / `LoadStore` / `StoreLoad` / `StoreStore`
   - DCL 单例为什么必须加 `volatile`
   - `volatile` 与 `Atomic` 的分工

6. **`synchronized`：JVM 内置锁**
   - 三种加锁位置
   - `monitorenter` / `monitorexit` 的字节码视角
   - 与对象头 Mark Word 的连接（引用第二卷）
   - 锁升级：无锁 → 轻量级 → 重量级（偏向锁作为历史注解）
   - `wait` / `notify`：Monitor 的协作原语
   - 三个常见误用

7. **CAS 与原子类：无锁的起点**
   - CAS 指令：`cmpxchg` 与总线锁
   - Java 层入口：`Unsafe` 与 `VarHandle`
   - 三大问题：ABA / 自旋消耗 / 单变量限制
   - `Atomic` 家族：从 `AtomicLong` 到 `LongAdder` 的分段思想
   - CAS vs `synchronized`：竞争强度决定选型

8. **`LockSupport` 与 AQS：并发工具的骨架**
   - `LockSupport.park` / `unpark`：许可证式挂起
   - AQS 三件套：`state` / CLH 队列 / Node 状态机
   - 独占模式与共享模式的两条 `acquire` 路径
   - `Condition`：AQS 内部的等待队列
   - 基于 AQS 的工具矩阵：`ReentrantLock` / `ReadWriteLock` / `StampedLock` / `Semaphore` / `CountDownLatch` / `CyclicBarrier`
   - `Lock` vs `synchronized` 的三维对比

9. **并发集合：为并发重新设计的数据结构**
   - 普通集合的失败模式（`ArrayList` 越界 / `HashMap` 环形链表 / `size++` 丢失）
   - `ConcurrentHashMap`：从分段锁（JDK 7）到桶锁（JDK 8）
   - `CopyOnWriteArrayList` / `CopyOnWriteArraySet`：读无锁的代价
   - `BlockingQueue` 家族
   - `ConcurrentLinkedQueue`：Michael-Scott 无锁队列速览

10. **线程池：任务调度的核心引擎**
    - 无节制创建线程的三个代价
    - `ThreadPoolExecutor` 七参数的耦合关系
    - 任务流转的完整状态机
    - 四种拒绝策略
    - `LinkedBlockingQueue` 默认无界的陷阱
    - `ScheduledThreadPoolExecutor`：定时任务底座
    - `ForkJoinPool` 与工作窃取
    - 参数配置方法论：CPU 密集 / IO 密集 / 混合负载

11. **异步编程：从 `Future` 到 `CompletableFuture`**
    - `Future` 的三个致命局限
    - `CompletableFuture` 的两组 API：转换与合并
    - 执行线程之谜：`ForkJoinPool.commonPool` 与自定义 Executor
    - 异常传播：`exceptionally` / `handle` / `whenComplete` 的差异
    - 常见反模式
    - 其他并发范式速览：响应式（详见第四卷）、Actor 模型

12. **虚拟线程与结构化并发（JDK 21）**
    - 平台线程的规模瓶颈
    - 虚拟线程：M:N 调度与 `continuation`
    - 挂载与卸载：`synchronized` 的钉住（pinning）问题
    - 何时不要用虚拟线程
    - 结构化并发：`StructuredTaskScope` 与生命周期绑定
    - `newVirtualThreadPerTaskExecutor` 与传统线程池的关系重估

13. **并发问题诊断与性能调优**
    - 死锁 / 活锁 / 饥饿的代码模式识别
    - Thread Dump 的并发视角（通用方法引用第二卷）
    - 锁竞争定位：JFR 的 `JavaMonitorEnter`、`async-profiler` lock 模式
    - 伪共享（False Sharing）与 `@Contended`
    - 上下文切换成本：`vmstat` / `pidstat` 解读
    - 并发优化的四个方向：缩小锁粒度 / 无锁替代 / 读写分离 / 异步化

### 第四卷 Java 网络与通信（10 章，不调整）

1. 网络通信基础
2. TCP/IP
3. Java Socket 编程
4. Java NIO
5. Netty
6. HTTP 协议
7. Java Web 通信模型：Servlet 到 Spring MVC
8. RPC 与微服务通信
9. 长连接与实时通信
10. 网络性能分析与故障排查

### 第五卷 Java 数据访问与持久化（7 章）

1. 持久化思想
2. JDBC
3. MyBatis
4. ORM 深入（MyBatis vs Hibernate/JPA）
5. 数据库核心原理（索引 / 慢 SQL / 锁 / 事务隔离级别）
6. Spring 事务管理
7. 数据访问性能优化（连接池 / 批处理 / 链路分析 / 常见问题排查）

> **与原版变化：** 删除"Redis 与 Java 缓存体系"整节（移至第七卷），删除所有 MQ 相关提及。本卷只聚焦"Java 对象 → ORM → SQL → 事务 → 数据库"这条纯粹的持久化链路。

### 第六卷 Java 企业架构（9 章）

1. **企业开发演进与 Spring 核心思想**（合并原第 1+2 章）
   - 从单体到微服务的演进驱动力
   - 为什么需要 IoC
   - Bean 生命周期与 ApplicationContext
   - 依赖注入方式

2. **Spring 容器机制与 AOP**（合并原第 3+4 章）
   - BeanDefinition 与启动流程
   - 循环依赖与三级缓存
   - AOP 核心概念与动态代理
   - AOP 的边界

3. **Spring MVC**
   - DispatcherServlet 核心流程
   - 参数解析与返回值处理
   - 异常处理

4. **Spring Boot**
   - 自动配置原理
   - Starter 机制
   - 配置体系

5. **Spring 整合数据访问**
   - @MapperScan 原理
   - SqlSessionTemplate 线程安全与事务联动
   - 一级缓存"失效"的真相

6. **微服务架构**
   - 服务注册与发现
   - API Gateway
   - 服务调用（OpenFeign / Dubbo / gRPC）

7. **分布式系统治理**
   - 配置中心
   - 服务容错（超时 / 重试 / 熔断）
   - 限流与降级
   - 分布式链路追踪

8. **企业系统安全与部署**（合并原第 10+11 章）
   - 认证与授权（Session-Cookie / JWT / OAuth 2.0 / Spring Security）
   - 权限模型（RBAC / ABAC）
   - 数据安全
   - Docker 容器化
   - Kubernetes 基础
   - 多环境配置管理

9. **可观测性**
   - 日志体系（Logback → Filebeat → ES → Kibana）
   - 指标监控（Micrometer → Prometheus → Grafana）
   - 链路追踪（OpenTelemetry / SkyWalking）
   - 线上问题定位方法论

### 第七卷 性能与架构（9 章）

1. **架构思想与分层设计**
   - 架构本质：约束下的结构选择
   - 架构演进：单体 → SOA → 微服务 → 云原生
   - 分层架构 / 六边形架构 / Clean Architecture
   - 模块边界设计

2. **领域驱动设计（DDD）**
   - 为什么传统 CRUD 在复杂系统中失效
   - 核心概念：Entity / Value Object / Aggregate / Bounded Context
   - 领域建模过程
   - 战术设计：Repository / Domain Service / Application Service

3. **高并发系统设计**
   - 高并发本质：资源竞争
   - 流量模型（QPS / TPS / RT / 并发数）
   - 水平扩展与无状态设计
   - 经典架构：CDN → Gateway → Service → Cache → Database

4. **高可用系统设计**
   - 可用性量化（99.9% → 99.99% → 99.999%）
   - 消除单点故障
   - 冗余、隔离、降级

5. **分布式系统核心问题**
   - CAP 理论与一致性模型
   - 分布式事务：2PC / TCC / Saga
   - 分布式锁：Redis / ZooKeeper / 数据库方案

6. **数据架构：缓存与大规模数据**（合并原 Redis + 分库分表 + 数据一致性）
   - Java 缓存体系：客户端（Jedis/Lettuce/Redisson）+ Spring Cache
   - 缓存一致性策略：Cache Aside / Read-Write Through / 延迟双删
   - 三大经典问题：穿透 / 击穿 / 雪崩
   - 分库分表设计（分片键 / 路由 / 扩容）
   - 数据冷热分离
   - 多数据源一致性（MySQL + Redis + ES）

7. **消息驱动架构**
   - 同步链路的局限与异步解耦
   - 事件驱动设计
   - Kafka 的角色与使用场景
   - 消息可靠性（持久化 / ACK / 幂等消费 / 死信队列）

8. **性能工程**
   - 性能指标体系（Latency / Throughput / Error Rate / Saturation）
   - 分析方法：Profiling / Benchmark / 压测
   - JVM 性能诊断实战（连接第二卷）
   - 优化方法论：监控 → 定位 → 假设 → 验证

9. **架构案例分析**
   - 高并发秒杀系统
   - 社交 Feed 流系统
   - 支付系统

---

## 全书统计

| 卷 | 章数 | 变化 |
|----|------|------|
| 第一卷 Java 语言 | 4 | 6→4（-2） |
| 第二卷 JVM Runtime | 6 | 8→6（-2） |
| 第三卷 并发 | 13 | 11→13（+2，拆出 ThreadLocal 与虚拟线程） |
| 第四卷 网络 | 10 | 不变 |
| 第五卷 数据访问 | 7 | 8→7（-1，剥离缓存） |
| 第六卷 企业架构 | 9 | 12→9（-3） |
| 第七卷 性能与架构 | 9 | 12→9（-3） |
| **合计** | **58** | **65→58（-7）** |
