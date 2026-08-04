# 第三章 对象模型

> 很多 JVM 书弱化这一部分，但它极其重要。本章覆盖对象的创建、内存布局、Mark Word、TLAB 和逃逸分析，直接连接后续的 GC、JIT 和并发章节。

---

## 3.1 new 一个对象发生了什么

```java
User user = new User();
```

JVM 执行的操作：

```
1. 检查 User 类是否已加载
   └─ 没有？先执行类加载（第一章）

2. 在堆上分配内存
   ├─ 指针碰撞（Bump the Pointer）：内存规整时，指针向后移动
   └─ 空闲列表（Free List）：内存不规整时，从列表中找合适的空闲块

3. 初始化零值
   └─ 所有字段设为默认值（int=0, boolean=false, 引用=null）
   └─ 这就是为什么不赋初值也能使用字段

4. 设置对象头
   └─ Mark Word + Klass Pointer

5. 执行 <init> 构造方法
   └─ 你写的构造函数代码
```

步骤 3 保证了 Java 的安全特性——字段在使用前一定有确定的值，不会读到脏数据。

---

## 3.2 对象内存布局

HotSpot JVM 中，一个 Java 对象在堆中的结构：

```
┌──────────────────┐
│     对象头        │
│  ├─ Mark Word     │  8 字节（64 位 JVM）
│  └─ Klass Pointer │  4 或 8 字节（压缩指针开启时 4 字节）
├──────────────────┤
│     实例数据      │  各个字段的值（父类字段在前，子类在后）
├──────────────────┤
│     对齐填充      │  保证对象大小是 8 字节的整数倍
└──────────────────┘
```

### Mark Word

Mark Word 是对象头的核心，存储了：

- **hashCode**：对象的哈希码（首次调用 `hashCode()` 时计算并存储）
- **GC 年龄**：对象经历的 Minor GC 次数（达到阈值晋升老年代）
- **锁状态**：无锁、偏向锁、轻量级锁、重量级锁

### Klass Pointer

指向方法区中该类的元数据。JVM 通过 Klass Pointer 知道"这个对象是哪个类的实例"。

开启压缩指针（`-XX:+UseCompressedOops`，64 位 JVM 默认开启）时，Klass Pointer 只占 4 字节。

---

## 3.3 Mark Word 与锁状态

Mark Word 不是固定不变的。当对象被同步操作时，Mark Word 的内容会根据锁状态变化：

| 锁状态 | Mark Word 内容 | 标志位 |
|--------|---------------|--------|
| 无锁 | hashCode + 分代年龄 | 01 |
| 偏向锁 | ThreadID + Epoch + 分代年龄 | 01 |
| 轻量级锁 | 指向栈中锁记录的指针 | 00 |
| 重量级锁 | 指向 Monitor 的指针 | 10 |
| GC 标记 | 空 | 11 |

这是第三卷 `synchronized` 锁升级机制的关键前置知识。锁升级的过程就是 Mark Word 内容不断变化的过程：

```
无锁 → 偏向锁（同一线程反复获取）
     → 轻量级锁（CAS 竞争失败但自旋可期）
     → 重量级锁（自旋超时，依赖 OS Mutex）
```

### Monitor（监视器）

当锁升级到重量级锁时，Mark Word 中存储的是指向 **Monitor** 对象的指针。Monitor 是 JVM 实现互斥同步的底层数据结构，每个 Java 对象都可以关联一个 Monitor：

```
┌─────────────────────────────────┐
│          Object Monitor         │
│                                 │
│  _owner: Thread   (持有锁的线程) │
│  _count: int      (重入次数)     │
│  _EntryList: [Thread...]        │
│             (等待获取锁的线程队列) │
│  _WaitSet: [Thread...]          │
│            (调用了 wait() 的线程) │
└─────────────────────────────────┘
```

工作流程：
1. **获取锁**（monitorenter）：如果 `_owner` 为空，当前线程成为 `_owner`，`_count` 设为 1。如果已经是 `_owner`，`_count++`（可重入）。
2. **释放锁**（monitorexit）：`_count--`。当 `_count` 为 0 时，释放 Monitor，`_EntryList` 中的一个线程被唤醒。
3. **等待/通知**（wait/notify）：线程调用 `wait()` 后进入 `_WaitSet` 并释放 Monitor。`notify()` 从 `_WaitSet` 唤醒一个线程，该线程需重新竞争 Monitor。

Monitor 是重量级的数据结构，依赖操作系统的 Mutex 实现。这就是为什么 JVM 默认不直接使用它，而是先尝试偏向锁和轻量级锁——只有在竞争激烈时才升级到重量级锁。第三卷 `synchronized` 章节会详细展开锁升级的完整过程。

---

## 3.4 TLAB（线程本地分配缓冲）

多线程环境下，多个线程同时在 Eden 区分配对象需要同步。TLAB 解决了这个问题：

- 每个线程在 Eden 区有一块**私有缓冲区**
- TLAB 内分配只需要移动指针，**无需 CAS**
- TLAB 用完才需要同步申请新缓冲区

```
Eden 区
├── TLAB for Thread A  [已用: 3KB / 总共: 8KB]
├── TLAB for Thread B  [已用: 1KB / 总共: 8KB]
└── TLAB for Thread C  [已用: 5KB / 总共: 8KB]
```

`-XX:+UseTLAB` 默认开启。这就是为什么 Java 多线程创建对象这么快——大部分情况下不需要真正的同步。

---

## 3.5 逃逸分析

逃逸分析是 JIT 编译器的一种分析技术，判断对象是否"逃逸"出方法或线程的范围。

### 什么是逃逸

```java
// 未逃逸：对象只在方法内部使用
public void process() {
    User user = new User("Tom");  // user 不会离开这个方法
    System.out.println(user.getName());
}

// 逃逸：对象被外部引用
public User createUser() {
    User user = new User("Tom");
    return user;  // user 逃逸到了方法外部
}
```

### 未逃逸对象的三种优化

**1. 栈上分配。** 如果对象不逃逸，可以在栈帧上创建，方法结束时自动销毁，不需要 GC 回收。

**2. 标量替换。** 将对象拆散为基本类型标量：

```java
// 原始代码
Point p = new Point(1, 2);
int sum = p.x + p.y;

// 标量替换后（JIT 优化）
int x = 1, y = 2;
int sum = x + y;
// Point 对象完全消除了
```

**3. 锁消除。** 如果对象不逃逸出方法，不可能被其他线程访问，那么对它的同步操作可以安全去除。

这三种优化都依赖逃逸分析的结果。JIT 编译器会在编译时分析对象的使用范围，决定是否应用这些优化。

---

> 本章覆盖了对象从创建到消亡的完整生命周期。下一章将进入垃圾回收——JVM 如何自动识别和回收不再使用的对象。
