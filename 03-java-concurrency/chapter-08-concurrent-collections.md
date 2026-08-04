# 第8章 并发集合：高性能数据结构

> 当多个线程同时读写同一个集合时，会发生什么？为什么 `HashMap` 在并发场景下可能让 CPU 跑满？`ConcurrentHashMap` 从 JDK 7 到 JDK 8 的锁结构发生了怎样的演进？有没有一种集合，读完全不加锁？本章从问题出发，逐层拆解 Java 并发集合的设计哲学与工程取舍。

---

## 8.1 普通集合为什么不能并发使用

Java 标准库中的 `ArrayList`、`HashMap` 等集合**没有任何线程安全保证**。它们的文档明确写道："If multiple threads access an ArrayList instance concurrently, and at least one of the threads modifies the list structurally, it must be synchronized externally." 这不是建议，是生死线。

### 8.1.1 ArrayList 的并发灾难

`ArrayList.add()` 的核心逻辑看似简单：

```java
public boolean add(E e) {
    ensureCapacityInternal(size + 1);  // 步骤1：检查容量
    elementData[size++] = e;            // 步骤2：赋值并递增 size
    return true;
}
```

问题在于 `size++` 不是原子操作，它实际上是三步：读取 size → 加1 → 写回 size。两个线程同时执行时：

```
线程A: 读取 size=5
线程B: 读取 size=5          ← 还没等A写回，B也读到了5
线程A: size=6, elementData[5]=eA
线程B: size=6, elementData[5]=eB  ← 覆盖了A的元素！
```

**后果**：元素丢失（两个线程写同一位置），或者 `size` 实际指向越界位置导致后续 `ArrayIndexOutOfBoundsException`。

更隐蔽的问题是**可见性**。即使没有写冲突，一个线程的写入对另一个线程可能根本不可见——因为没有内存屏障，CPU 缓存中的旧值不会被刷新。

### 8.1.2 HashMap 的死循环（JDK 7）

JDK 7 的 `HashMap` 在并发场景下有一个臭名昭著的 bug：**扩容时可能形成环形链表，导致 `get()` 死循环，CPU 100%**。

原因在于 JDK 7 使用**头插法**迁移链表节点：

```
扩容前线性链表: A → B → null

线程1 正在迁移，先处理 A，再处理 B（头插法）
线程2 同时迁移，也处理了 A 和 B，但顺序相反

结果形成了: B.next = A, A.next = B  ← 环形链表！
```

用图示说明：

```
正常扩容（单线程）:
  旧桶: A → B → null
  新桶（头插法）: B → A → null

并发扩容（JDK 7 头插法）:
  线程1: 迁移 A, B → 新桶: B → A
  线程2: 迁移 A, B → 新桶: A → B
  如果两个线程的结果交叉引用:
    A.next = B
    B.next = A  ← get("key") 进入死循环
```

**JDK 8 的修复**：改用**尾插法**，保持链表原有顺序，从根源上避免了环形链表。但请注意：**JDK 8 的 HashMap 仍然不是线程安全的**，只是不会死循环了，数据丢失依然存在。

### 8.1.3 问题总结

| 集合类 | 并发问题 | 根因 |
|--------|----------|------|
| ArrayList | 元素丢失、越界异常 | `size++` 非原子 |
| HashMap (JDK 7) | 死循环、数据丢失 | 头插法 + 非原子扩容 |
| HashMap (JDK 8) | 数据丢失 | put 操作无同步 |
| HashSet | 同 HashMap（底层是 HashMap） | 同上 |
| TreeMap | 数据丢失、红黑树结构破坏 | 并发修改导致树失衡 |

**结论**：普通集合在多线程环境下使用，必须外部同步。但粗粒度的全局锁（如 `Collections.synchronizedMap()`）会严重限制并发度。这就是并发集合存在的意义。

---

## 8.2 ConcurrentHashMap

`ConcurrentHashMap` 是 Java 并发编程中使用频率最高的数据结构之一。它在保证线程安全的前提下，尽可能地提高了并发读写的吞吐量。从 JDK 7 到 JDK 8，它的实现经历了一次根本性的重构。

### 8.2.1 JDK 7：Segment 分段锁

JDK 7 的设计思想是**分段锁（Striped Locking）**——将整个 Map 分成若干段（Segment），每段独立加锁，不同段的操作可以并行。

```
ConcurrentHashMap（JDK 7）
├── Segment[0] (ReentrantLock) → HashEntry[] → 链表
├── Segment[1] (ReentrantLock) → HashEntry[] → 链表
├── Segment[2] (ReentrantLock) → HashEntry[] → 链表
├── ...
└── Segment[15] (ReentrantLock) → HashEntry[] → 链表
    └── 默认 16 个 Segment，并发度 = 16
```

核心结构：

```java
// JDK 7 简化结构
static final class Segment<K,V> extends ReentrantLock {
    transient HashEntry<K,V>[] table;
    transient int count;
}

// ConcurrentHashMap 本身
final Segment<K,V>[] segments;  // 默认长度 16
```

**定位过程**：先通过 hash 的高 4 位定位 Segment，再通过剩余 hash 位定位桶（HashEntry）。两次 hash，两级定位。

**优点**：不同 Segment 的操作完全并行，读操作不加锁（通过 volatile 保证可见性）。

**缺点**：并发度受 Segment 数量限制（默认 16，构造后不可变）。即使只有两个 Segment 被访问，并发度也只有 16。对于热点 key 集中在少数 Segment 的场景，退化为全局锁。

### 8.2.2 JDK 8：CAS + synchronized

JDK 8 彻底抛弃了 Segment，回归到**单个 Node 数组 + 桶级别锁**的设计：

```
ConcurrentHashMap（JDK 8）
├── Node[] table（类似 HashMap 的 table）
│   ├── [0] → Node → Node → Node（链表）
│   ├── [1] → null
│   ├── [2] → TreeBin → TreeNode...（红黑树，链表长度>8 时转化）
│   ├── [3] → Node
│   └── ...
└── 锁粒度：单个桶（bin），而非整个 Segment
```

put 操作的核心逻辑：

```java
final V putVal(K key, V value, boolean onlyIfAbsent) {
    for (Node<K,V>[] tab = table;;) {
        Node<K,V> f; int n, i, fh;
        if (tab == null || (n = tab.length) == 0)
            tab = initTable();  // CAS 初始化
        else if ((f = tabAt(tab, i = (n - 1) & hash)) == null) {
            // 桶为空，CAS 直接插入，无需加锁
            if (casTabAt(tab, i, null, new Node<>(hash, key, value)))
                break;
        } else {
            // 桶非空，synchronized 锁住桶的头节点
            synchronized (f) {
                // 链表或红黑树的插入逻辑
            }
        }
    }
}
```

**关键改进**：

| 对比维度 | JDK 7 Segment | JDK 8 CAS+synchronized |
|----------|---------------|------------------------|
| 锁粒度 | Segment（默认16个） | 单个桶（bin） |
| 并发度 | 最多 16 | 等于桶数量（通常数千） |
| 空桶操作 | 需要锁 | CAS 无锁 |
| 数据结构 | 链表 | 链表 + 红黑树（>8 转树） |
| 锁实现 | ReentrantLock | synchronized |

### 8.2.3 为什么 JDK 8 放弃了分段锁

这个问题值得深入思考。放弃分段锁不是退步，而是**锁优化技术演进**的结果：

1. **synchronized 的性能逆袭**：JDK 6 引入了偏向锁、轻量级锁、锁膨胀、锁消除等一系列优化。在无竞争时，synchronized 的开销几乎为零（偏向锁只需一次 CAS）。这使得 synchronized 与 ReentrantLock 的性能差距大幅缩小。

2. **粒度更细 = 并发更高**：Segment 的粒度太粗。一个 Segment 包含多个桶，锁住一个 Segment 会阻塞同一 Segment 下所有桶的访问。JDK 8 的桶级锁将粒度缩小了一个数量级。

3. **内存开销**：每个 Segment 对象都有独立的锁状态、等待队列等元数据。在 Map 数量很大时，这些开销不可忽视。

4. **代码简洁性**：Segment 的存在让整个数据结构变得复杂，调试和维护成本高。

### 8.2.4 size() 的实现：分散计数

并发环境下，精确计数的代价很高。JDK 8 使用了**baseCount + CounterCell[]** 的分散计数方案（与 `LongAdder` 的思路一致）：

```java
// 简化理解
long baseCount;              // 基础计数
CounterCell[] counterCells;  // 分散计数单元

// 计算总数
public int size() {
    long sum = baseCount;
    if (counterCells != null) {
        for (CounterCell cell : counterCells) {
            if (cell != null)
                sum += cell.value;
        }
    }
    return (sum < 0) ? 0 : (sum > Integer.MAX_VALUE) ? Integer.MAX_VALUE : (int) sum;
}
```

**为什么不用一个 volatile long？** 因为多线程同时 CAS 同一个变量会导致大量冲突。分散到不同的 CounterCell 上，每个线程操作自己的 Cell，最后汇总，冲突概率大幅降低。

---

## 8.3 CopyOnWrite 容器

### 8.3.1 核心思想：写时复制

`CopyOnWriteArrayList` 和 `CopyOnWriteArraySet` 的设计哲学是：**读操作完全无锁，写操作通过复制整个底层数组来实现隔离**。

写操作的流程：

```
当前数组: [A, B, C, D]  (array 指向这里)
                    │
    线程T1 执行 add(E)
                    │
                    ▼
步骤1: 复制数组 → [A, B, C, D, null]  (newArray)
步骤2: 在新数组上修改 → [A, B, C, D, E]
步骤3: array = newArray  (volatile 写，保证可见性)
```

核心代码（简化）：

```java
public class CopyOnWriteArrayList<E> {
    private transient volatile Object[] array;

    public boolean add(E e) {
        synchronized (lock) {  // 写操作需要同步（写-写互斥）
            Object[] oldArray = array;
            int len = oldArray.length;
            Object[] newArray = Arrays.copyOf(oldArray, len + 1);
            newArray[len] = e;
            array = newArray;  // volatile 写，读线程立即可见
            return true;
        }
    }

    public E get(int index) {
        // 无锁！直接读当前数组引用
        return (E) array[index];
    }
}
```

### 8.3.2 读写分离的代价

| 维度 | 优势 | 代价 |
|------|------|------|
| 读操作 | 完全无锁，性能极高 | 可能读到旧数据（弱一致性） |
| 写操作 | 读写不互斥 | 每次写都复制整个数组，内存开销大 |
| 迭代器 | 快照迭代，不会 ConcurrentModificationException | 迭代的是旧数据 |

**弱一致性示例**：

```java
CopyOnWriteArrayList<String> list = new CopyOnWriteArrayList<>();
list.add("A");
list.add("B");

// 线程1: 遍历
for (String s : list) {
    System.out.println(s);
    // 此时线程2 执行了 add("C")
    // 线程1 仍然只看到 [A, B]，不会看到 "C"
    // 因为迭代器持有的是 add 之前的数组快照
}
```

### 8.3.3 适用场景

**适合**：读远多于写的场景，如配置信息、事件监听器列表、路由表等。

**不适合**：写频繁的场景（每次写都复制数组，O(n) 时间和空间），也不适合需要实时一致性的场景。

```java
// 典型用法：事件监听器管理
public class EventBus {
    private final CopyOnWriteArrayList<Listener> listeners = new CopyOnWriteArrayList<>();

    public void register(Listener l) {
        listeners.add(l);  // 写操作少，可以接受复制代价
    }

    public void fireEvent(Event e) {
        for (Listener l : listeners) {  // 读操作多，无锁高并发
            l.onEvent(e);
        }
    }
}
```

---

## 8.4 BlockingQueue：生产者-消费者模型的基础设施

`BlockingQueue` 是 Java 并发包中最实用的接口之一。它的核心语义：**队列满时 put 阻塞，队列空时 take 阻塞**。天然适合生产者-消费者模式。

### 8.4.1 接口定义

```java
public interface BlockingQueue<E> extends Queue<E> {
    // 阻塞操作
    void put(E e) throws InterruptedException;       // 队列满则等待
    E take() throws InterruptedException;             // 队列空则等待

    // 超时操作
    boolean offer(E e, long timeout, TimeUnit unit) throws InterruptedException;
    E poll(long timeout, TimeUnit unit) throws InterruptedException;

    // 非阻塞操作
    boolean offer(E e);   // 队列满则返回 false
    E poll();             // 队列空则返回 null
}
```

### 8.4.2 核心实现对比

#### ArrayBlockingQueue：有界数组

```java
public class ArrayBlockingQueue<E> extends AbstractQueue<E> {
    final Object[] items;     // 定长数组
    int takeIndex;            // 取元素的位置
    int putIndex;             // 放元素的位置
    int count;                // 当前元素数量
    final ReentrantLock lock; // 只有一把锁！
    private final Condition notEmpty;  // 队列非空条件
    private final Condition notFull;   // 队列未满条件
}
```

**特点**：一把锁同时保护 put 和 take，put 和 take 不能并行。简单但并发度有限。

#### LinkedBlockingQueue：可选有界链表

```java
public class LinkedBlockingQueue<E> extends AbstractQueue<E> {
    private final AtomicInteger count = new AtomicInteger(0);
    transient Node<E> head;   // 虚拟头节点
    private transient Node<E> tail;

    // 两把锁！put 和 take 分离
    final ReentrantLock takeLock = new ReentrantLock();
    private final Condition notEmpty;
    final ReentrantLock putLock = new ReentrantLock();
    private final Condition notFull;
}
```

**特点**：put 和 take 使用不同的锁，两者可以并行。默认容量 `Integer.MAX_VALUE`（实质无界，小心 OOM）。

#### SynchronousQueue：直接交接

没有容量，不存储元素。每个 `put` 必须等待一个 `take`，反之亦然。线程之间直接传递数据。

```java
// 线程1
queue.put("data");    // 阻塞，直到有线程 take

// 线程2
String s = queue.take();  // 阻塞，直到有线程 put
// 两个线程"握手"完成，数据从线程1直接传递到线程2
```

#### PriorityBlockingQueue：无界优先级

基于优先级堆（数组实现），元素按自然顺序或 Comparator 排序。put 永不阻塞（无界），take 在空时阻塞。

#### DelayQueue：延时出队

元素必须实现 `Delayed` 接口。只有当元素的延时到期后，才能被 take 取出。典型应用：缓存过期、任务调度。

```java
public class CacheEntry implements Delayed {
    private final long expireTime;  // 过期时间戳

    public long getDelay(TimeUnit unit) {
        return unit.convert(expireTime - System.currentTimeMillis(), TimeUnit.MILLISECONDS);
    }

    public int compareTo(Delayed other) {
        return Long.compare(this.getDelay(TimeUnit.NANOSECONDS),
                           other.getDelay(TimeUnit.NANOSECONDS));
    }
}
```

### 8.4.3 实现对比总结

| 实现类 | 边界 | 底层结构 | 锁机制 | put 阻塞 | take 阻塞 | 典型场景 |
|--------|------|----------|--------|----------|-----------|----------|
| ArrayBlockingQueue | 有界 | 数组 | 1 把锁 | 满时阻塞 | 空时阻塞 | 通用有界队列 |
| LinkedBlockingQueue | 可选有界 | 单向链表 | 2 把锁 | 满时阻塞 | 空时阻塞 | 高吞吐生产者-消费者 |
| SynchronousQueue | 0 | 无存储 | CAS/锁 | 等待 take | 等待 put | 线程直接交接 |
| PriorityBlockingQueue | 无界 | 数组堆 | 1 把锁 | 不阻塞 | 空时阻塞 | 优先级任务调度 |
| DelayQueue | 无界 | PriorityQueue | 1 把锁 | 不阻塞 | 未到期阻塞 | 缓存过期、定时任务 |

### 8.4.4 生产者-消费者示例

```java
public class ProducerConsumerDemo {
    public static void main(String[] args) {
        BlockingQueue<Task> queue = new ArrayBlockingQueue<>(100);

        // 生产者
        ExecutorService producers = Executors.newFixedThreadPool(3);
        for (int i = 0; i < 3; i++) {
            producers.submit(() -> {
                while (!Thread.currentThread().isInterrupted()) {
                    Task task = createTask();
                    queue.put(task);  // 队列满时自动阻塞
                }
            });
        }

        // 消费者
        ExecutorService consumers = Executors.newFixedThreadPool(5);
        for (int i = 0; i < 5; i++) {
            consumers.submit(() -> {
                while (!Thread.currentThread().isInterrupted()) {
                    Task task = queue.take();  // 队列空时自动阻塞
                    process(task);
                }
            });
        }
    }
}
```

`BlockingQueue` 让生产者-消费者模式的实现变得简洁而安全——阻塞语义替代了手动的 `wait/notify`，`Interrupted` 支持替代了复杂的取消逻辑。

---

## 8.5 小结

并发集合的设计本质上是在**安全性、并发度、内存开销**三者之间做取舍：

```
                    安全性
                   /      \
                  /        \
           并发度 ———————— 内存开销
```

- `ConcurrentHashMap`：追求并发度，通过细粒度锁和 CAS 实现高吞吐
- `CopyOnWriteArrayList`：追求读并发，以写时复制的内存代价换取读无锁
- `BlockingQueue`：追求正确性，用阻塞语义简化生产者-消费者模型
- `Collections.synchronizedXxx`：最简单的安全方案，但并发度最低

选择哪种方案，取决于你的读写比例、一致性要求和性能目标。没有银弹，只有权衡。

---

> **纵横联系**
>
> - 本章的 `ConcurrentHashMap` 使用了 CAS 操作和 `volatile` 语义，这些基础概念在第5章《内存模型与 happens-before》中有深入讲解
> - `CopyOnWriteArrayList` 的弱一致性与 Java 内存模型的可见性保证直接相关，理解 happens-before 规则有助于理解其迭代器行为
> - `BlockingQueue` 是线程池（第9章）的内部核心组件——`ThreadPoolExecutor` 的工作队列就是 `BlockingQueue`
> - `ConcurrentHashMap` 的 `CounterCell` 分散计数思想与 `LongAdder`（第6章并发工具类）完全一致，它们共享同一套代码
> - 在第二卷《集合框架》中，我们详细分析了 `HashMap` 和 `ArrayList` 的内部结构，本章是在此基础上理解并发变体的关键前置知识
