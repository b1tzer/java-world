# 第4章 volatile：轻量级同步机制

> 当一个线程修改了某个变量的值，另一个线程能否立刻看到这个变化？如果不能，程序会出现怎样诡异的 bug？`volatile` 关键字正是为了解决这个"看不见"的问题而存在的——它比 `synchronized` 轻量得多，但能力也有限得多。理解 volatile 的边界，是掌握并发编程的第一道分水岭。

---

## 4.1 volatile 解决什么问题

### 4.1.1 并发编程的两大挑战

第 3 章已经详细讨论过并发编程的核心困难：**可见性**和**有序性**。CPU 缓存导致一个线程的写入对另一个线程不可见，编译器和 CPU 的重排序导致代码执行顺序与书写顺序不一致。JMM 通过 happens-before 规则定义了跨线程的可见性保证，而 `volatile` 正是 JMM 提供的核心机制之一。

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

### 4.2.1 volatile 的读写语义

JVM 遇到 `volatile` 变量读写时，会在这次读写前后加入额外的顺序与可见性约束。

这组约束主要解决三件事：

- `volatile` 写之前的普通写，不能被重排到它后面
- `volatile` 读之后的普通读写，不能被重排到它前面
- 这次写入的结果要尽快对其他线程可见

因此，`volatile` 的关键不在“变量本身有什么特殊形态”，而在于：**这次读写被赋予了同步语义。**

通用的屏障类型和硬件差异，见 [Java 内存模型（JMM）](./chapter-03-jmm.md)。`volatile` 的关键，是它在读写两侧建立的同步约束。

### 4.2.2 volatile 写与 volatile 读

`volatile` 的底层行为，可以直接按读和写两侧来理解：

| 操作 | 要达到的效果 | 典型屏障语义 |
| :-- | :-- | :-- |
| **volatile 写** | 前面的普通写先完成，再发布这个值；后续读不能穿越到写之前 | `StoreStore` + `StoreLoad` |
| **volatile 读** | 先拿到这个变量的最新值，再执行后续普通读写 | `LoadLoad` + `LoadStore` |

下面这个模型最能说明它的作用：

```text
线程 A：发布数据

普通写 data = 42
普通写 readyExtra = true
volatile 写 ready = true

线程 B：读取数据

volatile 读 ready == true
普通读 data
普通读 readyExtra
```

只要线程 B 读到了 `ready == true`，它后面的普通读就必须发生在这次 `volatile` 读之后。这样线程 A 在 `volatile` 写之前完成的普通写，也会一起对线程 B 可见。

这就是 `volatile` 建立 happens-before 关系的方式：

- 写线程先完成普通写
- 再执行 `volatile` 写
- 读线程先读到这个 `volatile` 新值
- 再执行后续普通读

这样线程 B 不只是看到 `ready = true`，还会看到线程 A 在此之前写入的相关数据。

### 4.2.3 缓存一致性协议

顺序约束只解决了一半问题，另一半是：其他核心怎样知道这个值已经变了。

现代处理器通常先访问本地缓存，而不是每次都直接访问主内存。一个核心修改了共享变量后，其他核心想读到最新值，底层就需要缓存一致性协议来协作。

以常见的 MESI 为例，可以用这个简化模型理解：

| 状态 | 含义 | 对 volatile 可见性的意义 |
| :-- | :-- | :-- |
| **M**odified | 当前核心已修改，尚未与其他核心同步 | 最新值暂时保留在本核更近的位置 |
| **E**xclusive | 当前核心独占，值与内存一致 | 只有当前核心持有这行缓存 |
| **S**hared | 多个核心共享同一缓存行 | 多个核心都可能读取这行数据 |
| **I**nvalid | 当前缓存行已失效 | 下次读取必须重新获取最新值 |

当线程 A 执行 `volatile` 写时，相关缓存行会触发一致性流量，使其他核心中对应的旧缓存行失效。其他核心在后续读取同一变量时，就需要重新获取最新值。

```text
Core 0（线程 A）                 Core 1（线程 B）
────────────────                 ────────────────
缓存行：Shared                    缓存行：Shared
       │                                  │
       │ volatile 写 ready = true          │
       │──────── 一致性流量 / 失效通知 ────→│
       │                                  │
缓存行：Modified / 最新              缓存行：Invalid
                                          │
                                          │ volatile 读 ready
                                          ▼
                                     重新获取最新值
```

JMM 负责定义 Java 层面的同步语义，缓存一致性协议负责让这些语义在硬件上真正传播出去。两者配合，`volatile` 的可见性才成立。

### 4.2.4 x86 与 ARM 的差异

不同硬件平台对内存顺序的默认保证不同，因此 JVM 在不同平台上落实 `volatile` 语义的方式也不同。

- **x86 / x86-64**：默认内存模型较强，部分顺序约束硬件已经帮忙处理
- **ARM / AArch64**：默认内存模型较弱，更依赖显式屏障来表达顺序要求

所以，有些没加 `volatile` 的代码在 x86 上看起来暂时正常，并不意味着它真的正确。真正可靠的依据，仍然是 JMM 语义和 JVM 落地出来的同步约束。

### 4.2.5 volatile 的边界

`volatile` 的能力边界可以直接归纳成下面这张表：

| 能力 | 结论 | 说明 |
| :-- | :-- | :-- |
| 可见性 | ✅ 支持 | 一个线程写入后，其他线程能尽快看到最新值 |
| 有序性 | ✅ 支持 | 与这个变量相关的关键重排序会被约束 |
| 原子性 | ❌ 不支持复合操作 | `i++`、check-then-act 仍然可能发生竞态 |
| 临界区互斥 | ❌ 不支持 | 不能替代锁来保护一段代码 |

因此，`volatile` 更适合做状态发布、停止标志和安全发布这类场景；遇到复合更新、多个线程同时修改、临界区保护时，仍然需要 `synchronized`、`Lock` 或原子类。

### 4.3.1 count++ 的三步分解

这是一个最常见的面试问题，但理解其背后的原因比记住答案更重要。

`count++` 看起来是一条语句，但在字节码层面，它被分解为三个独立的操作：

```text
1. 读取（Read）：从主存读取 count 的当前值到工作内存
2. 修改（Modify）：在工作内存中将值加 1
3. 写入（Write）：将修改后的值写回主存
```

对应的字节码：

```text
getstatic    count     // 1. 读取
iconst_1              // 常量 1
iadd                  // 2. 修改（加法）
putstatic    count     // 3. 写入
```

### 4.3.2 竞态条件时序图

`volatile` 只保证**每一步**的可见性，但不保证**三步合起来**是原子的。当两个线程同时执行 `count++` 时：

```text
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
| :-- | :-- | :-- |
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

```text
1. 分配内存空间
2. 在内存中初始化对象（执行构造方法）
3. 将 instance 引用指向分配的内存
```

JMM 允许将步骤 2 和步骤 3 重排序，变成：

```text
1. 分配内存空间
2. 将 instance 引用指向分配的内存  ← 此时 instance != null
3. 在内存中初始化对象               ← 但构造方法还没执行完！
```

如果没有 `volatile`，线程 B 可能在线程 A 执行完步骤 2 但还没执行步骤 3 时，进入 `if (instance == null)` 判断，发现 `instance != null`，于是直接返回一个**尚未构造完成**的对象——这是一个非常隐蔽的 bug。

```text
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

`volatile` 在 DCL 中的作用是：**禁止步骤 2 和步骤 3 的重排序**。加了 volatile 后，JMM 会在步骤 2 之后插入 StoreStore 屏障，保证对象的构造方法在引用赋值之前完成。

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

这里 `volatile` 和 CAS 的分工非常明确：

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
| :-- | :-- | :-- |
| 原子性 | ❌ 不保证 | ✅ 保证代码块的原子性 |
| 可见性 | ✅ 保证 | ✅ 保证（释放锁时刷新，获取锁时重新加载） |
| 有序性 | ✅ 保证（禁止重排序） | ✅ 保证（happens-before） |
| 阻塞 | ❌ 不会阻塞 | ✅ 会阻塞（竞争时） |
| 性能 | 极高（CPU 指令级别） | 较高（涉及锁竞争时开销大） |
| 适用场景 | 一写多读、状态标志 | 多写多读、复合操作 |
| 能否修饰方法 | ❌ 只能修饰变量 | ✅ 可以修饰方法和代码块 |

### 4.5.2 选择指南

```text
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
