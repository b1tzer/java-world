# 第五章 JIT 编译

> 本章回答"为什么 Java 不是一直解释执行，而是越来越快"。从解释器到 C2 的分层编译，到方法内联、逃逸分析、循环展开等具体优化手段，再到去优化的自适应机制。

---

## 5.1 为什么需要 JIT

| 模式 | 启动速度 | 峰值性能 | 适用场景 |
|------|---------|---------|---------|
| 解释执行 | 快 | 差 | 小程序、脚本 |
| AOT（提前编译） | 快 | 一般 | 启动敏感场景（GraalVM Native Image） |
| JIT（即时编译） | 慢（需要预热） | 最优 | 长期运行的服务端 |

Java 的答案是**混合模式**：先用解释器快速启动，热点代码交给 JIT 编译优化。

这就是为什么 Java 服务启动后需要"预热"——刚开始是解释执行，性能较差；运行一段时间后，热点代码被 JIT 编译成机器码，性能大幅提升。

### 解释 vs 编译的性能差距

```java
// 一个简单的方法调用循环
for (int i = 0; i < 100_000_000; i++) {
    sum += compute(i);
}
```

| 执行方式 | 耗时（相对值） | 原因 |
|---------|-------------|------|
| 纯解释执行 | 100x | 每次执行都要解析字节码 |
| C1 编译 | 10x | 机器码，保守优化 |
| C2 编译 | 1x | 机器码，激进优化（内联、逃逸分析、向量化） |

---

## 5.2 HotSpot 编译体系

```
解释执行（Interpreter）
      ↓ 热点探测（方法调用次数 > 阈值）
C1 编译（Client Compiler）—— 快速编译，保守优化
      ↓ 更热（调用次数进一步增加）
C2 编译（Server Compiler）—— 深度编译，激进优化
```

### 分层编译（Tiered Compilation）

JDK 8+ 默认开启分层编译（`-XX:+TieredCompilation`），将编译分为 5 个层级：

| 层级 | 编译方式 | 特点 |
|------|---------|------|
| Level 0 | 解释执行 | 收集基本 profiling 数据 |
| Level 1 | C1，简单编译 | 不收集 profiling |
| Level 2 | C1，有限 profiling | 收集调用计数和分支概率 |
| Level 3 | C1，完整 profiling | 收集完整的类型信息和分支概率 |
| Level 4 | C2，深度优化 | 基于 profiling 数据做激进优化 |

一个典型的热点方法经历：

```
方法首次调用 → Level 0（解释执行，收集 profiling）
  ↓ 调用次数增加
Level 3（C1 编译 + 完整 profiling）
  ↓ 调用次数继续增加
Level 4（C2 编译，基于 Level 3 的 profiling 做激进优化）
```

### 热点探测

JVM 使用**方法调用计数器**和**回边计数器**来判断代码是否"热"：

- **方法调用计数器**：方法被调用的次数，阈值默认 10000 次（`-XX:CompileThreshold`）
- **回边计数器**：循环体执行的次数，阈值默认 10700 次（`-XX:OnStackReplacePercentage`）

两个计数器任一达到阈值，就触发编译。

### Profiling 收集的信息

| 信息类型 | 用途 | 示例 |
|---------|------|------|
| 类型 profiling | 虚方法去虚化 | `interface.method()` 只有一个实现 → 直接调用 |
| 分支 profiling | 条件预测 | `if (x > 0)` 99% 为 true → 优先编译 true 分支 |
| 调用 profiling | 方法内联决策 | 被调用方法很小 → 内联 |
| 循环 profiling | 循环展开 | 循环次数为 4 的倍数 → 展开 4 次 |

---

## 5.3 方法内联

**最重要的 JIT 优化，没有之一。**

方法内联将被调用方法的代码直接嵌入调用方，消除方法调用开销（栈帧创建与销毁、参数传递、返回值处理）。

### 内联的效果

```java
// 内联前
public int add(int a, int b) { return a + b; }
public int calculate() { return add(1, 2) + add(3, 4); }

// 内联后（JIT 优化）
public int calculate() { return 1 + 2 + 3 + 4; }

// 进一步优化（常量折叠）
public int calculate() { return 10; }
```

### 内联是后续优化的基础

内联不仅消除了方法调用开销，还为后续优化打开了空间：

```
原始代码:
  result = add(1, 2) + multiply(3, 4);

内联后:
  result = 1 + 2 + 3 * 4;

常量折叠:
  result = 15;

逃逸分析（如果 result 是局部变量）:
  → 标量替换，消除 result 对象
```

没有内联，逃逸分析和常量折叠都无法进行——因为方法调用是"黑盒"，JIT 看不到方法内部。

### 内联阈值

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `-XX:MaxInlineSize` | 35 字节 | 小于此大小的方法自动内联 |
| `-XX:FreqInlineSize` | 325 字节 | 热点方法的内联阈值 |
| `-XX:MaxInlineLevel` | 9 | 最大内联深度（方法 A 调用 B 调用 C...） |

```java
// 小方法 → 自动内联
public int add(int a, int b) { return a + b; }  // 字节码 < 35 字节

// 大方法 → 通常不会内联
public void process() { /* 100 行代码 */ }  // 字节码 > 325 字节
```

### 内联与虚方法

虚方法（`invokevirtual`）的目标在编译期不确定——可能是子类的实现。JIT 通过 profiling 收集的信息做**去虚化**：

```java
interface Parser {
    String parse(String input);
}

// 运行时只有一个实现：JsonParser
Parser parser = getParser();
parser.parse(data);  // invokeinterface

// JIT 发现只有一个实现 → 直接内联 JsonParser.parse()
// 如果后来加载了新的实现 → 去优化
```

---

## 5.4 逃逸分析与相关优化

第三章对象模型已经介绍了逃逸分析的概念。JIT 编译器利用逃逸分析的结果做三种优化：

### 栈上分配

未逃逸的对象在栈帧上创建，方法结束时自动销毁，不需要 GC 回收。这对大量短生命周期对象的场景特别有效。

```java
// 未逃逸：point 只在方法内部使用
public int calculateDistance(int x1, int y1, int x2, int y2) {
    Point p1 = new Point(x1, y1);  // 不逃逸
    Point p2 = new Point(x2, y2);  // 不逃逸
    return (int) Math.sqrt(
        Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
    );
}

// JIT 优化后（栈上分配或标量替换）：
// Point 对象完全消失，x1/y1/x2/y2 直接在栈帧的局部变量表中
```

### 标量替换

将对象拆散为基本类型标量，完全消除对象分配：

```java
// 原始
Point p = new Point(1, 2);
int sum = p.x + p.y;

// 标量替换后
int x = 1, y = 2;
int sum = x + y;
// Point 对象消失了
```

标量替换比栈上分配更彻底——连栈上的对象都不创建，直接用基本类型变量替代。

### 锁消除

如果对象不逃逸出方法，不可能被其他线程访问，同步操作可以安全去除：

```java
// JIT 发现 sb 不会逃逸
public String concat(String[] parts) {
    StringBuilder sb = new StringBuilder();  // 局部变量，不逃逸
    for (String part : parts) {
        sb.append(part);  // synchronized 块被消除
    }
    return sb.toString();
}
```

`StringBuilder.append()` 内部有 `synchronized`，但 JIT 通过逃逸分析发现 `sb` 不会逃逸出方法，不可能被其他线程访问，因此安全地消除了锁。

### 逃逸分析的局限

- 逃逸分析本身有开销，不是所有方法都值得分析
- 栈上分配在实际 HotSpot 中实现不完善，更多依赖标量替换
- `-XX:+DoEscapeAnalysis` 默认开启，`-XX:+EliminateAllocations` 默认开启

---

## 5.5 循环优化

JIT 对循环有多种优化手段：

### 循环展开（Loop Unrolling）

减少循环判断次数，增加每次迭代的工作量：

```java
// 原始
for (int i = 0; i < 4; i++) {
    sum += arr[i];
}

// 展开 4 次
sum += arr[0];
sum += arr[1];
sum += arr[2];
sum += arr[3];
```

循环展开减少了分支判断和循环计数器的开销。JIT 会根据 profiling 数据判断循环次数是否为常数或倍数，决定是否展开。

### 循环不变量外提（Loop-Invariant Code Motion）

将循环内不变的计算移到循环外：

```java
// 原始
for (int i = 0; i < n; i++) {
    result += arr[i] * Math.PI;  // Math.PI 每次都计算
}

// 优化后
double pi = Math.PI;  // 外提
for (int i = 0; i < n; i++) {
    result += arr[i] * pi;
}
```

### 向量化（SIMD）

JIT 可以将标量运算替换为 SIMD 指令（如 SSE/AVX），一次处理多个数据：

```java
// 原始：逐个相加
for (int i = 0; i < arr.length; i++) {
    result[i] = a[i] + b[i];
}

// SIMD 优化：一条指令处理 4 个 int（128 位 SSE）
// 一条指令处理 8 个 int（256 位 AVX）
```

向量化需要满足条件：循环体简单、数据对齐、没有循环依赖。

---

## 5.6 去优化（Deoptimization）

JVM 有时会"倒退"回解释执行。这是自适应优化的核心机制。

### 什么时候触发去优化

| 场景 | 原因 |
|------|------|
| 新类加载 | 编译时假设只有一个实现，新实现类加载后假设失效 |
| 类的反初始化 | 类被卸载 |
| 逆优化标志 | 编译代码中嵌入了逆优化检查点 |
| profiling 失效 | 实际执行路径与编译时假设不符 |

### 去优化的过程

```
C2 编译（假设只有 1 个实现）
      ↓ 新的实现类被加载
假设失效 → 去优化 → 回到解释执行
      ↓ 重新 profiling
C2 重新编译（考虑多个实现）
```

### 示例：接口去虚化失败

```java
interface Parser {
    String parse(String input);
}

// 第一阶段：只有 JsonParser 一个实现
Parser parser = getParser();  // JIT 内联 JsonParser.parse()
parser.parse(data);

// 第二阶段：加载了 XmlParser
// → 去优化，回退到解释执行
// → 重新 profiling
// → C2 编译，使用分支预测处理两种实现
```

### 去优化不是错误

去优化是 JVM 自适应优化的一部分——它不是错误，而是 JVM 根据运行时信息动态调整策略的机制。

```bash
# 观察去优化事件
-Xlog:compilation*=info
# 或使用 JFR 录制 Deoptimization 事件
```

---

## 5.7 实战：观察 JIT 编译

### 打印编译日志

```bash
# 打印编译信息
-XX:+PrintCompilation

# 输出示例:
#   76   1       3       java.lang.String::hashCode (55 bytes)
#   78   2       4       java.lang.String::hashCode (55 bytes)
#   79   3       3       java.lang.String::charAt (29 bytes)
# 含义：编译ID 编译次数 编译层级(3=C1,4=C2) 方法名 (字节码大小)
```

### 使用 JITWatch 可视化

JITWatch 是一个 JIT 编译日志分析工具，可以查看哪些方法被内联、哪些被编译、编译后的机器码。

```bash
# 1. 开启编译日志
-XX:+UnlockDiagnosticVMOptions
-XX:+TraceClassLoading
-XX:+LogCompilation
-XX:LogFile=jit.log

# 2. 使用 JITWatch 分析 jit.log
```

### 使用 JFR 观察 JIT 事件

```bash
jcmd <pid> JFR.start settings=profile filename=jit.jfr duration=60s
```

JFR 中的 JIT 相关事件：
- `CompilerCompilation`：方法被编译
- `CompilerInlining`：方法被内联
- `Deoptimization`：去优化事件

---

> 本章解释了 Java 为什么越跑越快。下一章将所有 JVM 理论落地为实战——线上问题排查与诊断。
