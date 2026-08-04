# 第二卷 JVM Runtime —— 一行 Java 代码是如何运行起来的

> 第一卷回答"Java 提供了哪些表达能力"，第二卷回答"这些代码到底是如何被 JVM 接收、加载、执行和管理的"。整卷遵循 Java 程序的生命周期组织：字节码 → 类加载 → 内存 → 对象 → GC → JIT → 诊断。共 6 章。

---

## 1 字节码与类加载

本章目标：将原"Class 文件"和"类加载机制"合并。不需要逐字段展开 ClassFile 结构，建立"源码编译后变成了什么"和"如何进入 JVM"的整体认知即可。

### 1.1 为什么需要字节码

Java 不直接输出机器码，而是输出字节码。三个核心原因：

- **平台无关**：同一份 `.class` 可在任何平台的 JVM 上运行
- **运行时优化**：JVM 可根据实际运行情况做 JIT 优化（AOT 做不到）
- **语言生态统一**：Kotlin、Scala 都编译到同一套字节码，共享 JVM

### 1.2 Class 文件结构概览

不需要记住每个字段的偏移量，理解整体结构即可：

```
ClassFile {
    magic (CAFEBABE) / version
    constant_pool[]    ← 信息仓库：类名、方法名、字段名、字面量
    access_flags       ← public / abstract / final 等
    this_class / super_class / interfaces[]
    fields[]           ← 字段定义
    methods[]          ← 方法定义（含字节码）
    attributes[]       ← 可扩展元数据（注解、泛型签名等）
}
```

常量池是核心——所有符号引用（类名、方法名、描述符）都存在这里，字段和方法通过索引引用。属性表是可扩展的元数据容器，注解（`RuntimeVisibleAnnotations`）、泛型签名（`Signature`）都存储在这里（连接第一卷泛型和注解）。

### 1.3 字节码指令分类认知

不要求背全部指令，建立分类认知：

| 类别 | 典型指令 | 对应操作 |
|------|---------|---------|
| 加载/存储 | `aload`、`iload`、`astore`、`istore` | 局部变量 ↔ 操作数栈 |
| 算术运算 | `iadd`、`lsub`、`imul` | 数值计算 |
| 对象操作 | `new`、`getfield`、`putfield` | 创建对象、访问字段 |
| 方法调用 | `invokevirtual`、`invokestatic`、`invokeinterface`、`invokespecial`、`invokedynamic` | 不同类型的方法调用 |
| 控制转移 | `ifeq`、`goto`、`tableswitch` | 分支与循环 |

关键：让读者看到 `a + b` 在字节码层面是 `iload` → `iload` → `iadd` → `istore`，真正理解"Java 代码最终变成了什么"。

### 1.4 字节码与语言特性的映射

| 语言特性 | 字节码层面的体现 |
|---------|---------------|
| 泛型 | `Signature` 属性（擦除后保留签名信息） |
| Lambda | `invokedynamic` + `LambdaMetafactory` |
| 注解 | `RuntimeVisibleAnnotations` 属性 |
| 内部类 | `EnclosingMethod` 属性 + `$` 命名 |

### 1.5 类加载的完整生命周期

```
加载 → 验证 → 准备 → 解析 → 初始化 → 使用 → 卸载
```

| 阶段 | 做了什么 | 为什么要在这步做 |
|------|---------|----------------|
| 加载 | 通过全限定名获取字节流，生成 `Class` 对象 | 将外部字节码转为 JVM 可操作的形式 |
| 验证 | 文件格式、元数据、字节码、符号引用验证 | 保证安全性，防止恶意字节码破坏 JVM |
| 准备 | 为静态变量分配内存并赋零值 | 保证字段在未显式赋值前有默认值 |
| 解析 | 符号引用 → 直接引用 | 将符号转为内存中的实际地址 |
| 初始化 | 执行 `<clinit>`，真正赋值静态变量 | 保证静态代码块在类首次主动使用时执行 |

### 1.6 双亲委派模型

```
Bootstrap ClassLoader（rt.jar，C++ 实现）
        ↑
Platform ClassLoader（JDK 9+，替代 Extension ClassLoader）
        ↑
Application ClassLoader（classpath）
        ↑
自定义 ClassLoader
```

为什么需要：安全（`java.lang.String` 不可被替换）、避免重复加载、层次化信任。

### 1.7 打破双亲委派

| 场景 | 为什么打破 | 如何打破 |
|------|----------|---------|
| **SPI（如 JDBC Driver）** | 核心库需要调用应用层实现 | 线程上下文类加载器 |
| **Tomcat** | 隔离不同 Web App | 每个 Web App 使用独立的 WebAppClassLoader |
| **OSGi** | 模块化 + 版本共存 | 网状 ClassLoader，每个 Bundle 独立 |

### 1.8 自定义 ClassLoader

三个关键方法：`loadClass()`（双亲委派入口）、`findClass()`（子类实现查找逻辑）、`defineClass()`（字节数组转 Class 对象）。应用场景：网络加载类、加密 Class 解密、热部署。

---

## 2 JVM 内存模型

本章目标：建立完整的内存世界观。堆、栈、方法区的分工与协作，是一切内存调优和 GC 理解的大前提。

### 2.1 JVM 内存全景图

```
JVM 运行时数据区
 ├── 线程共享
 │    ├── Heap（堆）—— 对象实例、数组
 │    └── Method Area（方法区 / Metaspace）—— 类信息、常量、静态变量
 └── 线程私有
      ├── VM Stack（虚拟机栈）—— 栈帧
      ├── Native Method Stack
      └── PC Register（程序计数器）
```

### 2.2 方法调用与栈帧

| 组件 | 作用 |
|------|------|
| 局部变量表 | 存放方法参数和局部变量 |
| 操作数栈 | JVM 基于栈的运算中转站 |
| 动态链接 | 指向运行时常量池中该方法的符号引用 |
| 返回地址 | 方法调用后的下一条指令地址 |

### 2.3 堆内存

对象实例和数组存放于此。分代划分：

```
┌── Eden ──────────┐  ← 新对象
│  S0 │  S1        │  ← Survivor 区
├──────────────────┤
│   老年代          │  ← 长期存活对象
└──────────────────┘
```

### 2.4 方法区与 Metaspace 演进

| | JDK 7 及以前 | JDK 8+ |
|---|---|---|
| 实现 | 永久代（PermGen，堆的一部分） | Metaspace（本地内存） |
| 大小限制 | `-XX:MaxPermSize` 固定 | 默认不设上限 |
| 常见问题 | PermGen OOM | Metaspace OOM（大量动态生成类） |

### 2.5 StringTable 与字符串驻留

- `intern()` 将字符串放入 StringTable
- JDK 7 后 StringTable 从永久代移到堆，GC 管理
- 适度使用 `intern()` 节省内存，过度使用会导致 StringTable 膨胀

---

## 3 对象模型

本章目标：很多 JVM 书弱化这一部分，但它极其重要。从 `new` 到对象消亡，覆盖对象创建、内存布局、Mark Word、TLAB 和逃逸分析，连接后续的 GC、JIT 和并发章节。

### 3.1 new 一个对象发生了什么

```
new 指令
  ↓
检查类是否已加载 → 未加载则先加载
  ↓
分配内存（指针碰撞 / 空闲列表，CAS + TLAB）
  ↓
初始化零值（保证字段可以不赋初值就使用）
  ↓
设置对象头（Mark Word + Klass Pointer）
  ↓
执行 <init> 构造方法
```

### 3.2 对象内存布局

```
┌──────────────┐
│  对象头       │ ← Mark Word（8B）+ Klass Pointer（4B/8B）
├──────────────┤
│  实例数据     │ ← 父类字段在前，子类字段在后，按宽度对齐
├──────────────┤
│  对齐填充     │ ← 保证 8 字节对齐
└──────────────┘
```

### 3.3 Mark Word：对象头的核心

| 锁状态 | 23bit | 2bit | 4bit | 1bit(偏向) | 2bit(锁标志) |
|--------|-------|------|------|-----------|------------|
| 无锁 | hashCode | 分代年龄 | 0 | 0 | 01 |
| 偏向锁 | ThreadID + Epoch | 分代年龄 | 0 | 1 | 01 |
| 轻量锁 | 指向栈中锁记录的指针 | | | | 00 |
| 重量锁 | 指向 Monitor 的指针 | | | | 10 |
| GC 标记 | 空 | | | | 11 |

直接连接第三卷 `synchronized` 与锁升级。

### 3.4 TLAB（线程本地分配缓冲）

- 每个线程在 Eden 区有一块私有缓冲区（TLAB）
- TLAB 内分配只需指针移动，无需 CAS
- `-XX:+UseTLAB`（默认开启）

### 3.5 逃逸分析

连接 JIT 编译（第 5 章）：

- 对象仅在方法内使用 → **未逃逸**
- 未逃逸的三种优化：栈上分配、标量替换、锁消除

---

## 4 垃圾回收

本章目标：理解 GC 的完整理论体系和 HotSpot 演进路线。

### 4.1 为什么需要 GC

C/C++ 手动管理：内存泄漏、野指针、Use-After-Free。Java 自动管理，代价是 STW（Stop-The-World）。

### 4.2 如何判定对象存活

**可达性分析**（Java 采用）：

```
GC Roots ──→ Object A ──→ Object B（存活）
                    │
                    └──→ Object D（存活）

         Object H ──→ Object I（垃圾，不可达）
```

GC Roots 包括：虚拟机栈引用、静态字段、常量、JNI 引用、被 `synchronized` 持有的对象。

### 4.3 四种引用类型

| 引用类型 | 回收时机 | 典型用途 |
|---------|---------|---------|
| 强引用 | 永不回收（除非不可达） | 普通 `new` |
| 软引用 | 内存不足时回收 | 缓存 |
| 弱引用 | 下次 GC 必定回收 | `WeakHashMap`、`ThreadLocal` |
| 虚引用 | 无法通过它获取对象 | 对象回收跟踪、NIO Cleaner |

### 4.4 垃圾回收算法

| 算法 | 思路 | 优点 | 缺点 |
|------|------|------|------|
| 标记-清除 | 标记存活 → 统一清除 | 简单 | 内存碎片 |
| 标记-复制 | 存活对象复制到新空间 | 无碎片 | 浪费一半空间 |
| 标记-整理 | 存活对象向一端移动 | 无碎片 | 耗时 |

### 4.5 分代收集思想

基于经验假设：**绝大多数对象朝生夕灭**。

- 新生代（Eden + S0/S1）：复制算法，Minor GC 频繁但快速
- 老年代：标记-清除/整理，Major GC 较少但耗时长

### 4.6 HotSpot 收集器演进

| 收集器 | 代 | 目标 | 核心特点 |
|--------|---|------|---------|
| Serial | 新生代 | 简单高效 | 单线程 |
| Parallel | 新生代 | 高吞吐 | 多线程并行 |
| CMS | 老年代 | 低延迟 | 并发标记清除，三次 STW + 并发清除 |
| G1 | 整堆 | 可预测停顿 | Region 化整为零，JDK 9 默认 |
| ZGC | 整堆 | 亚毫秒 STW | 染色指针 + 读屏障 |

CMS 三个致命缺陷：CPU 敏感、浮动垃圾、碎片化导致退化 Serial Old。

G1 核心创新：Region + RSet 解决跨 Region 引用 + `-XX:MaxGCPauseMillis` 控制停顿。

ZGC 核心技术：染色指针在 64 位指针中嵌入 GC 元数据。

---

## 5 JIT 编译

本章目标：回答"为什么 Java 越跑越快"。精简原版的分层编译细节，聚焦核心机制。

### 5.1 为什么需要 JIT

| 模式 | 启动速度 | 峰值性能 | 适用场景 |
|------|---------|---------|---------|
| 解释执行 | 快 | 差 | 小程序 |
| AOT | 快 | 一般 | 启动敏感场景 |
| JIT | 慢（需要预热） | 最优 | 长期运行的服务端 |

Java 的答案是**混合模式**：先用解释器快速启动，热点代码交给 JIT 编译优化。

### 5.2 HotSpot 编译体系

```
解释执行 → C1 编译（快速编译，保守优化）→ C2 编译（深度编译，激进优化）
```

分层编译（JDK 8+ 默认）：解释执行 → C1 → C1 + profiling → C2。不需要展开到 Level 0-4 的每个细节。

### 5.3 方法内联

**最重要的 JIT 优化，没有之一。** 消除方法调用开销，为后续优化（逃逸分析、常量折叠）打开空间。`-XX:MaxInlineSize` 控制内联阈值。

### 5.4 逃逸分析与相关优化

连接第 3 章对象模型：

- **栈上分配**：未逃逸对象在栈帧上创建，随方法结束自动销毁
- **标量替换**：将对象打散为基本类型标量
- **锁消除**：对象不出方法，同步代码块直接去掉

### 5.5 去优化（Deoptimization）

JVM 有时会"倒退"回解释执行——编译时做了激进假设（如"这个接口只有一个实现"），运行时假设失效（新类被加载），主动回退并用新数据重新编译。

---

## 6 线上排查与诊断

本章目标：将前五章理论落地为实战能力。合并原版"JVM 调优"和"诊断工具"为统一的排查体系。

### 6.1 JVM 常见故障速查

| 现象 | 首选诊断方向 |
|------|-------------|
| CPU 100% | `top -Hp` → 线程 dump → 定位热点代码 |
| 频繁 Full GC | GC 日志 → 内存 dump → MAT 分析大对象 |
| OOM | `-XX:+HeapDumpOnOutOfMemoryError` → MAT |
| StackOverflow | 检查无限递归 / 过深调用栈 |
| Metaspace OOM | 检查动态代理/反射/脚本引擎是否生成大量类 |

### 6.2 Heap Dump 分析

获取方式：`-XX:+HeapDumpOnOutOfMemoryError`、`jmap -dump`、Arthas `heapdump`。

MAT 四大核心功能：

- **Leak Suspects Report**：自动识别可疑内存泄漏
- **Histogram**：按类统计对象数量和占用空间
- **Dominator Tree**：找到阻止 GC 的最大对象
- **Path to GC Roots**：追溯对象为何不被回收

### 6.3 Thread Dump 分析

获取方式：`jstack <pid>`、`kill -3 <pid>`、Arthas `thread`。

关键线程状态：RUNNABLE、BLOCKED、WAITING、TIMED_WAITING。死锁自动检测：输出末尾 `Found one Java-level deadlock`。

### 6.4 Arthas 核心命令

| 命令 | 用途 |
|------|------|
| `dashboard` | 实时看板（线程、内存、GC） |
| `thread` | 线程分析、CPU 热点、死锁 |
| `trace` | 方法调用链路耗时 |
| `jad` | 反编译确认线上代码 |
| `heapdump` | 生成 dump 文件 |
| `watch` | 方法入参/返回值/异常监控 |

### 6.5 JVM 核心参数速查

| 类别 | 参数示例 | 说明 |
|------|---------|------|
| 堆内存 | `-Xms4g -Xmx4g` | 初始/最大堆大小，线上建议设为一致 |
| GC | `-XX:+UseG1GC`、`-XX:MaxGCPauseMillis=200` | 选择收集器与目标停顿 |
| 日志 | `-Xlog:gc*=info:file=gc.log` | GC 日志（JDK 9+ 统一格式） |
| OOM | `-XX:+HeapDumpOnOutOfMemoryError` | OOM 时自动 dump |
| Metaspace | `-XX:MaxMetaspaceSize=256m` | 防止 Metaspace 无限膨胀 |

---

> 第二卷从原来的 8 章压缩为 6 章。合并了 Class 文件 + 类加载为 1 章，精简了 JIT 的分层编译细节，将诊断工具统一到排查体系中。读者建立起 Java 代码从源码到机器执行的完整心智模型。
>
> **与全书其他卷的纵横联系：**
>
> | 后续卷 / 框架 | 依赖本卷的哪部分 |
> |-------------|----------------|
> | 第三卷 并发 | AQS 依赖对象头和 Monitor；synchronized 依赖 Mark Word 锁升级 |
> | Spring / 动态代理 | 反射依赖 Class 元数据；CGLIB/ASM 依赖字节码操作 |
> | Lambda & Stream | `invokedynamic` + `LambdaMetafactory` 的基础在字节码与类加载 |
> | GC 调优 | 依赖对象生命周期和分代模型的理解 |
> | 网络编程 | DirectByteBuffer 依赖直接内存模型 |
