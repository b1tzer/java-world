# 第二章 JVM 运行时数据区

> 本章回答一个核心问题：`new User()` 这行代码执行时，JVM 内部的各个内存区域分别做了什么？不是罗列"堆、栈、方法区"的概念，而是深入每个区域的内部工作机制、边界条件和出问题时的表现。

---

## 2.1 全景图与核心矛盾

先建立整体认知，再逐个深入。

```
JVM 运行时数据区
 ├── 线程共享
 │    ├── Heap（堆）—— 对象实例、数组
 │    └── Method Area（方法区 / Metaspace）—— 类信息、常量、静态变量
 └── 线程私有
      ├── VM Stack（虚拟机栈）—— 栈帧
      ├── Native Method Stack —— 本地方法栈
      └── PC Register（程序计数器）
```

这些区域不是孤立存在的。一行 Java 代码的执行，会同时涉及多个区域。以 `User user = new User("Tom")` 为例：

```
1. 方法区：加载 User 类的元数据（类名、字段、方法字节码）
2. 堆：分配 User 对象的内存空间
3. 虚拟机栈：当前方法的栈帧中，user 变量指向堆中的对象
4. 程序计数器：记录当前执行到哪一行字节码
```

理解这四个区域如何协作，比记住它们的名字重要得多。

---

## 2.2 虚拟机栈：方法执行的舞台

### 栈帧是什么

每调用一个方法，JVM 就在当前线程的虚拟机栈上压入一个**栈帧**。方法返回时弹出。栈帧是方法执行的"工作台"，包含四个组成部分：

```
栈帧
├── 局部变量表 —— 存放方法参数和局部变量
├── 操作数栈   —— 字节码指令的运算中转站
├── 动态链接   —— 指向运行时常量池中该方法的符号引用
└── 返回地址   —— 方法返回后继续执行的位置
```

大部分开发者不需要关心操作数栈和动态链接的细节——JVM 自动管理。但**局部变量表**值得深入理解，因为它直接影响你对 `this`、参数传递、变量作用域的认知。

### 局部变量表的 Slot 机制

局部变量表以 **Slot（变量槽）** 为单位。32 位类型（`int`、`float`、引用）占 1 个 Slot，64 位类型（`long`、`double`）占 2 个 Slot。

关键细节：**实例方法的 Slot 0 固定是 `this`**。

```java
public class UserService {
    public User findUser(int id, String name) {
        // Slot 0 = this（隐式参数）
        // Slot 1 = id
        // Slot 2 = name
        User user = new User(id, name);  // Slot 3 = user
        return user;
    }
}
```

这解释了一个常见的面试问题：**为什么静态方法不能访问 `this`？** 因为静态方法的局部变量表中没有 Slot 0 给 `this`——它根本没有隐式参数。

这也解释了 **Lambda 表达式为什么能访问外部变量但不能修改**：Lambda 捕获的是变量的**值的拷贝**（Slot 中的值），不是引用。如果允许修改，会导致 Lambda 内部的修改对调用方不可见——违反了 Java 的值传递语义。

### 栈溢出的真实场景

每个线程的栈大小由 `-Xss` 控制（默认因平台而异，通常 512KB~1MB）。栈溢出不只是"无限递归"这么简单——在实际项目中，更常见的触发场景是：

**1. 深度递归处理大数据**

```java
// 处理一棵深度为 10000 的树
public void traverse(TreeNode node) {
    if (node == null) return;
    process(node);
    traverse(node.left);   // 深度递归 → StackOverflowError
    traverse(node.right);
}
```

**2. 过深的方法调用链**

Spring + MyBatis 应用中，一次请求可能经过：Filter → DispatcherServlet → Controller → Service → Mapper → MyBatis 拦截器 → JDBC → ...，调用链本身就可能很深。

**3. JSP 编译后的超长方法**

JSP 页面编译成 Servlet 后，整个页面的逻辑在一个 `_jspService()` 方法中。复杂的 JSP 页面可能生成超长的方法，导致栈帧过大。

### StackOverflowError vs OutOfMemoryError

栈区域可能抛出两种异常，触发条件不同：

| 异常 | 触发条件 | 含义 |
|------|---------|------|
| `StackOverflowError` | 栈深度超过 `-Xss` 限制 | 单个线程的方法调用太深 |
| `OutOfMemoryError` | 无法分配新的线程栈 | 创建了太多线程，操作系统内存耗尽 |

第二种更隐蔽。每个线程的栈需要独立的内存空间，1000 个线程 × 1MB 栈 = 1GB 内存。在高并发场景下，线程数过多会直接导致 OOM，而不是 StackOverflow。

---

## 2.3 堆：对象的生命周期

### 分代不是理论，是工程经验

堆分为新生代（Eden + S0 + S1）和老年代（Old）。分代的依据是**弱分代假说**（Weak Generational Hypothesis）：绝大多数对象在创建后很快就会被回收。

这不是学术假设，而是对真实应用的观测。一个 Web 应用中，一次请求创建的大量临时对象（DTO、StringBuilder、各种中间变量）在请求结束后就变成垃圾。分代的设计就是利用这个特征：频繁回收新生代（少量存活对象），偶尔回收老年代（长期存活对象）。

### 对象分配的完整路径

```java
User user = new User("Tom");
```

这行代码在 JVM 内部经历的分配过程远比"在 Eden 区分配"复杂：

```
1. 类加载检查
   └─ User 类是否已加载？没有？先执行类加载（见第一章）

2. 分配内存
   ├─ 堆内存是否规整？
   │  ├─ 是 → 指针碰撞（Bump the Pointer）：移动分配指针
   │  └─ 否 → 空闲列表（Free List）：找到合适的空闲块
   │
   └─ 线程安全？
      ├─ TLAB（Thread Local Allocation Buffer）：每个线程在 Eden 有私有缓冲区
      │  └─ TLAB 内分配只需移动指针，无需 CAS，极快
      └─ TLAB 用完 → 在 Eden 共享区分配，需要 CAS 同步

3. 初始化零值
   └─ 所有字段设为默认值（int=0, boolean=false, 引用=null）
   └─ 这就是为什么不赋初值也能使用字段——JVM 保证了零值初始化

4. 设置对象头
   └─ Mark Word（hashCode、GC 年龄、锁状态）
   └─ Klass Pointer（指向方法区中的类元数据）

5. 执行 <init>
   └─ 你写的构造方法代码
```

**TLAB 是关键优化**。没有 TLAB，多线程同时在 Eden 分配对象需要加锁（CAS），TLAB 让每个线程有自己的"私人领地"，分配只需要移动指针。`-XX:+UseTLAB` 默认开启。

### 大对象为什么直接进老年代

超过 `-XX:PretenureSizeThreshold` 的大对象直接分配在老年代。原因不是"大对象生命周期长"，而是**避免大对象在 Eden 和 Survivor 之间来回复制**。

复制算法的代价与对象大小成正比。一个 10MB 的数组在 Minor GC 时复制到 Survivor，再复制回来，开销巨大。直接放老年代，只在 Full GC 时处理。

```java
// -XX:PretenureSizeThreshold=4194304 (4MB)
byte[] big = new byte[5 * 1024 * 1024];  // 5MB，直接进老年代
byte[] small = new byte[1024];            // 1KB，在 Eden 分配
```

### 动态年龄判定

JVM 不是死板地等到对象年龄达到 15 才晋升。有一个**动态年龄判定**规则：

> 如果 Survivor 区中某个年龄及以下的所有对象大小之和超过 Survivor 空间的一半，年龄 ≥ 该年龄的对象直接晋升老年代。

为什么需要这个规则？假设 Survivor 只有 100MB，某次 Minor GC 后有 60MB 的对象年龄都是 3。如果不晋升，下次 Minor GC 时 Survivor 可能放不下存活对象，导致直接进入老年代（HandlePromotionFailure 失败）。动态年龄判定提前晋升，避免了这种"被动晋升"的风险。

### 堆内存的监控

```bash
# 查看堆内存使用情况
jstat -gcutil <pid> 1000

# 输出示例:
#   S0     S1     E      O      M     CCS    YGC     YGCT    FGC    FGCT     GCT
#   0.00  25.31  45.67  32.18  95.32  92.15   125    1.234     3    0.456    1.690
```

| 列 | 含义 | 关注点 |
|---|------|--------|
| S0/S1 | Survivor 区使用率 | 一个为 0，一个有数据（复制算法） |
| E | Eden 区使用率 | 接近 100% 时即将触发 Young GC |
| O | 老年代使用率 | 持续增长 → 可能有内存泄漏 |
| YGC/YGCT | Young GC 次数/总耗时 | 频繁但每次应该很快（< 50ms） |
| FGC/FGCT | Full GC 次数/总耗时 | 次数应该很少，每次较慢 |

**实战经验**：如果 FGC 频繁（每分钟多次），通常意味着老年代空间不足或有内存泄漏。先检查 O 区使用率是否持续增长，再用 `jmap -histo` 看哪些对象占用了大量内存。

---

## 2.4 方法区：类的元数据仓库

### 方法区存了什么

方法区不是"存方法的地方"——它存的是**类的元数据**：

```
方法区（Metaspace）
├── 类元数据（Klass）
│   ├── 类名、访问修饰符、父类、接口列表
│   ├── 字段定义（名称、类型、修饰符、偏移量）
│   └── 方法定义（名称、参数、返回值、字节码、异常表）
├── 运行时常量池
│   ├── 字面量（字符串、数字常量）
│   └── 符号引用（类名、方法名、字段名 → 解析后变成直接引用）
├── 静态变量（引用类型的静态变量，JDK 7+ 移到了堆中）
└── JIT 编译后的机器码（CodeCache，单独管理）
```

一个常见的误解：**静态变量存在方法区**。实际上，JDK 7 之后，`static Object obj = new Object()` 中，`obj` 这个引用本身在**堆**中，不在方法区。方法区只存类的结构信息。

### PermGen → Metaspace 的演进

JDK 7 及以前，方法区的实现叫**永久代（PermGen）**，是堆的一部分，大小固定（`-XX:MaxPermSize`）。

JDK 8 将永久代彻底移除，替换为 **Metaspace**，使用本地内存（Native Memory）。

| | 永久代 | Metaspace |
|---|---|---|
| 内存位置 | 堆内 | 本地内存 |
| 大小限制 | 固定（默认 64MB~82MB） | 默认不设上限 |
| OOM 表现 | `PermGen space` | `Metaspace` |
| 字符串常量池 | 在永久代 | 移到堆中 |
| 静态变量 | 在永久代 | 移到堆中 |

**为什么要改？** 永久代有两个致命问题：

1. **大小难以预估**。类的数量取决于加载的 JAR 数量、反射使用程度、动态代理数量。一个使用大量框架的应用可能需要 256MB 永久代，另一个只需要 64MB。开发者必须手动调整 `MaxPermSize`，调大了浪费，调小了 OOM。

2. **Full GC 才能回收**。永久代的垃圾回收和老年代绑定——只有 Full GC 才会顺带回收永久代。如果永久代满了但还没触发 Full GC，就会直接 OOM。

Metaspace 用本地内存，默认不设上限，由操作系统管理。类卸载时自动回收。这解决了预估困难的问题。

### Metaspace OOM 的真实场景

Metaspace 不是无限的。以下场景会导致 Metaspace OOM：

**场景一：CGLIB 动态代理失控**

```java
// Spring AOP 每次创建代理都会生成新类
// 如果代理类没有被正确缓存，Metaspace 会持续增长
while (true) {
    Enhancer enhancer = new Enhancer();
    enhancer.setSuperclass(Target.class);
    enhancer.setCallback((MethodInterceptor) (obj, method, args, proxy) -> 
        proxy.invokeSuper(obj, args));
    enhancer.create();  // 每次生成一个新类 → Metaspace 增长
}
```

**场景二：Groovy 脚本反复编译**

```java
// Groovy 的 GroovyShell 每次 eval 都会编译生成新类
GroovyShell shell = new GroovyShell();
while (true) {
    shell.evaluate("println 'hello'");  // 每次生成一个新的 Script 类
}
```

**场景三：大量 JSP 页面**

Tomcat 部署了大量 JSP 应用，每个 JSP 编译成一个 Servlet 类。如果应用有数千个 JSP，Metaspace 需要数百 MB。

**监控 Metaspace：**

```bash
# 查看 Metaspace 使用情况
jstat -gcmetacapacity <pid>

# 更详细的 Metaspace 分解
jcmd <pid> VM.metaspace
```

---

## 2.5 堆外内存：JVM 规范之外的灰色地带

堆外内存（Direct Memory）不在 JVM 运行时数据区的规范中，但在实际工程中经常成为 OOM 的元凶。

### 什么是堆外内存

普通 Java 对象分配在堆上，由 GC 自动回收。堆外内存是通过 `Unsafe.allocateMemory()` 或 `ByteBuffer.allocateDirect()` 分配的**本地内存**，不受 GC 直接管理。

```
普通对象:
  new byte[1024]  →  分配在 Eden  →  GC 自动回收

堆外内存:
  ByteBuffer.allocateDirect(1024)  →  分配在本地内存  →  DirectByteBuffer 被 GC 时通过 Cleaner 释放
```

### 为什么 NIO 需要堆外内存

传统的 I/O 操作需要在用户空间（堆）和内核空间之间拷贝数据：

```
传统 I/O（两次拷贝）:
  磁盘 → 内核缓冲区 → 用户缓冲区(堆) → 内核缓冲区 → 网卡
         read()         write()
```

使用堆外内存后，可以避免一次用户空间的拷贝：

```
Direct I/O（一次拷贝）:
  磁盘 → 内核缓冲区(直接内存) → 网卡
         sendfile() 系统调用
```

这就是 Netty 和 NIO 使用 `DirectByteBuffer` 的原因——减少一次内存拷贝，对高吞吐场景意义重大。

### 堆外内存的坑

**坑一：不受 Xmx 限制**

`-Xmx4g` 只限制堆大小。堆外内存另外计算。一个应用可能堆只用了 2GB，但堆外内存用了 3GB，总内存 5GB。

```bash
# 查看总内存使用
jcmd <pid> VM.native_memory summary

# 输出示例:
#                    Total:  reserved=6GB  +  committed=4GB
#        Java Heap (reserved=2GB, committed=2GB)
#        Class (reserved=1GB, committed=500MB)
#        Thread (reserved=500MB, committed=500MB)
#        Internal (reserved=1GB, committed=1GB)   ← 这里包含堆外内存
```

**坑二：回收延迟**

`DirectByteBuffer` 本身是堆上的小对象，但它关联的堆外内存可能很大。只有当 `DirectByteBuffer` 被 GC 回收时，堆外内存才通过 Cleaner 释放。如果 GC 不频繁，堆外内存可能长时间不释放。

```java
// 危险：在循环中分配大量 DirectByteBuffer
while (true) {
    ByteBuffer buf = ByteBuffer.allocateDirect(10 * 1024 * 1024);  // 10MB
    // buf 在下次 GC 前不会被释放
    // 如果循环速度快于 GC → 堆外内存持续增长 → OOM
}
```

**坑三：监控困难**

`jstat` 看不到堆外内存。`jmap -histo` 只能看到堆上的 `DirectByteBuffer` 对象（很小），看不到实际分配的堆外内存大小。

```bash
# 正确的监控方式
jcmd <pid> VM.native_memory summary

# 或者使用 NMT（Native Memory Tracking）
# 启动时加参数: -XX:NativeMemoryTracking=summary
```

### 堆外内存参数

| 参数 | 说明 |
|------|------|
| `-XX:MaxDirectMemorySize=256m` | 限制堆外内存大小（默认等于 `-Xmx`） |
| `-XX:NativeMemoryTracking=summary` | 开启 NMT 监控 |

---

## 2.6 StringTable：字符串驻留的代价

### 字符串常量池的工作原理

```java
String a = "hello";
String b = "hello";
// a == b 为 true——两者指向常量池中同一个对象
```

JVM 维护一个**字符串常量池（StringTable）**，存储所有字面量字符串。相同的字符串只存一份，所有引用共享。

StringTable 本质上是一个 HashTable，通过字符串的 hashCode 定位桶。`-XX:StringTableSize` 控制桶数（默认 60013），桶数越多，哈希冲突越少，查找越快。

### intern() 的行为与陷阱

```java
String a = new String("hello");  // 堆上新对象（a ≠ "hello"）
String b = a.intern();           // 将 "hello" 放入常量池
String c = "hello";              // 直接引用常量池
b == c  // true
```

`intern()` 的行为在 JDK 6 和 JDK 7+ 有本质区别：

| | JDK 6 | JDK 7+ |
|---|---|---|
| StringTable 位置 | 永久代 | 堆 |
| `intern()` 发现字符串不存在时 | 在永久代创建新对象 | 在堆中记录引用（不创建新对象） |
| 内存影响 | 永久代空间有限，容易 OOM | 使用堆空间，可被 GC 回收 |

JDK 7+ 的变化意味着：`intern()` 不再往永久代塞数据，而是把堆中已有对象的引用记录到 StringTable。这大幅降低了 `intern()` 的内存风险。

### intern() 的正确使用场景

**适合：大量重复字符串的去重**

```java
// 从 CSV 读取 1000 万行，大量重复的城市名
// 不用 intern(): 1000 万个 String 对象，其中 90% 是重复的
// 用 intern():   1000 个不重复的城市名 + 1000 万个引用

String city = getCityFromCsv();
return city.intern();  // 相同城市名共享同一个对象
```

**不适合：大量不重复的字符串**

```java
// 每个字符串都不同 → intern() 浪费内存（StringTable 本身也需要空间）
for (int i = 0; i < 1_000_000; i++) {
    String s = UUID.randomUUID().toString().intern();  // 错误用法！
}
```

### 字符串常量池的内存模型

```
堆（Heap）
├── StringTable（HashTable，桶数组）
│   ├── [0] → "hello" → "world"  （链表处理哈希冲突）
│   ├── [1] → null
│   ├── [2] → "foo"
│   └── ...
├── String 对象（value 字符数组）
│   ├── String@0x1001 → char[]{'h','e','l','l','o'}
│   ├── String@0x1002 → char[]{'w','o','r','l','d'}
│   └── ...
└── 其他对象
```

`String a = "hello"` 的查找过程：
1. 计算 `"hello".hashCode()` → 得到桶索引
2. 在桶中遍历链表，找到值为 `"hello"` 的 String 对象
3. 返回该对象的引用

如果没找到，创建一个新的 String 对象，放入 StringTable。

---

> 本章建立了 JVM 内存区域的完整认知。每个区域不是孤立的概念，而是有明确的职责边界、内部工作机制和出问题时的表现。下一章将深入对象模型——从 `new` 到对象消亡，覆盖对象创建、内存布局、Mark Word，这些知识直接服务于 GC（第四章）和并发锁（第三卷 synchronized）。
