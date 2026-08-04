# 第六章 线上排查与诊断

> 本章将前五章的理论落地为实战能力。覆盖 OOM、CPU 100%、Full GC 等常见问题的诊断流程，以及 MAT、Thread Dump、Arthas 等工具的使用。

---

## 6.1 JVM 常见故障速查

| 现象 | 首选诊断方向 |
|------|-------------|
| CPU 100% | `top -Hp <pid>` → 找最忙的线程 → `jstack` 看栈 |
| 频繁 Full GC | GC 日志 → 内存 dump → MAT 分析大对象 |
| OOM | `-XX:+HeapDumpOnOutOfMemoryError` → MAT 分析 |
| StackOverflow | 检查无限递归 / 过深调用栈 |
| Metaspace OOM | 检查动态代理/反射/脚本引擎是否生成大量类 |

---

## 6.2 CPU 100% 诊断流程

```bash
# 1. 找到 Java 进程 PID
jps -l

# 2. 找到 CPU 最高的线程
top -Hp <pid>

# 3. 将线程 ID 转为十六进制
printf "%x\n" <tid>

# 4. 在 thread dump 中查找该线程
jstack <pid> | grep -A 30 "<tid in hex>"
```

输出的栈信息会告诉你这个线程在执行什么代码——是死循环、是正则回溯、还是锁竞争。

---

## 6.3 Heap Dump 分析

### 获取方式

```bash
# 方式 1：OOM 时自动生成（推荐，线上必开）
-XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=/path/to/dumps/

# 方式 2：手动 dump
jmap -dump:format=b,file=heap.hprof <pid>

# 方式 3：Arthas
heapdump /path/to/heap.hprof
```

### MAT（Memory Analyzer Tool）四大核心功能

**1. Leak Suspects Report。** 自动分析 dump 文件，识别可疑的内存泄漏点。

**2. Histogram。** 按类统计对象数量和占用空间。找到"数量异常多"或"占用异常大"的类。

**3. Dominator Tree。** 找到阻止 GC 回收的最大对象——这些对象持有了大量其他对象的引用。

**4. Path to GC Roots。** 从某个对象出发，追溯到 GC Root 的引用链。回答"为什么这个对象没有被回收"。

---

## 6.4 Thread Dump 分析

```bash
# 获取方式
jstack <pid>              # 推荐
kill -3 <pid>             # 输出到 stdout
Arthas: thread            # 交互式分析
```

### 关键线程状态

| 状态 | 含义 | 关注点 |
|------|------|--------|
| RUNNABLE | 正在运行或等待 CPU | CPU 热点线程 |
| BLOCKED | 等待获取锁 | 锁竞争问题 |
| WAITING | 无限期等待 | `wait()`、`join()`、`park()` |
| TIMED_WAITING | 限时等待 | `sleep()`、`wait(timeout)` |

### 死锁检测

`jstack` 输出末尾会自动检测死锁：

```
Found one Java-level deadlock:
=============================
"Thread-1":
  waiting to lock monitor 0x00007f8b4c003a18 (object 0x00000007aab3a0d0, a java.lang.Object),
  which is held by "Thread-0"
"Thread-0":
  waiting to lock monitor 0x00007f8b4c006358 (object 0x00000007aab3a0e0, a java.lang.Object),
  which is held by "Thread-1"
```

---

## 6.5 Arthas 核心命令

Arthas 是阿里开源的 Java 诊断工具，无需重启即可实时诊断线上问题。

| 命令 | 用途 | 示例 |
|------|------|------|
| `dashboard` | 实时看板（线程、内存、GC） | `dashboard` |
| `thread` | 线程分析 | `thread -n 3`（最忙的 3 个线程） |
| `thread -b` | 查找阻塞线程 | `thread -b` |
| `trace` | 方法调用链路耗时 | `trace com.example.UserService getUser` |
| `jad` | 反编译线上代码 | `jad com.example.UserService` |
| `watch` | 方法入参/返回值/异常 | `watch com.example.UserService getUser '{params, returnObj}'` |
| `heapdump` | 生成 dump 文件 | `heapdump /tmp/dump.hprof` |
| `ognl` | 执行表达式 | `ognl '@com.example.Config@getInstance()'` |

### 常用诊断场景

**场景 1：接口变慢**

```bash
# 追踪方法耗时，找出哪个调用慢
trace com.example.OrderService createOrder

# 输出
+---[3.2ms] com.example.OrderService:createOrder()
    +---[1.1ms] com.example.UserDao:findById()
    +---[0.8ms] com.example.OrderDao:save()
    +---[1.2ms] com.example.NotificationService:send()  ← 这里最慢
```

**场景 2：确认线上代码是否最新**

```bash
# 反编译正在运行的代码
jad com.example.OrderService

# 对比源码，确认是否是最新版本
```

**场景 3：查看方法参数和返回值**

```bash
# 监控方法调用
watch com.example.UserService getUser '{params[0], returnObj}' -x 2

# 输出
params[0]: 12345
returnObj: User{id=12345, name='Tom', age=25}
```

---

## 6.6 JVM 核心参数速查

| 类别 | 参数 | 说明 |
|------|------|------|
| 堆内存 | `-Xms4g -Xmx4g` | 初始/最大堆，线上设为一致 |
| 新生代 | `-Xmn2g` | 新生代大小 |
| 栈大小 | `-Xss256k` | 每个线程的栈大小 |
| GC 算法 | `-XX:+UseG1GC` | 选择收集器 |
| GC 停顿 | `-XX:MaxGCPauseMillis=200` | G1 目标停顿时间 |
| GC 日志 | `-Xlog:gc*=info:file=gc.log` | JDK 9+ 统一格式 |
| OOM dump | `-XX:+HeapDumpOnOutOfMemoryError` | OOM 时自动 dump |
| dump 路径 | `-XX:HeapDumpPath=/path/` | dump 文件存储位置 |
| Metaspace | `-XX:MaxMetaspaceSize=256m` | 限制 Metaspace 大小 |
| 压缩指针 | `-XX:+UseCompressedOops` | 64 位 JVM 默认开启 |

---

> 第二卷到此结束。从字节码 → 类加载 → 内存模型 → 对象模型 → GC → JIT → 线上排查，读者已经建立起 Java 代码从源码到机器执行的完整心智模型。
>
> **与后续卷的连接：**
> - 第三卷并发：AQS 依赖对象头和 Monitor，synchronized 依赖 Mark Word 锁升级
> - 第六卷 Spring：反射依赖 Class 元数据，CGLIB 依赖字节码操作
> - 第七卷性能：GC 调优依赖分代模型和收集器特性的理解
