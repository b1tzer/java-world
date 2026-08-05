# 第10章 并发编程模型：从线程到异步

> 我们已经有了线程和锁，为什么还需要新的并发模型？Future 解决了什么，又留下了什么遗憾？CompletableFuture 如何用链式调用构建复杂的异步流水线？响应式编程和 Actor 模型又分别代表了怎样的并发哲学？面对不同的业务场景，我们该如何选择？

---

前面的章节中，我们一直在用"线程 + 共享内存 + 锁"这个经典模型来解决并发问题。这个模型在 CPU 密集型或连接数有限的场景下表现良好，但当系统需要处理成千上万的并发 IO 操作时，它的局限性就暴露出来了。本章将带你走出线程池的世界，看看 Java 生态中更现代、更高层次的并发编程模型。

## 10.1 Future 的局限

### 10.1.1 从回调到 Future

在 Java 5 之前，异步编程基本靠 `Thread` + `Runnable`。你提交一个任务，但拿不到返回值。Java 5 引入了 `Future`，终于可以"未来取值"了：

```java
ExecutorService executor = Executors.newFixedThreadPool(4);

Future<String> future = executor.submit(() -> {
    // 模拟耗时操作
    Thread.sleep(2000);
    return "Hello from async task";
});

// 问题来了：这里阻塞了
String result = future.get();  // 主线程在这里等着，直到任务完成
System.out.println(result);
```

`Future` 解决了"获取异步结果"的问题，但它的设计有三个明显的短板：

### 10.1.2 Future 的三大痛点

| 痛点 | 说明 | 后果 |
|------|------|------|
| `get()` 阻塞 | 调用 `get()` 会阻塞当前线程，直到结果就绪 | 违背异步初衷，白白占着线程 |
| 无回调机制 | 无法注册"结果就绪后执行"的回调 | 只能轮询或阻塞，无法被动通知 |
| 无法组合 | 不能表达"A 完成后再做 B"的依赖关系 | 多步异步操作只能嵌套或手动编排 |

```java
// 痛点一：get() 阻塞
Future<String> f1 = executor.submit(() -> queryFromDB());
Future<String> f2 = executor.submit(() -> callRemoteService());

// 虽然 f1 和 f2 是并行提交的，但取结果时必须依次阻塞
String r1 = f1.get();  // 阻塞等 f1
String r2 = f2.get();  // 再阻塞等 f2（其实此时可能早就完成了）

// 痛点三：无法组合——想做"先查DB，再调远程"怎么办？
// 只能这样写：
Future<String> f3 = executor.submit(() -> {
    String dbResult = f1.get();  // 阻塞！在另一个线程里阻塞
    return callRemoteService(dbResult);
});
// 嵌套地狱，线程利用率低
```

核心矛盾：**Future 把异步计算的结果包装了，但没有提供组合和通知机制**。你拿到了一个"未来会有的值"，但除了阻塞等待，没有更好的办法来使用它。

## 10.2 CompletableFuture

JDK 8 引入的 `CompletableFuture` 终于补齐了 Future 的短板。它借鉴了函数式编程中 Monad 的思想，提供了链式组合、回调通知、异常传播等能力，是 Java 中真正意义上的异步编程工具。

### 10.2.1 核心方法全景

`CompletableFuture` 的 API 看起来很多，但可以按功能分成四类：

**创建**

```java
// 1. 手动创建
CompletableFuture<String> cf = new CompletableFuture<>();
cf.complete("result");  // 手动完成

// 2. 异步执行（使用 ForkJoinPool.commonPool()）
CompletableFuture<String> cf2 = CompletableFuture.supplyAsync(() -> queryDB());

// 3. 指定线程池
CompletableFuture<String> cf3 = CompletableFuture.supplyAsync(() -> queryDB(), myExecutor);
```

### 为什么不传线程池是危险的

上面的 `supplyAsync(() -> queryDB())` 没有传第二个参数，它默认使用 `ForkJoinPool.commonPool()`。这个 commonPool 是全局共享的，线程数 = CPU 核数 - 1。

听起来没问题？想想这个场景：

```java
// 10 个并发请求，每个都要查数据库（阻塞 IO）
for (int i = 0; i < 10; i++) {
    CompletableFuture.supplyAsync(() -> queryDB());  // 用 commonPool
}

// 如果 CPU 是 8 核，commonPool 只有 7 个线程
// 7 个线程被阻塞在数据库查询上
// 剩下 3 个请求排队等待
// 此时 parallelStream、其他 CompletableFuture 全部卡住
```

**一条规则：但凡任务里有 IO（网络、数据库、文件），就不要用 commonPool。** 用自定义线程池，线程数可以设大一些（IO 等待时线程不占 CPU）。

```java
// 自定义线程池：IO 密集型任务，线程数可以多一些
ExecutorService ioPool = Executors.newFixedThreadPool(20);

CompletableFuture.supplyAsync(() -> queryDB(), ioPool);
```

---

**转换（Transform）**

```java
// thenApply：同步转换，接收结果，返回新值
CompletableFuture<Integer> length = cf.thenApply(s -> s.length());

// thenApplyAsync：异步转换，在另一个线程中执行
CompletableFuture<Integer> length2 = cf.thenApplyAsync(s -> {
    // 这个 lambda 会在 ForkJoinPool 线程中执行
    return s.length();
});
```

**消费（Consume）**

```java
// thenAccept：消费结果，无返回值
cf.thenAccept(s -> System.out.println("Got: " + s));

// thenRun：不关心结果，只关心"完成了"
cf.thenRun(() -> System.out.println("Task done!"));
```

**组合（Compose & Combine）**

```java
// thenCompose：链式组合（类似 flatMap）
// 前一个的结果作为下一个的输入，且下一个也是 CompletableFuture
CompletableFuture<String> composed = cf.thenCompose(s ->
    CompletableFuture.supplyAsync(() -> s + " world")
);

// thenCombine：并行组合，两个都完成后合并结果
CompletableFuture<String> cf1 = CompletableFuture.supplyAsync(() -> "Hello");
CompletableFuture<String> cf2 = CompletableFuture.supplyAsync(() -> "World");
CompletableFuture<String> combined = cf1.thenCombine(cf2, (a, b) -> a + " " + b);
```

**并行协调**

```java
// allOf：等待所有完成（无返回值，需要手动收集）
CompletableFuture<Void> all = CompletableFuture.allOf(cf1, cf2, cf3);
all.join();  // 等全部完成

// anyOf：任意一个完成即可
CompletableFuture<Object> any = CompletableFuture.anyOf(cf1, cf2, cf3);
```

### 10.2.2 异步流水线

用一个完整的例子来展示 CompletableFuture 的威力。假设我们需要：查询用户 → 根据用户查订单 → 根据订单查物流 → 汇总结果。

```java
public class AsyncPipeline {

    // 模拟异步服务调用
    static CompletableFuture<User> findUser(int id) {
        return CompletableFuture.supplyAsync(() -> {
            sleep(100);
            return new User(id, "张三");
        });
    }

    static CompletableFuture<List<Order>> findOrders(User user) {
        return CompletableFuture.supplyAsync(() -> {
            sleep(150);
            return List.of(new Order("ORD-001"), new Order("ORD-002"));
        });
    }

    static CompletableFuture<String> findTracking(Order order) {
        return CompletableFuture.supplyAsync(() -> {
            sleep(80);
            return order.id() + " → 已签收";
        });
    }

    public static void main(String[] args) {
        long start = System.currentTimeMillis();

        CompletableFuture<String> pipeline = findUser(42)               // 第1步
            .thenCompose(user -> findOrders(user))                      // 第2步：等第1步完成
            .thenCompose(orders -> {                                     // 第3步：对每个订单并行查物流
                List<CompletableFuture<String>> trackingFutures =
                    orders.stream()
                          .map(order -> findTracking(order))
                          .toList();
                // allOf 等所有物流查询完成，然后收集结果
                return CompletableFuture.allOf(trackingFutures.toArray(new CompletableFuture[0]))
                    .thenApply(v -> trackingFutures.stream()
                        .map(CompletableFuture::join)
                        .collect(Collectors.joining(", ")));
            })
            .exceptionally(ex -> {                                       // 异常兜底
                System.err.println("Pipeline failed: " + ex.getMessage());
                return "查询失败";
            });

        System.out.println("结果: " + pipeline.join());
        System.out.println("耗时: " + (System.currentTimeMillis() - start) + "ms");
        // 结果: ORD-001 → 已签收, ORD-002 → 已签收
        // 耗时: ~330ms（串行需要 100+150+80*2=410ms，并行的物流查询节省了时间）
    }
}
```

整个流程可以用一张图来表示：

```
时间 →
┌──────────┐    ┌──────────┐    ┌─────────────────────────┐
│ findUser │───→│findOrders│───→│    findTracking (并行)   │
│  100ms   │    │  150ms   │    │  ┌─────────┐ ┌─────────┐│
└──────────┘    └──────────┘    │  │ ORD-001 │ │ ORD-002 ││
                                │  │  80ms   │ │  80ms   ││
                                │  └─────────┘ └─────────┘│
                                │        allOf 等待         │
                                └─────────────────────────┘
                                              ↓
                                        汇总结果返回
```

### 10.2.3 异常处理

异步链中的异常不会丢失，但需要正确处理：

```java
// 方式一：exceptionally——异常时返回默认值
CompletableFuture<String> safe = future
    .thenApply(s -> riskyOperation(s))
    .exceptionally(ex -> {
        log.warn("Failed, using default", ex);
        return "default value";
    });

// 方式二：handle——统一处理正常和异常结果（更灵活）
CompletableFuture<String> handled = future
    .thenApply(s -> riskyOperation(s))
    .handle((result, ex) -> {
        if (ex != null) {
            log.error("Error: ", ex);
            return "fallback";
        }
        return result.toUpperCase();
    });

// 方式三：whenComplete——类似 handle，但不改变结果（只做副作用）
future.whenComplete((result, ex) -> {
    if (ex != null) log.error("Failed", ex);
    else log.info("Got: {}", result);
});
```

**选择指南**：

| 方法 | 是否改变结果 | 典型用途 |
|------|-------------|---------|
| `exceptionally` | 是（异常时替换） | 默认值、降级 |
| `handle` | 是（正常/异常都可替换） | 统一转换 |
| `whenComplete` | 否（只做副作用） | 日志、监控、清理 |

### 10.2.4 超时控制

JDK 9 引入了超时支持，避免异步操作无限等待：

```java
CompletableFuture<String> future = CompletableFuture
    .supplyAsync(() -> slowOperation())
    .orTimeout(3, TimeUnit.SECONDS)           // 超时抛 TimeoutException
    .completeOnTimeout("default", 3, TimeUnit.SECONDS);  // 超时返回默认值
```

## 10.3 响应式编程思想

### 10.3.1 从"等结果"到"通知我"

CompletableFuture 已经是异步的了，但它仍然是一次性的——一个 Future 对应一个结果。响应式编程（Reactive Programming）往前又走了一步：**处理的是异步数据流**，而不是单个异步值。

核心理念可以用三个词概括：

- **事件驱动**：不轮询，不阻塞，事件来了就处理
- **非阻塞**：线程永远不等待，处理完一个请求立即去处理下一个
- **背压（Backpressure）**：下游处理不过来时，通知上游"慢点发"

### 10.3.2 传统模型 vs 事件驱动模型

```
传统模型：一个请求一个线程
┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐
│ Thread1│  │ Thread2│  │ Thread3│  │ Thread4│
│ req A  │  │ req B  │  │ req C  │  │ req D  │
│ ...等待  │  │ ...等待  │  │ ...等待  │  │ ...等待  │
│ IO返回  │  │ IO返回  │  │ IO返回  │  │ IO返回  │
│ 处理完成 │  │ 处理完成 │  │ 处理完成 │  │ 处理完成 │
└────────┘  └────────┘  └────────┘  └────────┘
瓶颈：线程数 = 并发上限，大量线程在等待IO时浪费

事件驱动模型：少量线程处理大量连接
┌──────────────────────────────────┐
│          Event Loop (1个线程)      │
│                                  │
│  A到达 → 注册回调 → B到达 → 处理B  │
│  → C到达 → A的IO完成 → 处理A → ... │
└──────────────────────────────────┘
优势：线程永远在忙，不浪费在IO等待上
```

| 维度 | 线程/请求模型 | 事件驱动模型 |
|------|-------------|-------------|
| 线程数 | 与请求数成正比 | 固定（通常 CPU 核心数） |
| IO 等待 | 线程阻塞等待 | 注册回调，线程去处理别的 |
| 内存开销 | 每线程 ~1MB 栈空间 | 每连接只有少量状态 |
| 编程复杂度 | 直观（同步思维） | 较高（回调/流思维） |
| 适用场景 | 低并发、CPU 密集 | 高并发、IO 密集 |

### 10.3.3 Java 生态中的响应式框架

**Reactor**（Spring WebFlux 的底层）

```java
Flux<String> stream = Flux.fromIterable(List.of("A", "B", "C"))
    .map(s -> s.toLowerCase())
    .filter(s -> !s.equals("b"))
    .flatMap(s -> reactiveRepository.save(s))  // 非阻塞IO
    .doOnError(e -> log.error("Error", e));

// 订阅（pull 模型）
stream.subscribe(
    value -> System.out.println("Received: " + value),
    error -> System.err.println("Error: " + error),
    () -> System.out.println("Complete")
);
```

**核心抽象**：
- `Mono<T>`：0 或 1 个元素的异步流（类似 `CompletableFuture`）
- `Flux<T>`：0 到 N 个元素的异步流（类似 `Stream`，但是异步的）

**Project Loom（虚拟线程，JDK 21 正式发布）**

虚拟线程是另一种思路——不改变编程模型（你还是写同步代码），但底层用虚拟线程代替操作系统线程，创建百万个也不费力：

```java
// 虚拟线程：轻量级，由 JVM 调度
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    for (int i = 0; i < 100_000; i++) {
        executor.submit(() -> {
            // 同步写法，底层是非阻塞的
            String result = blockingIOCall();
            process(result);
        });
    }
}
```

虚拟线程的意义在于：**你不必为了高并发而重写为响应式风格，用阻塞代码也能获得高吞吐**。但这不意味着响应式没有价值——当需要复杂的数据流编排（多数据源合并、窗口聚合、背压控制）时，响应式 API 仍然更合适。

## 10.4 Actor 模型与消息传递

### 10.4.1 另一种并发哲学

到目前为止，我们讨论的所有模型都基于**共享状态**：多个线程访问同一块内存，用锁来协调。Actor 模型提出了完全不同的思路：**不共享状态，只传递消息**。

```
线程+共享内存模型：           Actor 模型：

 Thread1 ──┐                 ┌─────────┐   消息   ┌─────────┐
           ├──→ 共享数据 ←──┤  Actor A │ ──────→ │ Actor B │
 Thread2 ──┘   (需要锁)      └─────────┘         └─────────┘
                              有自己的状态          有自己的状态
                              不暴露给外界          不暴露给外界
```

每个 Actor 的核心特征：

1. **封装状态**：Actor 内部的状态只有自己能访问，外界无法直接读写
2. **消息通信**：Actor 之间唯一的交互方式是发送消息
3. **无锁天然安全**：因为没有共享状态，所以不需要锁
4. **异步处理**：消息发送后立即返回，Actor 按自己的节奏处理消息

### 10.4.2 Akka 示例

Akka 是 Java/JVM 生态中最著名的 Actor 框架（Akka 2.x 后主要用 Scala，但提供了完整的 Java API）：

```java
// 定义 Actor
public class CounterActor extends AbstractActor {
    private int count = 0;  // 完全私有的状态，线程安全

    @Override
    public Receive createReceive() {
        return receiveBuilder()
            .match(Increment.class, msg -> count++)
            .match(GetCount.class, msg -> getSender().tell(count, getSelf()))
            .build();
    }
}

// 消息定义（不可变）
public record Increment() {}
public record GetCount() {}

// 使用
ActorSystem system = ActorSystem.create("my-system");
ActorRef counter = system.actorOf(Props.create(CounterActor.class), "counter");

// 发送消息（异步，不阻塞）
counter.tell(new Increment(), ActorRef.noSender());
counter.tell(new Increment(), ActorRef.noSender());

// 询问模式（带 Future 返回）
CompletableFuture<Object> result = AskPattern.ask(
    counter, GetCount::new, Duration.ofSeconds(3)
);
result.thenAccept(count -> System.out.println("Count: " + count));
```

### 10.4.3 Actor vs 线程+锁

| 维度 | 线程+共享内存 | Actor+消息传递 |
|------|-------------|---------------|
| 状态共享 | 共享，需要锁保护 | 不共享，天然隔离 |
| 并发控制 | 显式（锁、CAS） | 隐式（消息串行处理） |
| 死锁风险 | 存在 | 基本不存在 |
| 编程模型 | 命令式，同步思维 | 消息驱动，异步思维 |
| 调试难度 | 高（竞态条件难复现） | 中（消息顺序可追踪） |
| 性能特征 | 低延迟（直接内存访问） | 有消息序列化/路由开销 |
| 适用场景 | JVM 内并发 | 分布式系统、高容错 |

## 10.5 如何选择并发模型

没有万能的并发模型，选择取决于你的场景：

| 模型 | 优势 | 劣势 | 适用场景 | Java 代表 |
|------|------|------|---------|----------|
| 线程+锁 | 直观、低延迟 | 难以扩展、易出错 | 简单并发、CPU 密集 | `synchronized`、`ReentrantLock` |
| CompletableFuture | 链式组合、非阻塞 | 只处理单值、调试链难 | 异步IO编排、微服务调用 | `CompletableFuture` |
| 响应式流 | 背压、数据流编排 | 学习曲线陡、调试复杂 | 高并发IO、流式处理 | Reactor、RxJava |
| 虚拟线程 | 阻塞式代码+高并发 | 不适合计算密集 | 大量阻塞IO | Project Loom |
| Actor | 天然分布式、容错 | 有框架依赖 | 分布式系统、事件驱动 | Akka |

**选择决策树**：

```
你的场景是什么？
│
├─ 简单并发，线程数有限 → 线程+锁 / ExecutorService
│
├─ 需要异步编排多个IO操作？
│   ├─ 用 JDK 8+ → CompletableFuture
│   └─ 用 Spring → WebFlux (Reactor)
│
├─ 大量并发连接（>1万）？
│   ├─ 不想改代码风格 → 虚拟线程 (JDK 21+)
│   └─ 需要背压/流处理 → 响应式 (Reactor/RxJava)
│
└─ 分布式系统，需要容错和位置透明 → Actor (Akka)
```

---

> **纵横联系**
>
> 本章介绍的 `CompletableFuture` 底层依赖的是第 6 章讲的 `ForkJoinPool`；响应式框架中的非阻塞 IO 基于 Java NIO，这在第一卷《Java 核心》中有详细介绍；虚拟线程的调度策略和操作系统线程的关系，对应第 8 章线程调度的内容。Actor 模型的思想也影响了分布式系统设计，这将在第四卷《分布式与微服务》中进一步展开。下一章，我们将回到实践层面，讨论并发问题的诊断与性能优化——当本章这些模型出了问题，怎么找、怎么修。
