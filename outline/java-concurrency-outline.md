# 第三卷 Java 并发 —— 多线程如何正确、高效地共享资源

> 一份代码在单线程下正确，在多线程下崩坏。这一卷讨论的就是这个断裂带：当多个执行流同时读写同一份数据时，Java 从硬件到语言、从 JVM 到工具类，用了哪些层次的机制来重新拼合"正确"与"高效"两个目标。

全卷共 13 章，遵循**问题产生 → 理论抽象 → 底层实现 → 工具封装 → 工程实践 → 新范式 → 诊断优化**的推进顺序。强依赖第二卷的 JVM 内存布局、对象头 Mark Word、Monitor 结构与 JIT 优化。

---

## 1 并发的本质：从竞争到协作

> 为什么单线程正确的 `count++`，多线程下会丢数据？为什么加了锁的代码有时反而变慢？

### 1.1 单核到多核：不是选择，是被迫

- 主频撞上物理墙，性能红利从纵向频率转向横向核数
- 从"跑得更快"到"同时跑得更多"的编程范式转变
- 三个真实动机：吞吐量、响应时间、硬件利用率

### 1.2 并发与并行的界线

| 维度 | 并发（Concurrency） | 并行（Parallelism） |
|---|---|---|
| 定义 | 多任务在时间上交替推进 | 多任务在同一时刻同时执行 |
| 关注点 | 任务调度与切换 | 硬件并行度 |
| 单核 | 可行 | 不可行 |
| 关键难题 | 数据竞争、协调 | 数据划分、负载均衡 |

### 1.3 三种竞争的本质

- **共享可变状态**：多个线程读写同一变量（`count++` 丢失更新）
- **资源竞争**：多个线程争夺同一有限资源（连接、文件句柄）
- **时序依赖**：一个线程的行为依赖另一个线程的进度（生产者-消费者）

三种竞争对应三类解法：**同步、限流、协调**。

### 1.4 Java 并发的两条主线

后续 12 章都是对这两条主线的展开：

```
                     Java 并发
                        │
       ┌────────────────┴────────────────┐
       ▼                                 ▼
  同步（Synchronization）         协调（Coordination）
  保证正确性                      保证生命周期与顺序
       │                                 │
  volatile / synchronized           wait/notify
  CAS / Lock / AQS                  Condition / Latch
  ConcurrentCollections             BlockingQueue / Barrier
```

---

## 2 线程：Java 的执行单元

> Java 线程和操作系统线程是什么关系？为什么线程池的核心线程数不能随便拍脑袋？

### 2.1 进程与线程：资源与执行的分离

- 进程：资源隔离的最小单位（独立地址空间）
- 线程：CPU 调度的最小单位（共享进程地址空间）
- 共享带来协作能力，也带来所有并发问题的根源

### 2.2 Java Thread 与 OS Thread 的映射

现代 HotSpot 采用 **1:1 模型**：

```
    Java Thread 对象
          │
          ▼
    Native Thread（OS 线程）
          │
          ▼
    OS Scheduler
          │
          ▼
         CPU
```

1:1 模型的代价：每条线程的 OS 资源开销约 1 MB 栈内存 + 内核调度成本，线程数量受 OS 限制。这条约束直接决定了后续为什么要有线程池，以及为什么要有虚拟线程（见第 12 章）。

### 2.3 六种线程状态与真实触发条件

| 状态 | 含义 | 典型触发 |
|---|---|---|
| NEW | 已创建，未 start | `new Thread()` |
| RUNNABLE | 可运行（含运行中与等 CPU） | `start()` |
| BLOCKED | 等待获取 Monitor 锁 | `synchronized` 竞争 |
| WAITING | 无限期等待 | `wait()` / `join()` / `LockSupport.park()` |
| TIMED_WAITING | 限时等待 | `sleep()` / `wait(t)` |
| TERMINATED | 执行完毕 | `run` 返回或异常 |

`BLOCKED` 与 `WAITING` 的差异是排查锁竞争问题的关键线索，见第 13 章。

### 2.4 创建方式的演进：`Thread` 与 `Runnable`

- `Thread`：继承限制，行为与执行单元耦合
- `Runnable`：接口分离，行为独立于线程
- `Callable` / `Future` / `CompletableFuture` 归入第 11 章"异步编程"，本章不引入

### 2.5 中断：优雅停止的唯一路径

- `Thread.stop()` 为什么被废弃：不释放锁 + 状态破坏
- `interrupt()` / `isInterrupted()` / `interrupted()` 的三态语义
- `InterruptedException` 的正确处理姿势
- 常见误用：`catch (InterruptedException e) { /* 吞掉 */ }`

---

## 3 线程封闭：`ThreadLocal` 与无共享编程

> 如果每个线程都有自己的一份数据，并发问题是不是就凭空消失了？

### 3.1 共享 vs 封闭：应对竞争的两条路

- 共享路径：加锁、CAS、屏障（后续章节展开）
- 封闭路径：每条线程持有独立副本，从源头消灭竞争
- 两条路的适用边界

### 3.2 `ThreadLocal` 的存储结构

关键澄清：`ThreadLocal` 不是"每个 ThreadLocal 存一份"，而是"每条线程存一份"。

```
Thread 对象
  └── threadLocals: ThreadLocalMap
                      │
              ┌───────┴────────┐
              ▼                ▼
        Entry[0]           Entry[1]  ...
        key = TL_A (弱引用)
        value = 用户对象 (强引用)
```

### 3.3 弱引用 + 线性探测：内存泄漏的机制

- key 是弱引用：`ThreadLocal` 对象被回收后，Entry 的 key 变为 null
- value 仍被 `Thread.threadLocals` 强引用：泄漏路径 `Thread → ThreadLocalMap → Entry → value`
- 线程池场景下线程长期存活，泄漏被放大
- `remove()` 的必要性：`❌ / ✅` 对照

### 3.4 `InheritableThreadLocal` 与父子线程传递

- `Thread.init` 中的 `inheritThreadLocals` 复制机制
- 只在**线程创建时**传递一次，无法追踪后续变更
- 在线程池下的失效原因

### 3.5 线程池场景下的失效与 `TransmittableThreadLocal`

- 线程池中线程被复用：`InheritableThreadLocal` 只在创建时传递，任务提交时不生效
- TTL 的思路：在任务提交时"抓拍"上下文，在执行时"回放"
- Spring Sleuth、SkyWalking、日志 MDC 的实际应用（引用第六卷）

---

## 4 Java 内存模型（JMM）：并发的理论骨架

> 线程 A 写了一个变量，线程 B 什么时候能看到？"什么时候"由谁决定？

### 4.1 硬件视角：一致性的物理成本

- CPU 缓存 L1/L2/L3 与主存的分层
- Store Buffer 与 Invalidate Queue 造成的写延迟
- 指令重排：编译器重排、CPU 乱序执行、Store-Load 屏障

如果没有 JMM，程序员需要面对不同 CPU 架构（x86 强内存序、ARM/POWER 弱内存序）的差异。

### 4.2 JMM 是抽象规范，不是内存布局

- JMM 定义"共享变量访问规则"，是编译器、JIT、CPU 都必须遵守的契约
- 与第二卷"JVM 内存结构"的严格区分（术语精确度）
- JSR-133 的历史与修订动机

### 4.3 三大核心问题

| 问题 | 定义 | 反例 |
|---|---|---|
| 原子性 | 操作不可分割 | `i++` 拆解为读-改-写 |
| 可见性 | 一线程的写对其他线程何时可见 | 循环读 flag 永不退出 |
| 有序性 | 代码顺序与执行顺序是否一致 | DCL 单例的半初始化 |

### 4.4 happens-before：JMM 的语义合约

八条规则的核心与常用四条：

- 程序顺序规则：同线程内前序 hb 后序
- volatile 规则：写 hb 后续读
- 锁规则：解锁 hb 后续加锁
- 传递性：hb 链条可以串联
- 线程启动、线程终止、中断、`final` 规则等

### 4.5 `final` 的特殊语义与安全发布

- 构造器写入 `final` 字段 hb 引用发布
- `final` 数组元素的语义边界
- "构造未完成对象引用"的经典问题与解法

---

## 5 `volatile`：最轻的同步

> `volatile` 到底保证了什么？为什么它救不了 `i++`？

### 5.1 两条保证与一条不管

- 可见性：写立即刷新到主存，读总从主存取
- 有序性：禁止相关指令重排
- **不保证原子性**：这是所有 `volatile` 误用的根源

### 5.2 内存屏障的四种类型

```
写 volatile：
    普通写
    ------- StoreStore -------
    volatile 写
    ------- StoreLoad --------

读 volatile：
    volatile 读
    ------- LoadLoad ---------
    普通读
    ------- LoadStore --------
```

- `StoreLoad` 是最昂贵的屏障（涉及全流水线刷新）
- 硬件层：x86 的 `mfence` / `lock` 前缀
- MESI 缓存一致性协议的角色

### 5.3 DCL 单例：一个能讲清 `volatile` 的经典场景

```java
// ❌ 缺少 volatile
private static Singleton instance;

// ✅ JDK 5 之后的正确写法
private static volatile Singleton instance;
```

- `instance = new Singleton()` 不是原子操作
- 重排后另一线程可能观察到"非 null 但未初始化"的对象
- `volatile` 的 `StoreStore` 屏障如何堵住这个缺口

### 5.4 `volatile` 与 `Atomic` 的分工

| 场景 | `volatile` | `AtomicInteger` |
|---|---|---|
| 单写多读的标志位 | ✅ | 过度 |
| 计数器 | ❌（`i++` 非原子） | ✅ |
| 引用切换（一次性发布） | ✅ | 可用 |
| 复合条件更新 | ❌ | ✅（`compareAndSet`） |

---

## 6 `synchronized`：JVM 内置锁

> `synchronized` 锁的到底是什么？为什么现代 JVM 上它已经不慢了？

### 6.1 三种加锁位置

| 形式 | 锁对象 | 适用场景 |
|---|---|---|
| 实例方法 | `this` | 保护实例状态 |
| 静态方法 | `Class` 对象 | 保护类级状态 |
| 同步块 | 指定对象 | 细粒度控制 |

### 6.2 `monitorenter` 与 `monitorexit`：字节码视角

- 编译期生成的两条字节码指令
- 每个对象关联一个 Monitor（ObjectMonitor 结构）
- Monitor 的 `_owner` / `_recursions` / `_EntryList` / `_WaitSet`

### 6.3 与对象头 Mark Word 的连接（引用第二卷）

第二卷第 3 章已展开对象头字段布局。本卷视角只关注锁状态位的语义：

| Mark Word 锁位 | 状态 | 内容 |
|---|---|---|
| 01（bias=0） | 无锁 | hashCode + 分代年龄 |
| 01（bias=1） | 偏向锁（历史机制） | Thread ID + Epoch |
| 00 | 轻量级锁 | 指向栈中锁记录的指针 |
| 10 | 重量级锁 | 指向 ObjectMonitor 的指针 |

### 6.4 锁升级：乐观到悲观的滑动

```
    无锁
     │  首个线程 CAS
     ▼
  轻量级锁 ──── 竞争失败自旋 ────► 重量级锁
                                    │
                                    ▼
                              OS Mutex + 队列
```

- 锁只升级，不降级
- 偏向锁自 JDK 15 起默认关闭，本节作为历史注解处理
- JIT 的锁消除与锁粗化（引用第二卷第 5 章）

### 6.5 `wait` / `notify`：Monitor 的协作原语

- 必须在 `synchronized` 块内调用的机制原因
- 与 `Object` 而非 `Thread` 绑定的设计
- 虚假唤醒（spurious wakeup）与 `while` 循环判断条件
- 与 `Condition`（第 8 章）的对照

### 6.6 三个常见误用

- `synchronized(new Object())`：锁对象每次都是新的，等于没锁
- 锁字符串常量：与其他代码意外共享锁
- 锁 `Integer` 装箱值：`-128 ~ 127` 走缓存，超出范围失效

---

## 7 CAS 与原子类：无锁的起点

> 不用锁能不能实现线程安全？代价是什么？

### 7.1 锁的问题与无锁的动机

- 阻塞成本：挂起、唤醒、上下文切换
- 死锁风险：锁获取顺序不当
- 优先级反转：低优先级线程持有锁阻塞高优先级线程

CAS 提供另一条路径：**乐观地假设无竞争，冲突时重试**。

### 7.2 CAS 指令与硬件支持

```
CAS(addr, expected, new):
    原子地执行：
    if *addr == expected:
        *addr = new
        return true
    else:
        return false
```

- x86：`cmpxchg` + `lock` 前缀（锁缓存行或总线）
- ARM：LL/SC（Load-Linked / Store-Conditional）
- Java 层入口：`Unsafe.compareAndSwapXxx` → `VarHandle.compareAndSet`（JDK 9+）

### 7.3 CAS 的三大问题

| 问题 | 表现 | 解法 |
|---|---|---|
| ABA | 值 A→B→A，CAS 无法感知中间变更 | `AtomicStampedReference` 加版本号 |
| 自旋开销 | 高竞争下 CPU 空转 | 竞争激烈时改用锁 |
| 单变量限制 | 只能原子更新一个变量 | 封装为对象 + `AtomicReference` |

### 7.4 `Atomic` 家族的分段思想

| 类 | 原理 | 适用场景 |
|---|---|---|
| `AtomicInteger` / `AtomicLong` | 单变量 CAS | 低到中等竞争的计数 |
| `AtomicReference` | 对象引用 CAS | 状态机切换、无锁结构基础 |
| `AtomicStampedReference` | 引用 + 版本号 | ABA 场景 |
| `LongAdder` | Cell 数组分段累加 | 高并发计数（吞吐远高于 `AtomicLong`） |
| `LongAccumulator` | 分段 + 自定义聚合函数 | 高并发聚合 |

`LongAdder` 的思路是一次典型的"用空间换并发度"，同样思路会在第 9 章 `ConcurrentHashMap` 桶锁与第 13 章伪共享中反复出现。

### 7.5 CAS vs `synchronized`：竞争强度决定选型

一张按竞争强度选型的决策表，配合 JMH 微基准数据参考。

---

## 8 `LockSupport` 与 AQS：并发工具的骨架

> `ReentrantLock`、`Semaphore`、`CountDownLatch`、`CyclicBarrier` 看起来完全不同，为什么源码都在同一个基类里？

### 8.1 `LockSupport`：许可证式挂起

- `park()` / `unpark(thread)` 的许可证模型
- 相比 `Object.wait/notify` 的三点优势：无需持有 Monitor、可精准唤醒指定线程、`unpark` 先于 `park` 也生效
- 底层依赖：`Unsafe.park` → OS 层的 `pthread_cond_wait` / `WaitForSingleObject`

### 8.2 AQS 三件套

`AbstractQueuedSynchronizer` 的核心结构：

- **`state`（volatile int）**：同步状态，子类通过 CAS 修改
- **CLH 队列**：FIFO 双向链表，存放获取失败的线程
- **Node 状态机**：`SIGNAL` / `CANCELLED` / `CONDITION` / `PROPAGATE`

```
                     head
                      │
                      ▼
    ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐
    │ Node A │◄──►│ Node B │◄──►│ Node C │◄──►│ Node D │◄── tail
    │ 已获锁 │    │ 等待   │    │ 等待   │    │ 等待   │
    └────────┘    └────────┘    └────────┘    └────────┘
                    ▲
                    │
              park 挂起中
```

### 8.3 独占模式与共享模式

| 维度 | 独占（Exclusive） | 共享（Shared） |
|---|---|---|
| 同一时刻持有者 | 1 | ≥1 |
| 典型工具 | `ReentrantLock` | `Semaphore` / `CountDownLatch` |
| `state` 含义 | 重入次数 | 剩余许可数 / 未完成计数 |
| 释放传播 | 唤醒队首后继 | 唤醒并向后传播 |

### 8.4 `Condition`：AQS 内部的等待队列

- `Condition` 与 `Object.wait/notify` 的对照
- 一个 `Lock` 可以有多个 `Condition`（生产者-消费者的双队列模型）
- `signal()` 是把等待节点从条件队列迁移到同步队列

### 8.5 基于 AQS 的工具矩阵

| 工具 | 模式 | `state` 含义 |
|---|---|---|
| `ReentrantLock` | 独占 | 0=空闲，n=重入次数 |
| `ReentrantReadWriteLock` | 混合 | 高 16 位=读锁数，低 16 位=写锁重入 |
| `StampedLock` | 乐观读+独占写 | 版本戳 |
| `Semaphore` | 共享 | 剩余许可数 |
| `CountDownLatch` | 共享（一次性） | 未完成计数 |
| `CyclicBarrier` | 基于 `ReentrantLock`+`Condition` | 剩余到达数 |

`StampedLock` 单独一节展开：乐观读的场景、为什么不可重入、与 `ReadWriteLock` 的取舍。

### 8.6 `Lock` vs `synchronized`：三维对比

| 维度 | `synchronized` | `Lock` |
|---|---|---|
| 可中断获取 | ❌ | ✅ `lockInterruptibly()` |
| 超时获取 | ❌ | ✅ `tryLock(timeout)` |
| 公平/非公平 | 仅非公平 | 构造时指定 |
| 多条件队列 | 单一隐式 | 多个 `Condition` |
| 非块结构 | ❌ | ✅（跨方法加解锁） |
| 出错释放 | JVM 自动 | 必须 `try/finally`

---

## 9 并发集合：为并发重新设计的数据结构

> `HashMap` 并发下的死循环是怎么发生的？`ConcurrentHashMap` 又是如何避免的？

### 9.1 普通集合的失败模式

- `ArrayList`：`size++` 非原子 → 元素丢失或 `ArrayIndexOutOfBoundsException`
- `HashMap` JDK 7：头插法 + 并发扩容 → 环形链表 → CPU 100%
- `HashMap` JDK 8：尾插法避免了环形链表，但仍会数据丢失

### 9.2 `ConcurrentHashMap` 的两代实现

| 维度 | JDK 7 分段锁 | JDK 8 桶锁 |
|---|---|---|
| 锁粒度 | 16 个 Segment | 单个 bin（桶） |
| 锁实现 | `ReentrantLock`（Segment 继承） | `synchronized` 锁桶首节点 |
| 空桶插入 | 加锁 | CAS 插入 |
| 扩容 | 每个 Segment 独立扩容 | 多线程协助迁移（`ForwardingNode`） |
| `size()` 精度 | 弱一致 | `baseCount` + `CounterCell` 分段累加 |

### 9.3 `CopyOnWrite` 容器：读无锁的代价

- 写时复制的实现思路
- 迭代器的弱一致性语义
- 适用场景：读极多写极少（配置、监听器列表）
- 反例：把 `CopyOnWriteArrayList` 用于高频写入

### 9.4 `BlockingQueue` 家族

| 实现 | 有界 | 锁粒度 | 特点 |
|---|---|---|---|
| `ArrayBlockingQueue` | 有界 | 单锁 | 数组实现，公平可选 |
| `LinkedBlockingQueue` | 可选有界 | 双锁（put/take 分离） | 吞吐更高，默认无界是陷阱 |
| `SynchronousQueue` | 0 容量 | 无锁栈/队列 | 每 put 必配一 take，线程池默认队列 |
| `DelayQueue` | 无界 | `PriorityQueue` + `ReentrantLock` | 延时出队 |
| `PriorityBlockingQueue` | 无界 | 单锁 | 堆结构，无 FIFO 保证 |
| `LinkedTransferQueue` | 无界 | 无锁 | JDK 7 引入，性能最高 |

### 9.5 `ConcurrentLinkedQueue`：无锁队列速览

- Michael-Scott 算法思路
- `head` / `tail` 的懒更新
- 什么时候选它、什么时候选 `LinkedBlockingQueue`

---

## 10 线程池：任务调度的核心引擎

> `ThreadPoolExecutor` 的七个参数如何互相作用？为什么 `Executors` 的四个工厂方法在生产上都不安全？

### 10.1 无节制创建线程的三个代价

- 每条平台线程 ~1 MB 栈内存
- 上下文切换开销随线程数超过 CPU 核数呈非线性增长
- 无法限流：突发流量下资源耗尽

### 10.2 七参数的耦合关系

| 参数 | 含义 |
|---|---|
| `corePoolSize` | 核心线程数，即使空闲也保留（除非 `allowCoreThreadTimeOut`） |
| `maximumPoolSize` | 最大线程数上限 |
| `keepAliveTime` | 非核心线程空闲存活时间 |
| `workQueue` | 任务等待队列 |
| `threadFactory` | 线程创建工厂（生产环境必须自定义线程名） |
| `handler` | 拒绝策略 |
| `unit` | `keepAliveTime` 单位 |

### 10.3 任务流转的完整状态机

```
    submit(task)
        │
        ▼
    活跃线程数 < core？
        │
    ┌───┴───┐
    是      否
    │        │
    ▼        ▼
  创建核心  队列未满？
  线程执行     │
           ┌──┴──┐
           是    否
           │      │
           ▼      ▼
         入队   线程数 < max？
                    │
                ┌───┴───┐
                是      否
                │        │
                ▼        ▼
              创建非    执行拒绝
              核心线程   策略
              执行
```

### 10.4 四种拒绝策略

| 策略 | 行为 | 适用场景 |
|---|---|---|
| `AbortPolicy`（默认） | 抛 `RejectedExecutionException` | 必须感知过载 |
| `CallerRunsPolicy` | 提交线程自己执行 | 天然限流，反压上游 |
| `DiscardPolicy` | 静默丢弃 | 可丢失的非关键任务 |
| `DiscardOldestPolicy` | 丢弃队首，重试提交 | 优先处理最新任务 |

### 10.5 `LinkedBlockingQueue` 默认无界的陷阱

- `Executors.newFixedThreadPool` 与 `newSingleThreadExecutor` 用了无界队列 → `maximumPoolSize` 永远触发不到
- 内存 OOM 前，`workQueue` 会积压到不可控
- `❌ / ✅` 对照：`Executors` 工厂 vs 手写 `ThreadPoolExecutor`

### 10.6 `ScheduledThreadPoolExecutor`

- 底层 `DelayedWorkQueue`（堆）
- `scheduleAtFixedRate` 与 `scheduleWithFixedDelay` 的语义差异
- 任务异常后为什么会"消失"

### 10.7 `ForkJoinPool` 与工作窃取

- 每个 Worker 有独立双端队列
- 空闲 Worker 从其他 Worker 的队尾窃取任务
- `commonPool` 的角色（`CompletableFuture` 默认执行器、并行流底座）

### 10.8 参数配置方法论

| 负载类型 | 核心线程数经验公式 | 说明 |
|---|---|---|
| CPU 密集 | `N_CPU + 1` | 加 1 抵消偶发缺页 |
| IO 密集 | `N_CPU × (1 + W/C)` | W=等待时间，C=计算时间 |
| 混合 | 拆分为两个池 | 避免相互阻塞 |

监控指标：`getPoolSize()` / `getActiveCount()` / `getQueue().size()` / `getCompletedTaskCount()`。

---

## 11 异步编程：从 `Future` 到 `CompletableFuture`

> 有了线程池，为什么还需要 `CompletableFuture`？

### 11.1 `Future` 的三个致命局限

- `get()` 阻塞调用线程 → 异步只是名字上的异步
- 无法注册回调 → 结果只能"拉"不能"推"
- 无法组合多个任务 → 依赖关系全靠手写胶水代码

### 11.2 `CompletableFuture` 的两组 API

**转换类**（单输入）：

| 方法 | 输入 | 输出 | 用途 |
|---|---|---|---|
| `thenApply` | T → R | `CF<R>` | 同步转换 |
| `thenCompose` | T → CF\<R\> | `CF<R>` | 扁平化嵌套异步 |
| `thenAccept` | T → void | `CF<Void>` | 消费结果 |

**合并类**（多输入）：

| 方法 | 输入 | 语义 |
|---|---|---|
| `thenCombine` | 两个 CF | 都完成后合并结果 |
| `allOf` | N 个 CF | 全部完成 |
| `anyOf` | N 个 CF | 任一完成 |

### 11.3 执行线程之谜

- 无 Executor 参数：使用 `ForkJoinPool.commonPool`
- `xxxAsync` 变体：可指定 Executor
- 同步链式调用：可能在提交线程执行（"急切执行"陷阱）
- 生产建议：始终显式传入业务线程池

### 11.4 异常传播的三条路径

| 方法 | 恢复值 | 感知异常 | 修改结果 |
|---|---|---|---|
| `exceptionally` | ✅ | ✅ | ✅ |
| `handle` | ✅ | ✅ | ✅ |
| `whenComplete` | ❌ | ✅ | ❌ |

### 11.5 常见反模式

- 链尾忘记 `.join()`：任务提交但结果被 GC
- 在回调里做阻塞 IO：占满 commonPool，全局阻塞
- 未指定 Executor：不同业务共享 commonPool，互相干扰
- 混用 `get()` 与 `join()`：异常包装层级不同

### 11.6 其他并发范式速览

只点名思想，不展开 API：

- **响应式编程**：Publisher / Subscriber / 背压，Reactor / RxJava（完整机制见第四卷 Netty 章）
- **Actor 模型**：不共享状态，只传递消息，Akka 作为 JVM 生态代表

---

## 12 虚拟线程与结构化并发（JDK 21）

> 如果线程可以像对象一样廉价，过去十年积累的线程池经验还成立吗？

### 12.1 平台线程的天花板

- 1:1 模型下，单 JVM 稳定线程数上限约几千
- Web 服务器"一请求一线程"模型在高并发场景下的瓶颈
- 传统解法：Reactor 模型（第四卷）→ 代码风格断裂

### 12.2 虚拟线程：M:N 调度与 continuation

```
    虚拟线程 (百万级)
    ─────────────────
        │
        │  挂载 / 卸载
        ▼
    Carrier Thread (平台线程池, ~N_CPU 条)
        │
        ▼
       OS Thread
```

- `continuation`：可挂起可恢复的执行片段
- 阻塞点自动卸载（IO、`park`）
- 由 `ForkJoinPool` 的 carrier 池调度

### 12.3 挂载与卸载：`synchronized` 的钉住（pinning）

- `synchronized` 块内的阻塞会"钉住"carrier 线程
- JDK 21 的 workaround：换用 `ReentrantLock`
- JDK 24 的修复：`synchronized` 也支持卸载
- 检测工具：`-Djdk.tracePinnedThreads=full`

### 12.4 何时不要用虚拟线程

- CPU 密集任务：虚拟线程不会提升 CPU 并行度
- 需要严格并发数控制：虚拟线程无法通过线程池"节流"，需改用 `Semaphore`
- 依赖 `ThreadLocal` 的性能敏感代码：每虚拟线程一份 TL 副本，总量爆炸

### 12.5 结构化并发：`StructuredTaskScope`

- 传统并发的问题：子任务生命周期脱离父任务
- 结构化并发的核心约束：作用域内启动的所有任务必须在作用域退出前完成
- `ShutdownOnFailure` / `ShutdownOnSuccess` 两种收敛策略
- 与 Kotlin 协程 `coroutineScope` 的思路对照

### 12.6 与传统线程池的关系重估

| 场景 | 平台线程池 | 虚拟线程 |
|---|---|---|
| IO 密集、请求处理 | 需精调参数 | `newVirtualThreadPerTaskExecutor` 直接用 |
| CPU 密集计算 | ✅ | ❌ |
| 需要限流 | 线程数天然限流 | 需外挂 `Semaphore` |
| 短任务、任务隔离 | 参数配置复杂 | 一任务一线程即可 |

---

## 13 并发问题诊断与性能调优

> 线上告警：线程数暴涨、CPU 打满、接口 RT 抖动，从哪一步开始查？

### 13.1 死锁 / 活锁 / 饥饿的代码模式

| 问题 | 表现 | 根因 | 定位手段 |
|---|---|---|---|
| 死锁 | 线程互相等待，全部卡死 | 锁获取顺序不一致 | `jstack` 末尾 `Found one deadlock` |
| 活锁 | 不断重试但始终失败 | CAS 过度自旋 / 双方礼让 | CPU 高但无进展 |
| 饥饿 | 部分线程永远得不到执行 | 非公平锁 + 高竞争 | 长时间 `WAITING` |

### 13.2 Thread Dump 的并发视角

通用 `jstack` 用法引用第二卷第 6 章。本章聚焦并发场景：

- **BLOCKED 聚簇**：大量线程 `BLOCKED (on object monitor)` 于同一锁 → 锁竞争热点
- **锁等待链**：`- waiting to lock <0x...>` 与 `- locked <0x...>` 交叉分析
- **死锁环**：`jstack` 自动检测的显式输出
- **虚拟线程 dump**：JDK 21 的 `jcmd Thread.dump_to_file`

### 13.3 锁竞争定位工具

- **JFR**：`JavaMonitorEnter` / `JavaMonitorWait` 事件的时长与堆栈
- **async-profiler**：`-e lock` 模式
- **JMH**：微基准复现竞争强度
- **`jstack` 采样**：低成本的定性分析

### 13.4 伪共享（False Sharing）

```
Cache Line (64 B)
┌──────────────┬──────────────┐
│  volatile a  │  volatile b  │
│  线程 1 写   │  线程 2 写   │
└──────────────┴──────────────┘
     两个变量在同一缓存行 → 互相 invalidate
```

- CPU 缓存一致性的粒度是缓存行（通常 64 字节）
- 相邻变量被不同线程写入 → 缓存行反复失效
- `@Contended` 注解与 `-XX:-RestrictContended`
- `LongAdder` 的 `Cell` 就使用了 `@Contended` 防止伪共享

### 13.5 上下文切换成本

- `vmstat 1` 的 `cs` 列：每秒上下文切换次数
- `pidstat -w -p <pid> 1`：进程级别切换统计
- 正常值参考与异常阈值
- 减少切换的三条路径：降低线程数、增大任务粒度、无锁化

### 13.6 并发优化的四个方向

| 方向 | 手段 | 典型案例 |
|---|---|---|
| 缩小锁粒度 | 大锁拆小锁 | `ConcurrentHashMap` 桶级锁 |
| 无锁替代 | CAS 替代锁 | `AtomicLong` → `LongAdder` |
| 读写分离 | 读不加锁，写加锁 | `ReadWriteLock` / `CopyOnWrite` |
| 异步化 | 解耦请求与处理 | 线程池 + `CompletableFuture` |

### 13.7 常见反模式集锦

```java
// ❌ 双重检查锁缺 volatile
private static Singleton instance;

// ❌ 用 String 常量作锁
synchronized ("LOCK") { ... }

// ❌ ThreadLocal 忘记 remove（线程池场景）
threadLocal.set(userContext);
// 用完不 remove

// ❌ CompletableFuture 未指定 Executor
CompletableFuture.supplyAsync(this::heavyIO);  // 走 commonPool

// ❌ Executors.newFixedThreadPool 无界队列
ExecutorService pool = Executors.newFixedThreadPool(10);
```

对应 `✅` 版本在正文逐一给出。

---

> **纵横联系**
>
> - **向前依赖第二卷**：JVM 内存结构（堆共享 / 栈私有）、对象头 Mark Word（锁状态）、Monitor 结构、JIT 锁消除与锁粗化、CPU 缓存与 MESI。第 6 章 `synchronized` 与 Mark Word 的对接、第 7 章 CAS 与 `Unsafe`、第 13 章伪共享与缓存行，都直接建立在第二卷之上。
>
> - **向后支撑第四卷**：Netty EventLoop 的单线程无锁模型、NIO 的非阻塞 IO、响应式编程的完整机制。本卷第 11 章的响应式速览、第 12 章的虚拟线程都会与第四卷 IO 模型形成互补。
>
> - **向后支撑第六卷**：`@Async` 底层的线程池、Spring 事务的 `ThreadLocal` 上下文、Spring Security 的安全上下文传递、MDC 日志追踪。第 3 章 `ThreadLocal` 是这些机制的共同底座。
>
> - **向后支撑第七卷**：线程池调优、异步化架构、CAP 与分布式一致性中的顺序语义。第 13 章的诊断方法在第七卷"性能工程"章节被再次调用。
>
> 三卷之间形成自然递进：**Java 如何表达程序**（第一卷）→ **JVM 如何执行程序**（第二卷）→ **多执行流如何安全高效地共享资源**（第三卷）。
