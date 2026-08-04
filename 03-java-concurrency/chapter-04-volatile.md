# 第4章 volatile：轻量级同步机制

> 当一个线程修改了某个变量的值，另一个线程能否立刻看到这个变化？如果不能，程序会出现怎样诡异的 bug？`volatile` 关键字正是为了解决这个"看不见"的问题而存在的——它比 `synchronized` 轻量得多，但能力也有限得多。理解 volatile 的边界，是掌握并发编程的第一道分水岭。

---

## 4.1 volatile 解决什么问题

### 4.1.1 并发编程的两大挑战

并发编程的核心困难可以归结为两个词：**可见性**和**有序性**。

| 问题 | 含义 | 根源 |
|------|------|------|
| 可见性 | 线程 A 对变量的修改，线程 B 能否立即看到 | CPU 缓存、编译器优化 |
| 有序性 | 代码的执行顺序是否与书写顺序一致 | 指令重排序、编译器优化 |

Java 内存模型（JMM）允许每个线程拥有自己的工作内存（实际上是 CPU 缓存的抽象），变量的读写可能先在工作内存中完成，再异步刷新到主存。这意味着一个线程对共享变量的修改，另一个线程未必能立即看到。

### 4.1.2 volatile 的两个核心保证

`volatile` 关键字为变量提供两个保证：

1. **可见性保证**：对 volatile 变量的写操作会立即刷新到主存；对 volatile 变量的读操作总是从主存中获取最新值。
2. **有序性保证**：禁止 JVM 对 volatile 变量相关的指令进行重排序。

### 4.1.3 没有 volatile 时的诡异行为

先看一个经典的例子：

```java
// 共享变量
boolean running = true;

// 线程 A
new Thread(() -> {
    while (running) {
        // 做一些工作
        doSomething();
    }
    System.out.println("线程 A 停止");
}).start();

// 线程 B（主线程）
Thread.sleep(1000);
running = false;  // 期望线程 A 停止
System.out.println("主线程将 running 设为 false");
```

你可能期望线程 A 在 1 秒后停止。但在某些情况下（尤其在 Server 模式下的 JIT 编译），线程 A 可能永远不会停下来。原因在于：

- JIT 编译器发现 `running` 在线程 A 的循环体中没有被修改，于是将其优化为：`if (!running) { while (true) { doSomething(); } }`
- 即使没有被 JIT 优化，由于 CPU 缓存的存在，线程 B 对 `running` 的修改可能停留在线程 B 的缓存行中，线程 A 读到的仍是旧值。

修复方法很简单——给 `running` 加上 `volatile`：

```java
volatile boolean running = true;
```

加上 `volatile` 后，JIT 不会将其缓存到寄存器中，每次循环都会从主存读取最新的值。同时，JMM 保证了 volatile 写 happens-before 后续的 volatile 读，线程 B 的修改对线程 A 立即可见。

---

## 4.2 volatile 底层实现

### 4.2.1 内存屏障（Memory Barrier）

volatile 的语义保证是通过**内存屏障**指令来实现的。内存屏障是 CPU 提供的底层指令，用于控制指令的执行顺序和缓存的刷新策略。

JMM 定义了四种内存屏障：

| 屏障类型 | 作用 | 插入位置 |
|---------|------|---------|
| LoadLoad | 确保屏障前的读操作先于屏障后的读操作完成 | volatile 读之后 |
| LoadStore | 确保屏障前的读操作先于屏障后的写操作完成 | volatile 读之后 |
| StoreStore | 确保屏障前的写操作先于屏障后的写操作完成，刷新写缓冲区 | volatile 写之前 |
| StoreLoad | 确保屏障前的写操作对所有处理器可见后，才允许后续读操作 | volatile 写之后 |

volatile 操作的屏障插入规则：

```
┌─────────────────────────────────────────┐
│            volatile 写操作               │
│                                         │
│   [StoreStore 屏障]                     │
│   volatile 写                           │
│   [StoreLoad 屏障]                      │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│            volatile 读操作               │
│                                         │
│   [LoadLoad 屏障]                       │
│   volatile 读                           │
│   [LoadStore 屏障]                      │
└─────────────────────────────────────────┘
```

其中最关键的是 **StoreLoad 屏障**——它保证 volatile 写入的值对所有处理器可见后，才允许后续的读操作发生。在 x86 架构上，StoreLoad 屏障通常通过 `lock` 前缀指令或 `mfence` 指令实现。

### 4.2.2 MESI 协议

内存屏障之所以能工作，底层依赖的是 CPU 的**缓存一致性协议**。在 x86 架构上，最常见的是 MESI 协议。

MESI 协议定义了缓存行（Cache Line）的四种状态：

| 状态 | 含义 | 说明 |
|------|------|------|
| **M**odified | 已修改 | 缓存行中的数据与主存不一致，仅当前核持有 |
| **E**xclusive | 独占 | 缓存行中的数据与主存一致，仅当前核持有 |
| **S**hared | 共享 | 缓存行中的数据与主存一致，多个核可能持有 |
| **I**nvalid | 失效 | 缓存行中的数据无效，需要从主存或其他核重新加载 |

当一个线程执行 volatile 写时，CPU 会通过总线发送 **Invalidate** 消息，通知其他所有核将对应的缓存行标记为 Invalid。其他核在下次读取该变量时，必须从主存或持有最新数据的核重新加载。

```
  线程 A (Core 0)                 线程 B (Core 1)
  ─────────────                   ─────────────
  缓存行: S (共享)                 缓存行: S (共享)
       │                               │
       │  volatile 写 x = 1             │
       │  ──── Invalidate ────→        │
       │                               │
  缓存行: M (已修改)               缓存行: I (失效)
       │                               │
       │                               │  volatile 读 x
       │  ←──── Read Response ────     │
       │                               │
  缓存行: S (共享)                 缓存行: S (共享)
  x = 1                           x = 1
```

### 4.2.3 总线锁与缓存锁

早期的 CPU 使用**总线锁**（Bus Lock）来保证原子性——通过拉高 `LOCK#` 信号，让总线上的其他处理器无法访问内存。但总线锁的代价很高，因为它阻塞了所有内存访问。

现代 CPU（如 Intel 的 Nehalem 架构之后）引入了**缓存锁**（Cache Lock）：当数据所在的缓存行处于 M 或 E 状态时，只需要锁定该缓存行，而不需要锁定总线。只有在数据不缓存或跨多个缓存行时，才回退到总线锁。

volatile 的 StoreLoad 屏障在 x86 上通过 `lock addl $0, 0(%rsp)` 或 `mfence` 实现。`lock` 前缀指令会触发缓存锁（或总线锁），确保之前的写操作完成后，才允许后续的读操作。

---

## 4.3 volatile 为什么不能保证 i++

### 4.3.1 count++ 的三步分解

这是一个最常见的面试问题，但理解其背后的原因比记住答案更重要。

`count++` 看起来是一条语句，但在字节码层面，它被分解为三个独立的操作：

```
1. 读取（Read）：从主存读取 count 的当前值到工作内存
2. 修改（Modify）：在工作内存中将值加 1
3. 写入（Write）：将修改后的值写回主存
```

对应的字节码：

```
getstatic    count     // 1. 读取
iconst_1              // 常量 1
iadd                  // 2. 修改（加法）
putstatic    count     // 3. 写入
```

### 4.3.2 竞态条件时序图

`volatile` 只保证**每一步**的可见性，但不保证**三步合起来**是原子的。当两个线程同时执行 `count++` 时：

```
时间轴 →

线程 A:  [读 count=0] ──────────────── [修改 0+1=1] ── [写 count=1]
线程 B:  ──── [读 count=0] ── [修改 0+1=1] ── [写 count=1] ────────

主存:    count=0 ─────────────────────────────────── count=1
```

两个线程都读到了 `count=0`，各自加 1 后写回 `count=1`。结果是 `count` 只增加了 1，而不是预期的 2。

即使 `count` 是 volatile 的，也无法阻止这个竞态条件。因为 volatile 保证的是"读到最新值"，但两个线程**同时读到同一个最新值**，然后各自修改——这本身就是问题所在。

### 4.3.3 正确的替代方案

对于"多写"场景，需要使用更强的同步机制：

```java
// 方案 1：使用 synchronized
synchronized void increment() {
    count++;
}

// 方案 2：使用 AtomicInteger
AtomicInteger count = new AtomicInteger(0);
count.incrementAndGet();

// 方案 3：使用 LongAdder（高并发场景更优）
LongAdder count = new LongAdder();
count.increment();
```

### 4.3.4 volatile 的适用场景

| 场景 | 是否适用 | 原因 |
|------|---------|------|
| 一写多读（状态标志位） | ✅ 适用 | 只有一个线程写，不存在竞态 |
| 多写多读 | ❌ 不适用 | 多线程同时写会导致竞态条件 |
| 复合操作（i++、check-then-act） | ❌ 不适用 | 复合操作不是原子的 |
| 引用赋值 | ✅ 适用 | 引用赋值在 JVM 规范中是原子的 |

---

## 4.4 volatile 的经典应用

### 4.4.1 双重检查锁（DCL）中的 volatile

单例模式的双重检查锁实现是 volatile 最经典的应用场景之一。

**为什么需要 volatile？**

看 `instance = new Singleton()` 这行代码，它在 JVM 中被分解为三个步骤：

```
1. 分配内存空间
2. 在内存中初始化对象（执行构造方法）
3. 将 instance 引用指向分配的内存
```

JMM 允许将步骤 2 和步骤 3 重排序，变成：

```
1. 分配内存空间
2. 将 instance 引用指向分配的内存  ← 此时 instance != null
3. 在内存中初始化对象               ← 但构造方法还没执行完！
```

如果没有 `volatile`，线程 B 可能在线程 A 执行完步骤 2 但还没执行步骤 3 时，进入 `if (instance == null)` 判断，发现 `instance != null`，于是直接返回一个**尚未构造完成**的对象——这是一个非常隐蔽的 bug。

```
  线程 A                                    线程 B
  ──────                                    ──────
  1. 分配内存
  2. instance = 内存地址 (instance != null)
                                            3. if (instance == null) → false
                                            4. return instance ← 半初始化对象！
  5. 执行构造方法
```

**完整的 DCL 单例实现：**

```java
public class Singleton {
    // volatile 禁止重排序，保证对象完全构造后才对其他线程可见
    private static volatile Singleton instance;

    private Singleton() {
        // 防止反射攻击
        if (instance != null) {
            throw new RuntimeException("请使用 getInstance() 方法");
        }
    }

    public static Singleton getInstance() {
        // 第一次检查：避免每次都进入 synchronized
        if (instance == null) {
            synchronized (Singleton.class) {
                // 第二次检查：防止多个线程同时通过第一次检查
                if (instance == null) {
                    instance = new Singleton();
                }
            }
        }
        return instance;
    }
}
```

volatile 在这里的作用是：**禁止步骤 2 和步骤 3 的重排序**。加了 volatile 后，JMM 会在步骤 2 之后插入 StoreStore 屏障，保证对象的构造方法在引用赋值之前完成。

### 4.4.2 状态标志位

这是 volatile 最简单、最直观的应用：

```java
public class GracefulShutdown {
    private volatile boolean shutdownRequested = false;

    public void shutdown() {
        shutdownRequested = true;  // 主线程写
    }

    public void doWork() {
        while (!shutdownRequested) {  // 工作线程读
            // 执行任务
            process();
        }
        // 清理资源
        cleanup();
    }
}
```

这种模式满足 volatile 的最佳使用条件：**一个线程写，多个线程读**。

### 4.4.3 内存可见性保证——配合 CAS 使用

volatile 在 `java.util.concurrent` 包中无处不在。`AtomicInteger`、`ConcurrentHashMap`、`AQS` 等并发容器和框架，都依赖 volatile 来保证状态的可见性。

以 `AtomicInteger` 为例：

```java
public class AtomicInteger {
    private volatile int value;  // volatile 保证可见性

    public final int incrementAndGet() {
        return U.getAndAddInt(this, VALUE, 1) + 1;  // CAS 保证原子性
    }
}
```

这里 volatile 和 CAS 的分工非常明确：
- **volatile**：保证 `value` 的修改对所有线程立即可见
- **CAS（Compare-And-Swap）**：保证"比较并修改"操作的原子性

两者配合，实现了无锁的线程安全计数器。

### 4.4.4 发布对象的安全引用

volatile 还可以安全地"发布"一个对象：

```java
public class SafePublish {
    private volatile Config config;

    public void updateConfig(Config newConfig) {
        config = newConfig;  // volatile 写，保证 newConfig 的所有字段对读线程可见
    }

    public void useConfig() {
        Config c = config;  // volatile 读，保证读到最新发布的对象
        if (c != null) {
            // 使用 c 的字段——由于 volatile 写的 happens-before 关系，
            // 这里能看到 newConfig 对象构造时写入的所有字段
            String url = c.getUrl();
        }
    }
}
```

如果没有 volatile，另一个线程可能看到一个**部分构造**的 `Config` 对象——引用非 null，但内部字段还没有初始化。

---

## 4.5 volatile vs synchronized

### 4.5.1 全面对比

| 特性 | volatile | synchronized |
|------|----------|-------------|
| 原子性 | ❌ 不保证 | ✅ 保证代码块的原子性 |
| 可见性 | ✅ 保证 | ✅ 保证（释放锁时刷新，获取锁时重新加载） |
| 有序性 | ✅ 保证（禁止重排序） | ✅ 保证（happens-before） |
| 阻塞 | ❌ 不会阻塞 | ✅ 会阻塞（竞争时） |
| 性能 | 极高（CPU 指令级别） | 较高（涉及锁竞争时开销大） |
| 适用场景 | 一写多读、状态标志 | 多写多读、复合操作 |
| 能否修饰方法 | ❌ 只能修饰变量 | ✅ 可以修饰方法和代码块 |

### 4.5.2 选择指南

```
需要保证并发安全？
    │
    ├── 只有一个线程写，其他线程只读？
    │   └── ✅ 使用 volatile
    │
    ├── 需要多个线程同时写？
    │   └── ✅ 使用 synchronized 或 Lock
    │
    ├── 涉及复合操作（check-then-act、read-modify-write）？
    │   └── ✅ 使用 synchronized 或原子类（CAS）
    │
    └── 需要跨方法的临界区？
        └── ✅ 使用 synchronized 或 Lock
```

### 4.5.3 一个常见的误区

有些人认为"既然 volatile 轻量，就尽量用 volatile 替代 synchronized"。这是错误的。volatile 和 synchronized 解决的是不同层次的问题：

- volatile 解决的是**单个变量**的可见性和有序性问题
- synchronized 解决的是**一段代码**的原子性问题

它们不是替代关系，而是互补关系。在实际开发中，很多场景需要两者的配合——比如前面看到的 `AtomicInteger`，就是 volatile（可见性）+ CAS（原子性）的组合。

---

## 4.6 volatile 的陷阱与最佳实践

### 4.6.1 不要过度依赖 volatile

volatile 是一把"薄刃剑"——它很锋利（性能好），但也很薄（功能有限）。以下是常见的陷阱：

```java
// 陷阱 1：volatile 不保证原子性
volatile int count = 0;
count++;  // 线程不安全！

// 陷阱 2：volatile 引用不保证内部状态可见
volatile List<String> list = new ArrayList<>();
// 线程 A
list.add("hello");  // ArrayList.add() 内部不是线程安全的
// 线程 B
list.get(0);  // 可能抛出 IndexOutOfBoundsException

// 陷阱 3：volatile 不替代 happens-before 的所有场景
volatile int a = 0;
int b = 0;
// 线程 A
b = 42;        // 普通写
a = 1;         // volatile 写
// 线程 B
if (a == 1) {  // volatile 读
    // b 一定是 42 吗？
    // ✅ 是的！volatile 写 happens-before 后续的 volatile 读
    // 普通写 b=42 happens-before volatile 写 a=1
    // volatile 写 a=1 happens-before volatile 读 a==1
    // 因此 b=42 happens-before 读取 b
}
```

### 4.6.2 最佳实践清单

1. **一写多读**：优先考虑 volatile
2. **多写**：使用 `synchronized`、`Lock` 或原子类
3. **复合操作**：使用 `synchronized` 或 `AtomicXxx`
4. **状态标志**：volatile 是最佳选择
5. **单例 DCL**：必须使用 volatile
6. **不确定时**：选择 synchronized（更安全）

---

> **纵向联系**
>
> - 本章的"可见性"和"有序性"概念，直接建立在第 2 章（Java 内存模型）的基础上。如果你跳过了 JMM 章节，建议先回去阅读。
> - volatile 的内存屏障实现，在第 7 章（Java 内存模型深入）中会进一步展开，讨论 acquire/release 语义与 JMM 的 happens-before 规则。
> - volatile 与 CAS 的配合，在第 8 章（原子操作与 CAS）中会详细分析 `Unsafe` 类的底层实现。
> - synchronized 与 volatile 的对比，在第 5 章（synchronized）中会从锁升级的角度再次审视。

---
