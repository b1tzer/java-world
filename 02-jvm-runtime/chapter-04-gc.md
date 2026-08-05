# 第四章 垃圾回收

> 本章理解 GC 的完整理论体系和 HotSpot 收集器演进路线。从"什么样的对象该回收"讲起，到"怎么回收"，再到各代收集器的设计取舍。

---

## 4.1 为什么需要 GC

C/C++ 手动管理内存（`malloc` / `free`），开发者负责分配和释放。常见问题：

- **内存泄漏**：分配了忘记释放
- **野指针**：释放后继续使用
- **Double Free**：释放两次导致崩溃

Java 的垃圾回收器（GC）自动识别和回收不再使用的对象。代价是 GC 需要消耗 CPU 时间，偶尔产生 **Stop-The-World（STW）** 停顿——GC 执行时所有应用线程暂停。

对于绝大多数应用，GC 的收益远大于代价。但理解 GC 的工作原理，才能在出现性能问题时做出正确的调优决策。

---

## 4.2 如何判定对象存活

### 引用计数法（Java 不采用）

每个对象维护一个引用计数器，被引用时 +1，引用断开时 -1，计数为 0 则回收。

问题：**无法解决循环引用**。

```java
a.ref = b;
b.ref = a;
// a 和 b 互相引用，引用计数永远不为 0
// 但实际上两者都可以被回收（没有外部引用指向它们）
```

### 可达性分析（Java 采用）

从一组 **GC Roots** 出发，沿着引用链遍历，能到达的对象是存活的，不能到达的是垃圾。

```
GC Roots
  ├─→ Object A → Object B → Object C（存活）
  │                    └──→ Object D（存活）
  └─→ Object E（存活）

Object F → Object G（垃圾，没有 GC Root 能到达）
```

**GC Roots 包括：**
- 虚拟机栈中引用的对象（正在执行的方法中的局部变量）
- 静态字段引用的对象
- 常量引用的对象
- JNI 引用的对象
- 被 `synchronized` 持有的对象

---

## 4.3 四种引用类型

| 引用类型 | 回收时机 | 典型用途 |
|---------|---------|---------|
| **强引用** | 永不回收（除非不可达） | 普通 `new` |
| **软引用** | 内存不足时回收 | 缓存（如图片缓存） |
| **弱引用** | 下次 GC 必定回收 | `WeakHashMap`、`ThreadLocal` |
| **虚引用** | 无法通过它获取对象 | 对象回收跟踪、NIO Cleaner |

```java
// 软引用：内存不足时才回收
SoftReference<byte[]> soft = new SoftReference<>(new byte[1024 * 1024]);
byte[] data = soft.get();  // 内存充足时返回对象，不足时返回 null

// 弱引用：下次 GC 一定回收
WeakReference<User> weak = new WeakReference<>(new User("Tom"));
System.gc();
User user = weak.get();  // 很可能已经是 null
```

`WeakHashMap` 是弱引用的典型应用——当 key 不再被其他地方引用时，GC 会自动清除对应的 entry。常用于实现不影响 GC 的缓存。

`ThreadLocal` 内部也使用弱引用——ThreadLocal 变量被回收后，线程的 ThreadLocalMap 中对应的 entry 的 key 变为 null，下次 GC 时 value 被回收。如果线程长期存活（如线程池），value 可能不会被及时回收，导致内存泄漏——这是 `ThreadLocal` 使用后必须调用 `remove()` 的原因。

---

## 4.4 垃圾回收算法

| 算法 | 思路 | 优点 | 缺点 |
|------|------|------|------|
| 标记-清除 | 标记存活 → 统一清除 | 简单 | 内存碎片 |
| 标记-复制 | 存活对象复制到新空间 | 无碎片 | 浪费一半空间 |
| 标记-整理 | 存活对象向一端移动 | 无碎片 | 移动对象耗时 |

### 标记-清除（Mark-Sweep）

先标记所有存活对象，然后统一清除未标记的对象。问题：清除后内存不连续，产生碎片。

### 标记-复制（Copying）

将存活对象复制到另一半空间，然后清空原空间。无碎片，但浪费一半内存。

### 标记-整理（Mark-Compact）

先标记存活对象，然后将存活对象向一端移动，清空边界外的内存。无碎片，但移动对象需要更新所有引用，开销较大。

---

## 4.5 分代收集思想

基于经验假设：**绝大多数对象朝生夕灭**。据统计，90% 以上的对象在创建后很快就会被回收。

### 跨代引用问题

分代带来了新问题：如果老年代有对象引用了新生代的对象，Minor GC 时如何找到这个被引用的新生代对象？最笨的办法是扫描整个老年代——但老年代通常很大，扫描耗时。

解决方案：**记忆集（Remembered Set）+ 卡表（Card Table）**。

```
卡表（Card Table）：
  堆被划分为 512 字节的"卡页"（Card Page）
  每个卡页对应卡表中的 1 字节（标记位）

  当老年代对象修改引用、指向新生代对象时：
  → 写屏障（Write Barrier）将对应卡页的标记位设为 "dirty"
  → Minor GC 时只扫描 dirty 的卡页，而非整个老年代
```

写屏障是 JVM 在引用赋值操作前后插入的代码（类似 AOP 的环绕通知），保证卡表的准确性。这不是程序员手动维护的，而是 JVM 自动处理的。

G1 收集器更进一步，每个 Region 维护自己的 RSet（Remembered Set），记录"哪些外部 Region 有引用指向本 Region"。这比全堆共享一张卡表更精确，但 RSet 本身占用额外内存（约 5%~10% 堆空间）。

因此，JVM 将堆分为两代：

| 代 | 区域 | 特点 | 算法 |
|----|------|------|------|
| 新生代 | Eden + S0 + S1 | 对象生命周期短 | 标记-复制 |
| 老年代 | Old | 对象生命周期长 | 标记-清除/整理 |

- **Minor GC**：回收新生代，频率高但速度快（通常 < 50ms）
- **Major GC / Full GC**：回收老年代（或整个堆），频率低但速度慢

对象的晋升路径：

```
new → Eden
       ↓ Minor GC 存活
      Survivor（S0 或 S1）
       ↓ 每次 Minor GC 存活，年龄 +1
       ↓ 年龄达到阈值（默认 15）
      Old（老年代）
```

---

## 4.6 HotSpot 收集器演进

| 收集器 | 代 | 目标 | 算法 | STW 阶段 |
|--------|---|------|------|---------|
| Serial | 新生代 | 简单高效 | 复制 | 全程 STW |
| Parallel Scavenge | 新生代 | 高吞吐 | 复制 | 全程 STW（多线程） |
| CMS | 老年代 | 低延迟 | 标记-清除 | 初始标记+重新标记 |
| G1 | 整堆 | 可预测停顿 | 复制+整理 | 初始标记+最终标记+筛选回收 |
| ZGC | 整堆 | 亚毫秒 STW | 整理 | 初始标记+并发转移 |

### Serial / Parallel Scavenge（新生代）

Serial 是最简单的收集器——单线程，全程 STW。适用于客户端模式或小堆场景。

Parallel Scavenge 是 Serial 的多线程版本，目标是**最大化吞吐量**（`-XX:MaxGCPauseMillis` 控制最大停顿时间）。

```
Serial:                    Parallel Scavenge:
  [STW]                      [STW]
  GC 线程 1: ████████         GC 线程 1: ████
                            GC 线程 2: ████
                            GC 线程 3: ████
                            GC 线程 4: ████
  停顿长                      停顿短（多线程并行）
```

### CMS（Concurrent Mark Sweep）

目标：**最短停顿时间**。大部分标记工作与应用线程并发执行。

四个阶段：

```
1. 初始标记（STW）     —— 标记 GC Roots 直接引用的对象（很快）
2. 并发标记            —— 从 GC Roots 出发遍历整个引用链（与应用并发，耗时长）
3. 重新标记（STW）     —— 修正并发标记期间变动的引用（比初始标记稍长）
4. 并发清除            —— 清除垃圾（与应用并发）
```

三个致命缺陷：
- **CPU 敏感**：并发阶段占用 CPU 资源，默认启动 `(CPU核数+3)/4` 个 GC 线程
- **浮动垃圾**：并发清除阶段新产生的垃圾只能下次回收
- **碎片化**：标记-清除算法产生碎片，碎片过多时退化为 Serial Old（Full GC + 整理）

CMS 已在 JDK 14 被移除。

### G1（Garbage First）

核心创新：将堆分为大小相等的 **Region**（1MB~32MB），不再固定新生代/老年代的边界。

```
┌───┬───┬───┬───┬───┬───┐
│ E │ E │ S │ O │ O │ H │  E=Eden, S=Survivor, O=Old
├───┼───┼───┼───┼───┼───┤  H=Humongous（大对象）
│ O │ E │   │ O │ S │   │  空白=空闲
├───┼───┼───┼───┼───┼───┤
│   │ O │ E │   │ O │   │
└───┴───┴───┴───┴───┴───┘
```

**Humongous 对象**：超过 Region 大小一半的对象，直接分配在连续的 Humongous Region 中。

#### G1 的回收过程

```
Young GC（新生代回收）
  ↓ 触发并发标记阈值
初始标记（STW，借用 Young GC 的暂停）
  ↓
并发标记（与应用并发）
  ↓
最终标记（STW）
  ↓
筛选回收（STW）—— 选择垃圾最多的 Region 优先回收
```

**Mixed GC**：既回收新生代 Region，也回收部分老年代 Region。这是 G1 的核心——不是整个老年代一起回收，而是选择"收益最大"的 Region。

#### RSet（Remembered Set）

G1 的关键数据结构。每个 Region 维护一个 RSet，记录**其他 Region 中指向本 Region 的引用**。

```
Region A 的 RSet: {Region B 的第 3 个卡页, Region D 的第 7 个卡页}
含义：Region B 的第 3 个卡页和 Region D 的第 7 个卡页中有引用指向 Region A
```

有了 RSet，回收某个 Region 时不需要扫描整个堆，只需要扫描 RSet 中记录的卡页。

代价：RSet 占用额外内存（约 5%~10% 的堆空间），写操作需要维护 RSet（写屏障）。

#### 可预测停顿

G1 通过 `-XX:MaxGCPauseMillis=200`（默认 200ms）控制最大停顿时间。G1 会追踪每个 Region 的回收价值（垃圾量 / 回收时间），优先回收价值最高的 Region，确保在停顿时间内回收最多的垃圾。

### ZGC

目标：**亚毫秒级 STW**，支持 TB 级堆。JDK 15 生产就绪。

核心技术：
- **染色指针**：在 64 位指针中嵌入 GC 元数据（标记信息），不需要额外的 RSet
- **读屏障**：在对象引用读取时自动转发到正确地址，实现并发转移
- **并发转移**：对象移动与应用线程并发执行，STW 只在初始标记阶段（< 1ms）

```
传统 GC（G1）:
  标记（并发）→ 转移（STW）   ← 转移阶段需要暂停

ZGC:
  初始标记（STW < 1ms）→ 并发标记 → 并发转移   ← 全程几乎不暂停
```

ZGC 的染色指针利用了 64 位地址空间中未使用的位：

```
64 位指针实际使用情况：
  [unused:16] [Finalizable:1] [Remapped:1] [Marked1:1] [Marked0:1] [地址:44]
    16 bit      1 bit           1 bit        1 bit       1 bit      44 bit
```

44 位地址空间 = 16TB 寻址能力，足够绝大多数场景。

4 个标志位用于记录对象的 GC 状态（标记、转移、引用处理），不需要额外的数据结构（如 G1 的 RSet）。通过指针中的标志位，ZGC 可以在读取引用时判断对象是否需要转发——这就是**读屏障**的工作原理：

```
// 读屏障的工作流程
Object ref = object.field;   // 读取引用时，ZGC 插入读屏障检查
if (ref 需要转发) {
    ref = 转发后的新地址;     // 自动更新为对象的新位置
}
// 后续代码使用更新后的引用
```

读屏障使得对象转移可以并发进行：ZGC 在后台将对象从一个 Region 复制到另一个 Region，应用线程读取引用时自动被转发到新地址。这是 ZGC 实现亚毫秒 STW 的关键——对象转移（最耗时的阶段）完全并发。

### 分代 ZGC（JDK 21+）

JDK 21 引入了分代 ZGC（`-XX:+UseZGC -XX:+ZGenerational`），将堆分为年轻代和老年代。分代 ZGC 的优势：

- **更高的吞吐量**：年轻代回收频率高但速度快，减少全堆扫描
- **更低的内存占用**：非分代 ZGC 需要更多内存空间来避免 Full GC
- **更好的回收效率**：短命对象在年轻代被快速回收，不会污染老年代

JDK 21 中分代 ZGC 是实验特性，JDK 23 中成为默认行为。

---

### Shenandoah

Shenandoah 是 Red Hat 主导的低延迟收集器，目标与 ZGC 类似（亚毫秒 STW），但实现路径不同：

| | ZGC | Shenandoah |
|---|---|---|
| 主导方 | Oracle | Red Hat |
| 核心技术 | 染色指针 + 读屏障 | 转发指针 + 读/写屏障 |
| 对象头 | 不修改 | 在对象头前插入转发指针（Forwarding Pointer） |
| 并发转移 | 读屏障转发 | 读/写屏障转发 |
| 平台支持 | x86_64, AArch64 | x86_64, AArch64, RISC-V |

Shenandoah 的核心创新是**Brooks Pointer（转发指针）**：每个对象头部前面额外加一个指针，指向对象的当前位置。对象被转移后，转发指针更新为新地址，其他线程通过转发指针找到新位置。

```
Shenandoah 的回收阶段：
  初始标记（STW）→ 并发标记 → 最终标记（STW）→ 并发清理
  → 并发转移 → 初始引用更新（STW）→ 并发引用更新
```

选型建议：ZGC 和 Shenandoah 目标相似，选择主要看 JDK 发行版——Oracle JDK 默认 ZGC，Red Hat/OpenJDK 更倾向 Shenandoah。JDK 17+ 两者都可用。

## 4.7 GC 日志分析

GC 日志是调优的第一手资料。

### 开启 GC 日志

```bash
# JDK 9+ 统一格式
-Xlog:gc*=info:file=gc.log:time,uptime,level,tags

# 更详细的 GC 日志
-Xlog:gc*=debug:file=gc.log:time,uptime,level,tags
```

### 解读 G1 GC 日志

```
[2024-01-15T10:30:15.123+0800] GC(42) Pause Young (Normal) 
    [Eden: 1024M(1024M)->0B(1024M) 
     Survivors: 128M->128M 
     Old: 2048M->2100M]
    Metaspace: 45678K->45678K(1089536K)
   [123456K->98765K(4096M)]
    [Times: user=0.15 sys=0.02, real=0.08 secs]
```

| 字段 | 含义 |
|------|------|
| `Pause Young (Normal)` | Young GC，正常模式 |
| `Eden: 1024M(1024M)->0B(1024M)` | Eden 从 1024M 清空到 0 |
| `Old: 2048M->2100M` | 老年代从 2048M 增长到 2100M |
| `real=0.08 secs` | 实际停顿时间 80ms |
| `user=0.15` | GC 线程总 CPU 时间 150ms（多线程累加） |

---

### 从 GC 日志发现问题：实战案例

下面是一个实际的 GC 日志分析过程：

**现象：** 服务接口响应时间每隔几分钟飙升到 2 秒以上。

**第一步：看 GC 日志中的停顿时间**

```
[10:30:15] Pause Young (Normal)  [Eden: 1024M->0B]  real=0.08 secs  ← 正常
[10:30:45] Pause Young (Normal)  [Eden: 1024M->0B]  real=0.07 secs  ← 正常
[10:31:15] Pause Mixed          [Eden: 1024M->0B  Old: 2048M->1800M]  real=0.15 secs
[10:31:30] Pause Full (Allocation Failure)  [Old: 3500M->3500M]  real=2.1 secs  ← 问题！
```

**第二步：分析 Full GC 原因**

`Allocation Failure` 意味着老年代空间不足，G1 无法在 Mixed GC 中回收足够空间，被迫 Full GC。老年代 3500M 几乎满。

**第三步：用 jmap 看哪些对象占用了老年代**

```bash
jmap -histo:live <pid> | head -20

# 输出:
#  num     #instances         #bytes  class name
#    1:       2500000      200000000  [B  (byte[])
#    2:       1800000      144000000  java.lang.String
#    3:         50000       40000000  com.example.CacheEntry
```

**第四步：定位代码**

`CacheEntry` 数量异常多 → 检查代码发现一个本地缓存没有设置过期策略，对象持续堆积在老年代。

**修复：** 为缓存添加 TTL 和最大条目数限制。修复后 Full GC 消失，接口响应时间稳定。

### GC 选择决策树

```
你的应用是什么类型？
├── 低延迟服务（Web、API、微服务）
│   ├── 堆 < 4GB → G1（默认，够用）
│   ├── 堆 4GB~16GB → G1 + 调优 MaxGCPauseMillis
│   └── 堆 > 16GB 或要求亚毫秒停顿 → ZGC（JDK 17+）
│
├── 高吞吐批处理（数据处理、ETL）
│   └── Parallel Scavenge（吞吐量优先，停顿可接受）
│
└── 小应用 / 客户端
    └── Serial（单线程，简单高效）
```

## 4.8 核心 GC 参数

| 参数 | 说明 |
|------|------|
| `-Xms4g -Xmx4g` | 初始/最大堆大小（线上建议设为一致，避免动态扩缩） |
| `-Xmn2g` | 新生代大小 |
| `-XX:NewRatio=2` | 老年代:新生代 = 2:1 |
| `-XX:SurvivorRatio=8` | Eden:S0:S1 = 8:1:1 |
| `-XX:+UseG1GC` | 使用 G1 收集器 |
| `-XX:MaxGCPauseMillis=200` | G1 目标最大停顿时间 |
| `-XX:MaxTenuringThreshold=15` | 对象晋升老年代的年龄阈值 |
| `-XX:G1HeapRegionSize=8m` | G1 Region 大小 |
| `-XX:InitiatingHeapOccupancyPercent=45` | 触发并发标记的堆占用阈值 |
| `-XX:ConcGCThreads=4` | 并发 GC 线程数 |
| `-XX:+HeapDumpOnOutOfMemoryError` | OOM 时自动 dump |
| `-Xlog:gc*:file=gc.log:time` | GC 日志（JDK 9+） |

---

> 本章覆盖了 GC 的完整理论体系。下一章将解释"Java 为什么越跑越快"——JIT 即时编译器如何在运行时优化热点代码。
