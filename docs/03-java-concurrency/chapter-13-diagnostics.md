# 第11章 并发问题诊断与性能优化

> 程序上线后出现偶发的卡顿、超时甚至完全挂起，你怀疑是并发问题——但怎么确认？怎么定位到具体的代码行？定位之后又该怎么修？本章回答三个问题：并发问题有哪些典型模式、如何用工具诊断它们、以及有哪些经过验证的优化策略。

---

并发 bug 是最难调试的 bug 之一。它们通常不可稳定复现，出现的时机取决于线程调度的微妙顺序，而且往往在测试环境完全正常、上了生产才暴露。好消息是，并发问题的"症状"其实就那么几种，诊断工具也就那么几把——关键在于你是否知道该看什么、该用什么。

## 11.1 常见并发问题

### 11.1.1 问题全景

| 问题 | 表现 | 根因 | 解决方案 |
|------|------|------|---------|
| **死锁** | 程序卡死，CPU 使用率低 | 多个线程互相等待对方持有的锁 | 统一锁顺序、超时获取 |
| **活锁** | 线程一直运行但没有进展 | 线程不断重试、互相"谦让" | 随机退避、引入优先级 |
| **饥饿** | 某些线程始终得不到执行 | 非公平锁 + 高竞争 | 公平锁、线程优先级调整 |
| **竞态条件** | 结果不确定、时好时坏 | 读写共享状态没有同步 | 加锁、CAS、不可变对象 |

### 11.1.2 死锁（Deadlock）

最经典的并发问题。两个或多个线程互相持有对方需要的锁，谁都无法继续。

```java
public class DeadlockDemo {
    private static final Object lockA = new Object();
    private static final Object lockB = new Object();

    public static void main(String[] args) {
        Thread t1 = new Thread(() -> {
            synchronized (lockA) {
                System.out.println("Thread-1: 持有 lockA，等待 lockB...");
                sleep(100);  // 制造时间窗口
                synchronized (lockB) {
                    System.out.println("Thread-1: 拿到 lockB");
                }
            }
        }, "Thread-1");

        Thread t2 = new Thread(() -> {
            synchronized (lockB) {
                System.out.println("Thread-2: 持有 lockB，等待 lockA...");
                sleep(100);
                synchronized (lockA) {
                    System.out.println("Thread-2: 拿到 lockA");
                }
            }
        }, "Thread-2");

        t1.start();
        t2.start();
        // 两个线程都会卡死——Thread-1 拿着 lockA 等 lockB，
        // Thread-2 拿着 lockB 等 lockA
    }
}
```

### 11.1.3 活锁（Livelock）

线程在运行，但始终没有进展。经典比喻：两个人在走廊迎面走来，都给对方让路，结果同时让到同一边，又同时让到另一边——永远过不去。

```java
// 活锁示例：两个线程互相"谦让"
public class LivelockDemo {
    static Worker worker1 = new Worker("张三", true);
    static Worker worker2 = new Worker("李四", true);

    static class Worker {
        String name;
        boolean active;

        Worker(String name, boolean active) {
            this.name = name;
            this.active = active;
        }

        void work(SharedResource resource, Worker other) {
            while (active) {
                if (resource.getOwner() != this) {
                    // 对方需要资源？我让给你
                    sleep(10);
                    active = other.active;
                    continue;
                }
                // 我有资源，但对方也需要——我"礼貌地"让出
                if (other.active) {
                    resource.setOwner(other);
                    active = false;
                    continue;
                }
                // 终于可以工作了
                System.out.println(name + " 完成工作");
                active = false;
            }
        }
    }
}
```

### 11.1.4 饥饿（Starvation）

低优先级的线程永远得不到 CPU 时间片或锁。常见于非公平锁场景：

```java
// 非公平锁下，新来的线程可能"插队"，导致某些线程永远等不到
ReentrantLock lock = new ReentrantLock(false);  // 非公平锁

// 高竞争场景下，某些线程可能反复被插队
for (int i = 0; i < 10; i++) {
    new Thread(() -> {
        while (true) {
            lock.lock();
            try {
                // 做一些工作
            } finally {
                lock.unlock();
            }
        }
    }, "Worker-" + i).start();
}
// 某些线程可能长时间拿不到锁
```

## 11.2 死锁诊断

### 11.2.1 死锁的四个必要条件

死锁的发生必须同时满足以下四个条件——打破任何一个就能预防死锁：

| 条件 | 含义 | 打破方式 |
|------|------|---------|
| 互斥 | 资源不能被共享 | 使用共享锁（读写锁的读锁） |
| 持有并等待 | 线程持有资源的同时等待其他资源 | 一次性申请所有资源 |
| 不可剥夺 | 已获取的资源不能被强制释放 | 使用 `tryLock` + 超时释放 |
| 循环等待 | 线程形成环形等待链 | **统一锁获取顺序** |

实际开发中，最常用也最有效的策略是**打破循环等待**——所有线程按相同的顺序获取锁。

### 11.2.2 用 jstack 诊断死锁

`jstack` 是 JDK 自带的线程诊断工具，可以获取 JVM 中所有线程的快照（Thread Dump）。

```bash
# 1. 找到 Java 进程 PID
jps
# 输出示例：
# 12345 DeadlockDemo
# 12346 Jps

# 2. 获取线程快照
jstack 12345
```

当 JVM 检测到死锁时，jstack 输出的末尾会有明确提示：

```
Found one Java-level deadlock:
=============================
"Thread-1":
  waiting to lock monitor 0x00007f8b4c003818 (object 0x00000007aab3a0d0, a java.lang.Object),
  which is held by "Thread-2"

"Thread-2":
  waiting to lock monitor 0x00007f8b4c006418 (object 0x00000007aab3a0d8, a java.lang.Object),
  which is held by "Thread-1"

Java stack information for the threads listed above:
===================================================
"Thread-1":
    at DeadlockDemo.lambda$main$0(DeadlockDemo.java:12)
    - waiting to lock <0x00000007aab3a0d8> (a java.lang.Object)
    - locked <0x00000007aab3a0d0> (a java.lang.Object)
"Thread-2":
    at DeadlockDemo.lambda$main$1(DeadlockDemo.java:20)
    - waiting to lock <0x00000007aab3a0d0> (a java.lang.Object)
    - locked <0x00000007aab3a0d8> (a java.lang.Object)

Found 1 deadlock.
```

**关键信息解读**：
- `waiting to lock <地址>`：这个线程在等哪个锁
- `locked <地址>`：这个线程已经持有哪些锁
- 两个线程互相等待对方持有的锁 → 死锁确认

### 11.2.3 编程式死锁检测

除了手动执行 jstack，还可以在代码中主动检测：

```java
// 启用死锁检测（默认关闭，因为有性能开销）
ManagementFactory.getThreadMXBean().setThreadContentionMonitoringEnabled(true);

// 定时检测
ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
scheduler.scheduleAtFixedRate(() -> {
    ThreadMXBean bean = ManagementFactory.getThreadMXBean();
    long[] deadlocked = bean.findDeadlockedThreads();
    if (deadlocked != null) {
        ThreadInfo[] infos = bean.getThreadInfo(deadlocked, true, true);
        for (ThreadInfo info : infos) {
            log.error("Deadlock detected: {}", info);
        }
        // 可以在这里发送告警
    }
}, 5, 10, TimeUnit.SECONDS);
```

## 11.3 Thread Dump 分析

Thread Dump 不只是用来查死锁的——它是并发问题诊断的"X 光片"。

### 11.3.1 获取 Thread Dump

| 方式 | 命令 | 特点 |
|------|------|------|
| jstack | `jstack <pid>` | 最常用，JDK 自带 |
| jcmd | `jcmd <pid> Thread.print` | JDK 8+ 推荐，功能更全 |
| VisualVM | GUI 操作 | 图形化，适合开发环境 |
| kill -3 | `kill -3 <pid>` | 输出到标准输出/日志文件 |
| Arthas | `thread -n 3` | 在线诊断，可按 CPU 排序 |

### 11.3.2 Thread Dump 中的线程状态

```
"main" #1 prio=5 os_prio=0 tid=0x00007f8b4c009800
   nid=0x1234 waiting on condition [0x00007f8b52bf7000]
   java.lang.Thread.State: WAITING (parking)
        at sun.misc.Unsafe.park(Native Method)
        - parking to wait for  <0x00000007aab3a1a0> (a java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject)
        at java.util.concurrent.locks.LockSupport.park(LockSupport.java:175)
        at java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:2039)
        at java.util.concurrent.LinkedBlockingQueue.take(LinkedBlockingQueue.java:442)
        at java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1067)
        at java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1127)
        at java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:617)
        at java.lang.Thread.run(Thread.java:748)
```

**线程状态解读**：

| 状态 | 含义 | 常见原因 |
|------|------|---------|
| `RUNNABLE` | 正在运行或等待 CPU | 正常，或 CPU 密集 |
| `BLOCKED` | 等待获取 synchronized 锁 | **锁竞争严重** |
| `WAITING` | 无限等待（`wait()`、`park()`） | 等待条件、等待任务 |
| `TIMED_WAITING` | 有限等待（`sleep()`、`wait(timeout)`） | 超时等待、空闲线程 |

### 11.3.3 分析模式

拿到 Thread Dump 后，按以下步骤分析：

**第一步：看线程状态分布**

```
假设线程池大小是 200，Thread Dump 显示：
- 150 个 BLOCKED
- 30 个 WAITING
- 15 个 TIMED_WAITING
- 5 个 RUNNABLE

→ 结论：80% 的线程在等锁，锁竞争非常严重
```

**第二步：看 BLOCKED 线程在等什么锁**

```
"pool-1-thread-15" ... BLOCKED
    at com.example.OrderService.createOrder(OrderService.java:42)
    - waiting to lock <0x00000007aab3b020> (a com.example.OrderService)

"pool-1-thread-16" ... BLOCKED
    at com.example.OrderService.createOrder(OrderService.java:42)
    - waiting to lock <0x00000007aab3b020> (a com.example.OrderService)

→ 结论：大量线程卡在 OrderService.createOrder 的同一把锁上
→ 检查该方法的 synchronized 块，考虑减小锁粒度
```

**第三步：看 WAITING 线程在等什么**

```
如果大量线程处于 WAITING 在 LinkedBlockingQueue.take()：
→ 线程池中的空闲线程在等任务，正常

如果大量线程 WAITING 在某个自定义 Condition 上：
→ 检查对应的 signal/signalAll 是否被正确调用
```

## 11.4 锁竞争分析

### 11.4.1 关键指标

| 指标 | 含义 | 获取方式 |
|------|------|---------|
| Blocked Thread Count | 等待获取锁的线程数 | `jcmd`、`jstack` |
| Monitor Contention | synchronized 锁的竞争统计 | JFR（Java Flight Recorder） |
| Lock Wait Time | 线程等待锁的平均时间 | JFR、Arthas |
| Lock Hold Time | 持有锁的时间 | JFR |

### 11.4.2 诊断工具

**JMC（Java Mission Control）+ JFR**

JFR 是 JDK 内置的低开销性能分析工具，可以记录锁竞争事件：

```bash
# 启动 JFR 记录
jcmd <pid> JFR.start duration=60s filename=recording.jfr

# 或者在启动时加入参数
java -XX:StartFlightRecording=duration=60s,filename=recording.jfr MyApp
```

在 JMC 中打开 `recording.jfr`，查看 "Lock Instances" 面板，可以看到：
- 哪些锁竞争最激烈
- 每个锁的等待时间和次数
- 涉及的线程和调用栈

**Arthas**

阿里巴巴开源的 Java 诊断工具，可以在线分析：

```bash
# 查看最忙的线程（按 CPU 使用率排序）
thread -n 3

# 查看 BLOCKED 线程
thread -b

# 监控方法执行耗时
monitor -c 5 com.example.OrderService createOrder
```

`thread -b` 的输出示例：

```
[arthas@12345]$ thread -b
"http-nio-8080-exec-1" Id=45 BLOCKED on com.example.OrderService@7a3d3e4a
    at com.example.OrderService.createOrder(OrderService.java:42)
    - blocked on 1 lock(s)
    - locked by: http-nio-8080-exec-3

"http-nio-8080-exec-3" Id=47 RUNNABLE
    at com.example.OrderService.createOrder(OrderService.java:42)
    - holding 1 lock(s)
```

## 11.5 并发性能优化策略

诊断出问题之后，下一步是优化。以下是六种经过验证的优化策略。

### 11.5.1 减少锁粒度

**思路**：大锁拆小锁，降低锁竞争概率。

**经典案例：ConcurrentHashMap 的进化**

```
Java 7：Segment 分段锁（16 个 Segment = 16 把锁）
┌─────────┬─────────┬─────────┬─────────┐
│Segment 0│Segment 1│Segment 2│Segment 3│  ...共16个
│  Lock 0 │  Lock 1 │  Lock 2 │  Lock 3 │
└─────────┴─────────┴─────────┴─────────┘
不同 Segment 可以并行写，并发度 = 16

Java 8+：CAS + bin 级锁（每个 bin 一把锁）
┌─────┬─────┬─────┬─────┬─────┬─────┐
│bin 0│bin 1│bin 2│bin 3│bin 4│ ... │  共 N 个 bin
└─────┴─────┴─────┴─────┴─────┴─────┘
锁粒度更细，并发度更高（默认 16 个 bin，可扩展）
```

**实战示例**：

```java
// 优化前：一把大锁保护整个 Map
public class NaiveCache<K, V> {
    private final Map<K, V> map = new HashMap<>();
    
    public synchronized V get(K key) {        // 所有操作竞争同一把锁
        return map.get(key);
    }
    public synchronized void put(K key, V v) {
        map.put(key, v);
    }
}

// 优化后：直接用 ConcurrentHashMap（无锁读 + bin 级锁写）
public class BetterCache<K, V> {
    private final ConcurrentHashMap<K, V> map = new ConcurrentHashMap<>();
    
    public V get(K key) { return map.get(key); }     // 无锁
    public void put(K key, V v) { map.put(key, v); } // CAS 或 bin 级锁
}
```

### 11.5.2 无锁设计

**思路**：用 CAS（Compare-And-Swap）替代锁，消除阻塞。

```java
// 优化前：synchronized 计数器（高竞争下性能差）
public class LockedCounter {
    private long count = 0;
    public synchronized void increment() { count++; }
    public synchronized long get() { return count; }
}

// 优化后：AtomicLong（CAS，无阻塞）
public class AtomicCounter {
    private final AtomicLong count = new AtomicLong(0);
    public void increment() { count.incrementAndGet(); }
    public long get() { return get(); }
}

// 进一步优化：LongAdder（高竞争下更优，分段累加）
public class AdderCounter {
    private final LongAdder count = new LongAdder();
    public void increment() { count.increment(); }
    public long get() { return count.sum(); }
}
```

**性能对比**（8 线程并发递增，100 万次）：

| 方案 | 耗时 | 原理 |
|------|------|------|
| `synchronized` | ~450ms | 阻塞等待，串行执行 |
| `AtomicLong` | ~120ms | CAS 重试，无阻塞 |
| `LongAdder` | ~45ms | 分段累加，最后汇总 |

### 11.5.3 读写分离

**思路**：读操作不加锁，写操作加锁。适用于读多写少的场景。

```java
// ReentrantReadWriteLock
ReadWriteLock rwLock = new ReentrantReadWriteLock();

// 读操作：共享锁，可以并发读
public String readData() {
    rwLock.readLock().lock();
    try {
        return data;
    } finally {
        rwLock.readLock().unlock();
    }
}

// 写操作：排他锁，独占
public void writeData(String newData) {
    rwLock.writeLock().lock();
    try {
        data = newData;
    } finally {
        rwLock.writeLock().unlock();
    }
}

// CopyOnWriteArrayList：写时复制，适合读极多写极少
// 写操作会复制整个底层数组，读操作完全无锁
List<String> cowList = new CopyOnWriteArrayList<>();
cowList.add("a");  // 复制数组
String s = cowList.get(0);  // 无锁读
```

**适用场景对比**：

| 方案 | 读性能 | 写性能 | 适用场景 |
|------|--------|--------|---------|
| `synchronized` | 低（都阻塞） | 低 | 读写均衡 |
| `ReadWriteLock` | 高（共享读） | 低（排他写） | 读多写少 |
| `CopyOnWriteArrayList` | 极高（无锁） | 极低（复制数组） | 读极多写极少（如配置、白名单） |

### 11.5.4 批处理

**思路**：减少锁获取次数，合并多次操作为一次。

```java
// 优化前：逐条入库，每条都获取锁
public void saveOrders(List<Order> orders) {
    for (Order order : orders) {
        synchronized (dbLock) {
            insert(order);  // 每次 insert 都要获取锁
        }
    }
    // 1000 条数据，获取锁 1000 次
}

// 优化后：批量入库，一次锁搞定
public void saveOrders(List<Order> orders) {
    synchronized (dbLock) {
        batchInsert(orders);  // 一次获取锁，批量插入
    }
    // 1000 条数据，获取锁 1 次
}

// 进一步优化：攒批 + 异步
public class BatchWriter {
    private final BlockingQueue<Order> queue = new LinkedBlockingQueue<>(10000);
    
    public void add(Order order) {
        queue.offer(order);  // 无锁入队
    }
    
    // 后台线程定时批量写入
    @Scheduled(fixedRate = 100)
    public void flush() {
        List<Order> batch = new ArrayList<>();
        queue.drainTo(batch, 500);  // 一次取最多 500 条
        if (!batch.isEmpty()) {
            batchInsert(batch);
        }
    }
}
```

### 11.5.5 异步化

**思路**：解耦请求与处理，用线程池或消息队列削峰。

```java
// 优化前：同步处理，用户等待所有步骤完成
public OrderResult createOrder(OrderRequest req) {
    validate(req);           // 10ms
    saveToDB(req);           // 50ms
    sendNotification(req);   // 200ms ← 调用外部服务
    updateInventory(req);    // 30ms
    return new OrderResult();
    // 总耗时：~290ms，用户全部等完
}

// 优化后：核心路径同步，非核心异步
public OrderResult createOrder(OrderRequest req) {
    validate(req);           // 10ms
    saveToDB(req);           // 50ms
    // 非核心操作异步化
    CompletableFuture.runAsync(() -> sendNotification(req), notifyExecutor);
    CompletableFuture.runAsync(() -> updateInventory(req), inventoryExecutor);
    return new OrderResult();
    // 总耗时：~60ms，用户快速得到响应
}
```

### 11.5.6 策略总览

| 策略 | 核心思路 | 适用场景 | 示例 |
|------|---------|---------|------|
| 减少锁粒度 | 大锁拆小锁 | Map/Set 高并发读写 | ConcurrentHashMap |
| 无锁设计 | CAS 替代锁 | 计数器、累加器 | AtomicLong → LongAdder |
| 读写分离 | 读不加锁，写加锁 | 读多写少 | ReadWriteLock、COW |
| 批处理 | 合并操作减少锁次数 | 批量写入 | 批量 SQL、攒批队列 |
| 异步化 | 解耦请求与处理 | 耗时非核心操作 | CompletableFuture、MQ |

## 11.6 并发编程最佳实践总结

经过前面 10 章的深入学习，这里总结出一组经过实践验证的并发编程原则。它们不是银弹，但遵守它们可以帮你避开大多数坑。

### 11.6.1 最小化共享状态

```java
// 坏：多个方法共享可变状态
public class OrderService {
    private List<Order> recentOrders = new ArrayList<>();  // 共享可变状态
    
    public void addOrder(Order o) { recentOrders.add(o); }        // 竞态
    public List<Order> getRecent() { return recentOrders; }        // 竞态
}

// 好：用不可变副本，状态变更通过原子引用
public class OrderService {
    private final AtomicReference<List<Order>> recentOrders = 
        new AtomicReference<>(List.of());
    
    public void addOrder(Order o) {
        recentOrders.updateAndGet(current -> {
            List<Order> newList = new ArrayList<>(current);
            newList.add(o);
            return Collections.unmodifiableList(newList);
        });
    }
    
    public List<Order> getRecent() {
        return recentOrders.get();  // 不可变列表，安全
    }
}
```

### 11.6.2 优先使用不可变对象

```java
// 不可变对象天然线程安全，不需要任何同步
public record Point(int x, int y) {
    // 所有字段 final，没有 setter，创建后不能修改
}

// 不可变集合
List<String> safeList = List.of("a", "b", "c");  // 不可变
Map<String, Integer> safeMap = Map.of("key", 42);  // 不可变
```

### 11.6.3 使用高层并发工具

```java
// 避免直接使用 wait/notify，用高层工具替代
// ✅ BlockingQueue（生产者-消费者）
BlockingQueue<Task> queue = new LinkedBlockingQueue<>();

// ✅ CountDownLatch（等待 N 个任务完成）
CountDownLatch latch = new CountDownLatch(3);

// ✅ CyclicBarrier（N 个线程互相等待）
CyclicBarrier barrier = new CyclicBarrier(3);

// ✅ Semaphore（限制并发数）
Semaphore semaphore = new Semaphore(10);

// ✅ CompletableFuture（异步编排）
CompletableFuture.supplyAsync(() -> query());
```

### 11.6.4 线程命名

```java
// 坏：线程名字是 "pool-1-thread-3"，出了问题根本不知道是哪个业务
executor.submit(() -> doSomething());

// 好：给线程起有意义的名字
ThreadFactory namedFactory = new ThreadFactory() {
    private final AtomicInteger counter = new AtomicInteger(0);
    @Override
    public Thread newThread(Runnable r) {
        return new Thread(r, "order-processor-" + counter.incrementAndGet());
    }
};
ExecutorService executor = Executors.newFixedThreadPool(10, namedFactory);
```

### 11.6.5 线程隔离

```java
// 不同业务使用不同的线程池，避免互相影响
// 如果所有业务共享一个线程池，一个慢操作会拖垮所有业务
ExecutorService orderExecutor = Executors.newFixedThreadPool(10,
    new ThreadFactoryBuilder().setNameFormat("order-%d").build());

ExecutorService notifyExecutor = Executors.newFixedThreadPool(5,
    new ThreadFactoryBuilder().setNameFormat("notify-%d").build());

ExecutorService reportExecutor = Executors.newFixedThreadPool(3,
    new ThreadFactoryBuilder().setNameFormat("report-%d").build());
// 订单处理慢了，不会影响通知和报表
```

### 11.6.6 超时保护

```java
// 坏：没有超时，线程可能永远卡住
lock.lock();
future.get();
connection.execute(query);

// 好：所有可能阻塞的操作都加超时
if (lock.tryLock(5, TimeUnit.SECONDS)) {
    try {
        doWork();
    } finally {
        lock.unlock();
    }
} else {
    throw new TimeoutException("获取锁超时");
}

future.get(3, TimeUnit.SECONDS);

// 数据库连接池、HTTP 客户端等都要配置超时
```

## 11.6 虚拟线程的诊断注意事项

第 2 章介绍了虚拟线程，第 10 章也提到了它。但诊断工具和方法完全是基于传统平台线程的——虚拟线程有一些独特的坑。

### Pinning：虚拟线程最常见的性能问题

虚拟线程在 `synchronized` 块中执行阻塞操作时，不会从平台线程上卸载（unmount），导致平台线程被"钉住"（pinned）。这叫 **Pinning**。

```java
// ❌ 会导致 Pinning
synchronized (lock) {
    httpClient.get(url);  // 阻塞 IO
    // 虚拟线程被钉在平台线程上，无法卸载
    // 平台线程被占住，其他虚拟线程无法使用它
}
```

Pinning 的后果：平台线程被占住，其他虚拟线程无法调度，系统吞吐量骤降。严重时，所有平台线程都被钉住，虚拟线程退化为平台线程。

**检测方法**：

```bash
# 启动时加参数，检测 Pinning
-Djdk.tracePinnedThreads=full

# 输出示例：
# Thread[#22,ForkJoinPool-1-worker-3,5,CarrierThreads]
#     java.lang.VirtualThread.parkOnCarrier(VirtualThread.java:715)
#     ...
#     at com.example.MyService.doWork(MyService.java:42)
#     - locked <0x00000007aab3a0d0> (a java.lang.Object)  ← synchronized 持有锁
#     at com.example.MyService.process(MyService.java:35)
```

**解决方案**：用 `ReentrantLock` 替代 `synchronized`。

```java
// ✅ ReentrantLock 不会导致 Pinning
ReentrantLock lock = new ReentrantLock();
lock.lock();
try {
    httpClient.get(url);  // 阻塞 IO，虚拟线程可以正常卸载
} finally {
    lock.unlock();
}
```

为什么 `ReentrantLock` 不会 Pinning？因为 JVM 对 `ReentrantLock` 做了特殊优化——它知道 `ReentrantLock` 的锁操作可以通过 `unpark` 协议解除，不需要持有平台线程。

### 虚拟线程下的 jstack

虚拟线程在 jstack 输出中的表示方式与平台线程不同：

```
// 平台线程（有完整的线程栈）
"http-nio-8080-exec-1" #15 daemon prio=5 os_prio=0
   java.lang.Thread.State: RUNNABLE
    at com.example.Controller.handle(Controller.java:20)

// 虚拟线程（挂载在平台线程上）
"unnamed" #22 daemon prio=5
   java.lang.Thread.State: TIMED_WAITING
    at java.lang.VirtualThread.parkOnCarrier(VirtualThread.java:715)
    ...
```

虚拟线程数量可能成千上万，jstack 输出会非常长。用 `jcmd <pid> Thread.dump_to_file -format=json threads.json` 可以导出为文件，便于分析。

### ThreadMXBean 的限制

`ThreadMXBean` 对虚拟线程的支持有限——`getThreadCount()` 不包含虚拟线程，`getThreadInfo()` 对虚拟线程返回的信息不完整。监控虚拟线程需要用 JFR 或 Arthas 等工具。

### 更多 Pinning 场景

除了 `synchronized` 块中的阻塞操作，以下场景也会导致 Pinning：

| 场景 | 原因 | 解决方案 |
|------|------|----------|
| `synchronized` + 阻塞 IO | JVM 无法在 synchronized 块中卸载虚拟线程 | 用 `ReentrantLock` 替代 |
| `synchronized` + `Thread.sleep()` | sleep 也是阻塞操作 | 用 `ReentrantLock` 或移出 synchronized 块 |
| JNI 调用中的阻塞 | 本地代码中的阻塞无法被 JVM 感知 | 将 JNI 调用放到独立的平台线程池中 |

```java
// ❌ JNI 调用中的阻塞也会 Pinning
synchronized (lock) {
    nativeLibrary.blockingCall();  // 本地代码阻塞，虚拟线程被钉住
}

// ✅ 将 JNI 调用移到独立的平台线程池
ExecutorService nativePool = Executors.newFixedThreadPool(4);
nativePool.submit(() -> nativeLibrary.blockingCall());
```

### JFR 检测 Pinning

JDK Flight Recorder 可以记录 Pinning 事件，适合生产环境的持续监控：

```bash
# 方式一：使用预置配置文件启动 JFR 记录
jcmd <pid> JFR.start settings=profile filename=pinning.jfr duration=60s

# 方式二：启动时开启 JFR
java -XX:StartFlightRecording=settings=profile,duration=60s,filename=pinning.jfr MyApp

# 方式三：仅记录 Pinning 事件（更轻量）
jcmd <pid> JFR.start filename=pinning.jfr duration=60s \
  jdk.VirtualThreadPinned#enabled=true
```

JFR 记录的 `jdk.VirtualThreadPinned` 事件包含：
- Pinning 发生的时间
- 持续时间
- 涉及的锁对象
- 完整的线程栈

在 JMC（Java Mission Control）中打开记录文件，搜索 "VirtualThreadPinned" 事件即可定位问题。

### 虚拟线程的最佳实践

| 实践 | 说明 |
|------|------|
| 避免在 synchronized 中做 IO | 用 `ReentrantLock` 替代 synchronized |
| 不要池化虚拟线程 | 虚拟线程设计为每个任务一个，不需要池化 |
| 为阻塞操作设置超时 | 避免虚拟线程永久阻塞 |
| 使用 Semaphore 限制并发 | 替代线程池来限制资源访问并发数 |
| 监控 Pinning 事件 | 生产环境开启 JFR 持续监控 |
| 不要用于 CPU 密集型任务 | 虚拟线程的优势在 IO 等待，CPU 密集用平台线程 |

```java
// ✅ 用 Semaphore 限制数据库连接并发（替代线程池）
Semaphore dbLimiter = new Semaphore(20);  // 最多 20 个并发数据库查询

try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    for (int i = 0; i < 100_000; i++) {
        executor.submit(() -> {
            dbLimiter.acquire();  // 限制并发
            try {
                return queryDB();
            } finally {
                dbLimiter.release();
            }
        });
    }
}
```

---

**最佳实践速查表**：

| 原则 | 要点 | 违反后果 |
|------|------|---------|
| 最小化共享 | 能不共享就不共享 | 竞态条件、难以调试 |
| 不可变优先 | 用 `record`、`final`、不可变集合 | 状态被意外修改 |
| 高层工具 | 用 `BlockingQueue` 而非 `wait/notify` | 容易写出有 bug 的同步代码 |
| 线程命名 | 给每个线程池起有意义的名字 | 线上排查时一团迷雾 |
| 线程隔离 | 不同业务用不同线程池 | 一个慢操作拖垮全局 |
| 超时保护 | 所有阻塞操作都加超时 | 线程永久挂起、资源耗尽 |

---

> **纵横联系**
>
> 本章的 jstack、jcmd、JFR 等诊断工具在第二卷《JVM Runtime》第 6 章中有介绍，包括 JVM 参数调优和 GC 日志分析。线程状态（BLOCKED、WAITING）的底层实现在第 2 章"线程模型"中已经讲解。CAS 操作的硬件基础（CPU 的 cmpxchg 指令）在第 7 章"原子类与 CAS"中有涉及。而"异步化"策略中提到的 CompletableFuture，正是上一章的核心内容。并发优化不是一个孤立的话题——它需要你理解 JMM、线程模型、锁实现，才能做出正确的判断。
