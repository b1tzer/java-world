# 第二章 JVM 运行时数据区

> 本章建立完整的 JVM 内存世界观：堆、栈、方法区的分工与协作。这是一切内存调优和 GC 理解的大前提。

---

## 2.1 JVM 内存全景图

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

**线程共享**意味着所有线程都可以访问同一块内存。**线程私有**意味着每个线程有自己的独立空间。

除了这五块运行时数据区，还有一块**堆外内存（Direct Memory）**不在 JVM 规范中，但实际使用广泛（NIO、Netty 都依赖它）。

| 区域 | 线程 | 存储内容 | 异常 |
|------|------|---------|------|
| 堆 | 共享 | 对象实例、数组 | `OutOfMemoryError` |
| 方法区/Metaspace | 共享 | 类信息、常量池、静态变量 | `OutOfMemoryError` |
| 虚拟机栈 | 私有 | 栈帧（局部变量、操作数栈） | `StackOverflowError` / `OutOfMemoryError` |
| 本地方法栈 | 私有 | Native 方法调用 | `StackOverflowError` |
| 程序计数器 | 私有 | 当前执行的字节码行号 | 无 |
| 堆外内存 | 共享 | NIO DirectBuffer | `OutOfMemoryError` |

---

## 2.2 方法调用与栈帧

每个线程有一个**虚拟机栈**，每调用一个方法就在栈上压入一个**栈帧（Stack Frame）**，方法返回时弹出。

### 栈帧的四个组成部分

```
栈帧
├── 局部变量表 —— 存放方法参数和局部变量（以 Slot 为单位）
├── 操作数栈   —— JVM 基于栈的运算中转站
├── 动态链接   —— 指向运行时常量池中该方法的引用
└── 返回地址   —— 方法调用后的下一条指令地址
```

### 局部变量表与 Slot

局部变量表以 **Slot（变量槽）** 为单位存储。32 位类型（`int`、`float`、引用）占 1 个 Slot，64 位类型（`long`、`double`）占 2 个 Slot。

实例方法的局部变量表中，**Slot 0 固定存放 `this` 引用**：

```java
public class UserService {
    public User findUser(int id, String name) {
        // Slot 0 = this
        // Slot 1 = id (int, 1个Slot)
        // Slot 2 = name (引用, 1个Slot)
        User user = new User(id, name);  // Slot 3 = user
        return user;
    }
}
```

对应的字节码：

```
aload_0     // 加载 Slot 0 (this) 到操作数栈
iload_1     // 加载 Slot 1 (id)
aload_2     // 加载 Slot 2 (name)
invokespecial #2  // 调用构造方法
astore_3    // 将结果存到 Slot 3 (user)
aload_3     // 加载 Slot 3
areturn     // 返回引用
```

### 操作数栈的工作过程

操作数栈是栈帧中的"计算区"。所有运算都在操作数栈上完成：

```java
int result = a + b;  // 假设 a 在 Slot 1, b 在 Slot 2
```

```
1. iload_1    → 操作数栈: [a]
2. iload_2    → 操作数栈: [a, b]
3. iadd       → 弹出 a 和 b，相加 → 操作数栈: [a+b]
4. istore_3   → 将 a+b 存到 Slot 3 → 操作数栈: []
```

### 方法调用的栈帧变化

```java
public int outer() {
    int a = 1;
    int b = inner(a);  // 调用 inner
    return a + b;
}

public int inner(int x) {
    return x * 2;
}
```

```
调用 outer():
┌─────────────────┐
│ outer 栈帧       │  局部变量: [this, a=?, b=?]
│ 操作数栈: []     │
├─────────────────┤
│ VM Stack        │
└─────────────────┘

执行 a=1, 调用 inner(1):
┌─────────────────┐
│ outer 栈帧       │  局部变量: [this, a=1, b=?]
├─────────────────┤
│ inner 栈帧       │  局部变量: [x=1]
│ 操作数栈: []     │
├─────────────────┤
│ VM Stack        │
└─────────────────┘

inner 返回 2, 回到 outer:
┌─────────────────┐
│ outer 栈帧       │  局部变量: [this, a=1, b=2]
│ 操作数栈: [3]    │  ← a+b 的结果
├─────────────────┤
│ VM Stack        │
└─────────────────┘
```

### 栈溢出

每个线程的栈大小是有限的（`-Xss256k`）。如果方法调用层次太深（如无限递归），栈帧不断压入，最终导致 `StackOverflowError`。

```java
// 无限递归 → StackOverflowError
public void recurse() {
    recurse();
}
```

注意：`StackOverflowError` 是 **Error**，不是 **Exception**，不能被 catch 恢复。

---

## 2.3 堆内存：对象的家园

**堆（Heap）** 是 JVM 中最大的一块内存区域，所有对象实例和数组都在这里分配。

### 分代划分

```
┌── Eden（伊甸区）──────────┐  ← 新对象在这里分配
│  Survivor 0 │ Survivor 1 │  ← 存活对象在两个 S 区之间复制
├──────────────────────────┤
│      Old（老年代）        │  ← 长期存活的对象晋升到这里
└──────────────────────────┘
```

分代的依据是"大多数对象朝生夕灭"的经验假设：新创建的对象很快就会被回收（Minor GC 频繁但快速），少数长期存活的对象晋升到老年代（Major GC 较少但耗时长）。

默认比例：`Eden : S0 : S1 = 8 : 1 : 1`（通过 `-XX:SurvivorRatio=8` 调整），`新生代 : 老年代 = 1 : 2`（通过 `-XX:NewRatio=2` 调整）。

### 对象分配过程

```java
User user = new User("Tom");
```

```
1. 尝试在 Eden 区分配
   ├─ TLAB 可用 → 在 TLAB 中分配（无需加锁，快速路径）
   └─ TLAB 用完 → 在 Eden 共享区分配（需要 CAS）
2. Eden 满了 → 触发 Minor GC
   ├─ 存活对象复制到 Survivor 区（S0 或 S1）
   └─ 存活对象年龄 +1
3. 年龄达到阈值（默认 15）→ 晋升到老年代
4. 老年代满了 → 触发 Major GC / Full GC
```

### 大对象直接进老年代

超过 `-XX:PretenureSizeThreshold`（默认 0，表示不启用）的大对象直接分配在老年代，避免在 Eden 和 Survivor 之间来回复制。

```java
// 如果 PretenureSizeThreshold=1MB
byte[] big = new byte[2 * 1024 * 1024];  // 2MB，直接进老年代
```

### 动态年龄判定

并非所有对象都要等到年龄 15 才晋升。JVM 有**动态年龄判定**规则：

> 如果 Survivor 区中相同年龄的所有对象大小之和超过 Survivor 空间的一半，年龄 ≥ 该年龄的对象直接晋升老年代。

这条规则避免了 Survivor 区频繁触发复制。

---

## 2.4 方法区与 Metaspace 演进

方法区存储类的元数据：类名、字段、方法、常量池、静态变量。

### 方法区存储的内容

```
方法区（Metaspace）
├── 类元数据（Klass）
│   ├── 类名、访问修饰符、父类、接口
│   ├── 字段定义（名称、类型、修饰符）
│   └── 方法定义（名称、参数、返回值、字节码）
├── 运行时常量池
│   ├── 字面量（字符串、数字）
│   └── 符号引用（类名、方法名、字段名）
├── 静态变量（引用类型的静态变量）
└── JIT 编译后的机器码（CodeCache）
```

注意：**JDK 7 之后，静态变量（引用类型）从永久代移到了堆中**。`static Object obj = new Object()` 中，`obj` 这个引用本身在堆上，不是方法区。

### JDK 7 → 8 的重大变化

| | JDK 7 及以前 | JDK 8+ |
|---|---|---|
| 实现 | 永久代（PermGen，堆的一部分） | Metaspace（本地内存） |
| 大小限制 | `-XX:MaxPermSize` 固定 | 默认不设上限 |
| 常见问题 | PermGen OOM | Metaspace OOM（大量动态生成类） |
| 字符串常量池 | 在永久代 | 在堆中 |
| 静态变量 | 在永久代 | 在堆中 |

为什么改？永久代大小固定，容易 OOM（尤其是大量使用反射、动态代理、CGLIB 的应用）。Metaspace 使用本地内存，默认不设上限，由操作系统管理。

但 Metaspace 也不是无限的。大量动态生成类（如 Groovy 脚本、ASM 字节码增强、大量 JSP 页面）仍然可能导致 Metaspace OOM。用 `-XX:MaxMetaspaceSize` 设置上限。

### 监控 Metaspace

```bash
# 查看 Metaspace 使用情况
jstat -gcmetacapacity <pid>

# 输出示例
#   MCMN    MCMX      MC       CCSMN   CCSMX    CCSC
#   0.0   1048576.0  300352.0   0.0   1048576.0  36864.0
```

### 实际案例：Metaspace OOM

```java
// 动态生成大量类 → Metaspace OOM
// 使用 CGLIB 或 ASM 不断生成新的代理类
while (true) {
    Enhancer enhancer = new Enhancer();
    enhancer.setSuperclass(Target.class);
    enhancer.setCallback((MethodInterceptor) (obj, method, args, proxy) -> proxy.invokeSuper(obj, args));
    enhancer.create();  // 每次生成一个新类
}
```

解决方案：`-XX:MaxMetaspaceSize=256m`，或排查为什么不停生成新类。

---

## 2.5 直接内存（Direct Memory）

直接内存不在 JVM 运行时数据区的规范中，但实际使用广泛。

### 什么是直接内存

普通对象分配在堆上（Heap），由 GC 管理。直接内存是**通过 `Unsafe.allocateMemory()` 或 `ByteBuffer.allocateDirect()` 分配的堆外内存**，不经过 GC，需要手动释放。

```
普通 I/O:
  磁盘 → 内核缓冲区 → 用户缓冲区(堆) → 内核缓冲区 → 网卡
  （两次内核态/用户态拷贝）

Direct I/O (零拷贝):
  磁盘 → 直接内存 → 网卡
  （零次拷贝，通过 sendfile 系统调用）
```

### NIO 与直接内存

Java NIO 的 `DirectByteBuffer` 使用直接内存：

```java
// 分配直接内存
ByteBuffer buffer = ByteBuffer.allocateDirect(1024 * 1024);  // 1MB 堆外内存

// 这块内存不受 GC 直接管理
// 当 DirectByteBuffer 对象被 GC 回收时，通过 Cleaner 释放堆外内存
```

### 直接内存的坑

- **不受 Xmx 限制**：`-Xmx4g` 只限制堆大小，直接内存另外计算
- **OOM 风险**：分配过多直接内存会导致物理内存耗尽
- **监控困难**：`jstat` 看不到直接内存使用量

```bash
# 查看直接内存使用
jcmd <pid> VM.native_memory summary
```

### 直接内存参数

| 参数 | 说明 |
|------|------|
| `-XX:MaxDirectMemorySize=256m` | 限制直接内存大小（默认等于 `-Xmx`） |

---

## 2.6 StringTable 与字符串驻留

### 字符串常量池

```java
String a = "hello";
String b = "hello";
// a == b 为 true——两者指向常量池中同一个对象
```

JVM 维护一个**字符串常量池（StringTable）**，存储所有字面量字符串。相同的字符串只存一份，所有引用共享。

StringTable 本质上是一个 **HashTable**，默认桶数 60013（可通过 `-XX:StringTableSize` 调整）。

### intern() 方法

```java
String a = new String("hello");  // 堆上新对象
String b = a.intern();           // 将 "hello" 放入常量池（如果不存在）
String c = "hello";              // 直接引用常量池
b == c  // true
```

`intern()` 的行为：
- 如果 StringTable 中已有该字符串 → 返回已有引用
- 如果没有 → 将引用放入 StringTable，返回该引用

### JDK 7 的变化

JDK 7 之前，StringTable 在永久代中。JDK 7 将其移到了堆中，由 GC 管理。

这意味着 `intern()` 创建的字符串不再占用永久代空间，可以被 GC 回收。但过度使用 `intern()` 仍然会导致 StringTable 膨胀，增加 GC 压力。

### 实际性能影响

```java
// 不要用 intern() 存储大量不重复的字符串
// 每个字符串都会在 StringTable 中留下记录，即使原对象已被 GC
List<String> list = new ArrayList<>();
for (int i = 0; i < 1_000_000; i++) {
    list.add(new String("str" + i).intern());  // StringTable 膨胀！
}
```

### 字符串拼接的编译器优化

```java
String s = "a" + "b" + "c";
// 编译器直接优化为 String s = "abc";（常量折叠）

String s = "a";
s = s + "b";  // 编译为 new StringBuilder().append("a").append("b").toString()
```

JDK 9+ 引入 `invokedynamic` 指令优化字符串拼接（`StringConcatFactory`），性能接近手写 `StringBuilder`。

---

> 本章建立了 JVM 内存的完整世界观。下一章将深入对象模型——从 `new` 到对象消亡，覆盖对象创建、内存布局、Mark Word，这是 GC 和并发锁机制的关键前置知识。
