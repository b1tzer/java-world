# 第5章 Netty：Java 高性能网络框架

> Java NIO 提供了非阻塞 I/O 的底层能力，但直接使用 NIO 编写生产级网络程序，开发者要面对复杂的 Selector 事件循环、手动管理 Buffer 位置与容量、以及 JDK 历史上著名的 epoll Bug。Netty 的出现，就是要把这些底层复杂性封装成一套清晰、可扩展、高性能的编程模型——让开发者专注于业务逻辑，而非 I/O 细节。

## 5.1 为什么需要 Netty

### 5.1.1 NIO 的三大痛点

Java NIO（`java.nio` 包）在 JDK 1.4 引入，提供了 Channel、Selector、Buffer 等核心抽象，实现了非阻塞 I/O。然而，直接使用 NIO 编写网络应用面临三个显著痛点：

| 痛点 | 具体表现 | 后果 |
|------|----------|------|
| **API 复杂** | Selector 注册/轮询、Buffer 的 position/limit/capacity 手动管理、ByteBuffer 类型单一 | 开发效率低，极易出 Bug |
| **epoll Bug** | JDK 在 Linux 上的 Selector 空轮询（epoll bug），导致 CPU 100% | 线上事故频发，JDK 长期未彻底修复 |
| **扩展困难** | 缺少成熟的编解码、线程模型、连接管理框架 | 每个项目重复造轮子 |

### 5.1.2 Netty 的定位

Netty 是一个 **异步事件驱动的网络应用框架**，它在 NIO 之上构建了一层更高阶的抽象：

```text
┌─────────────────────────────────────┐
│         业务应用 (你的代码)           │
├─────────────────────────────────────┤
│         Netty 框架层                 │
│  ┌──────────┬──────────┬─────────┐  │
│  │ Pipeline │ ByteBuf  │ Codec   │  │
│  │ EventLoop│ Bootstrap│ Future  │  │
│  └──────────┴──────────┴─────────┘  │
├─────────────────────────────────────┤
│         Java NIO (Channel/Selector) │
├─────────────────────────────────────┤
│         操作系统 (epoll/kqueue)      │
└─────────────────────────────────────┘
```

Netty 解决了上述三个痛点：

1. **封装 API**：用 Channel、Pipeline、Handler 的责任链模型取代裸 NIO 的 Selector 循环
2. **规避 epoll Bug**：通过 `Selector.select(timeout)` + 空轮询计数器机制，在检测到空轮询时重建 Selector
3. **提供扩展点**：内置编解码器、线程模型、内存管理、连接池等生产级组件

### 5.1.3 谁在用 Netty

Netty 是 Java 生态中事实标准的网络框架：

- **Dubbo / gRPC**：RPC 通信底层
- **Elasticsearch**：节点间通信
- **RocketMQ / Kafka**：消息传递
- **Spring WebFlux**：默认使用 Reactor Netty
- **Cassandra / HBase**：客户端连接

## 5.2 Netty 核心架构

### 5.2.1 整体组件关系

Netty 的架构由五个核心组件构成，它们之间的关系可以用以下调用链概括：

```text
Bootstrap
  └─ EventLoopGroup (bossGroup, workerGroup)
       └─ EventLoop (每个线程一个)
            └─ Channel (每个连接一个)
                 └─ Pipeline
                      └─ Handler (业务处理器链)
```

### 5.2.2 Bootstrap 启动器

Bootstrap 是 Netty 应用的入口，分为两种：

| 类型 | 用途 | 线程组 |
|------|------|--------|
| `ServerBootstrap` | 服务端，监听端口 | 需要 bossGroup + workerGroup |
| `Bootstrap` | 客户端，发起连接 | 只需一个 group |

一个典型的服务端启动代码：

```java
EventLoopGroup bossGroup = new NioEventLoopGroup(1);
EventLoopGroup workerGroup = new NioEventLoopGroup();

try {
    ServerBootstrap bootstrap = new ServerBootstrap();
    bootstrap.group(bossGroup, workerGroup)
             .channel(NioServerSocketChannel.class)
             .option(ChannelOption.SO_BACKLOG, 128)
             .childOption(ChannelOption.SO_KEEPALIVE, true)
             .childHandler(new ChannelInitializer<SocketChannel>() {
                 @Override
                 protected void initChannel(SocketChannel ch) {
                     ch.pipeline().addLast(new MyBusinessHandler());
                 }
             });

    ChannelFuture future = bootstrap.bind(8080).sync();
    future.channel().closeFuture().sync();
} finally {
    bossGroup.shutdownGracefully();
    workerGroup.shutdownGracefully();
}
```

### 5.2.3 Channel 通道

Channel 是 Netty 对网络连接的抽象，对应操作系统的一个文件描述符（fd）。与 `java.nio.channels.Channel` 不同，Netty 的 Channel 提供了更丰富的操作：

```java
// Channel 核心方法
channel.id()              // 唯一标识
channel.isActive()        // 是否激活
channel.remoteAddress()   // 远端地址
channel.writeAndFlush(msg)// 写出数据并刷新
channel.close()           // 关闭连接
channel.pipeline()        // 获取 Pipeline
channel.alloc()           // 获取 ByteBuf 分配器
```

常见的 Channel 类型：

| Channel 类型 | 说明 |
|-------------|------|
| `NioServerSocketChannel` | 服务端 TCP 监听通道 |
| `NioSocketChannel` | 客户端 TCP 数据通道 |
| `OioServerSocketChannel` | 阻塞式服务端（已废弃） |
| `EpollServerSocketChannel` | Linux epoll 原生实现 |

## 5.3 EventLoop 线程模型

### 5.3.1 EventLoop 是什么

EventLoop 是 Netty 的核心线程模型，**一个 EventLoop 绑定一个线程**，负责处理其上所有 Channel 的 I/O 事件。这是 Netty 保证线程安全的关键设计：

```text
EventLoop-1 (Thread-1)
  ├── Channel-A (read, write)
  ├── Channel-B (read, write)
  └── Channel-C (read, write)

EventLoop-2 (Thread-2)
  ├── Channel-D (read, write)
  └── Channel-E (read, write)

EventLoop-3 (Thread-3)
  └── Channel-F (read, write)
```

**核心原则：一个 Channel 的所有 I/O 事件永远由同一个 EventLoop（线程）处理。**

这意味着：
- Handler 中不需要同步锁（单线程执行）
- 不要阻塞 EventLoop 线程（否则该线程上所有 Channel 都会卡住）

### 5.3.2 EventLoop 生命周期

```text
┌───────────┐
│  启动      │
└─────┬─────┘
      ▼
┌─────────────────────────────────────┐
│  for (;;) {                         │
│    1. select() — 等待就绪事件        │
│    2. processSelectedKeys() — 处理IO │
│    3. runAllTasks() — 执行队列任务   │
│  }                                  │
└─────┬───────────────────────────────┘
      ▼
┌───────────┐
│  关闭      │
└───────────┘
```

每个 EventLoop 内部维护三个任务队列：

| 队列 | 用途 | 方法 |
|------|------|------|
| 普通任务队列 | 用户提交的异步任务 | `execute(Runnable)` |
| 定时任务队列 | 延迟/周期任务 | `schedule(Runnable, delay, unit)` |
| 尾部任务队列 | Channel 生命周期回调 | 内部使用 |

### 5.3.3 EventLoopGroup 分配策略

当一个新的 Channel 注册时，EventLoopGroup 通过 **轮询（Round-Robin）** 策略选择一个 EventLoop 将其绑定：

```java
// NioEventLoopGroup 默认线程数 = CPU 核心数 × 2
EventLoopGroup group = new NioEventLoopGroup();
// 可以指定线程数
EventLoopGroup group = new NioEventLoopGroup(4);
```

**最佳实践：**
- bossGroup 设为 1（只负责 accept）
- workerGroup 使用默认值（CPU × 2），或根据业务调优
- 耗时业务逻辑交给独立的业务线程池，不要阻塞 EventLoop

## 5.4 ChannelPipeline 责任链

### 5.4.1 Pipeline 结构

每个 Channel 拥有一个 Pipeline，Pipeline 内部是一条 **双向链表**，由 Handler 节点组成：

```text
  Head → [Handler A] → [Handler B] → [Handler C] → Tail
  │        Inbound      Inbound       Outbound        │
  │        ──────────→  ──────────→   ←──────────     │
  │                                                   │
  └── Inbound 事件从 Head 流向 Tail ───────────────────┘
  └── Outbound 事件从 Tail 流向 Head ──────────────────┘
```

### 5.4.2 Inbound vs Outbound Handler

| 特性 | Inbound Handler | Outbound Handler |
|------|----------------|-----------------|
| 处理方向 | Head → Tail | Tail → Head |
| 触发时机 | 数据到达、连接建立/断开 | 数据写出、连接绑定 |
| 典型用途 | 解码、业务处理 | 编码、流量控制 |
| 接口 | `ChannelInboundHandler` | `ChannelOutboundHandler` |
| 适配器 | `SimpleChannelInboundHandler<T>` | `ChannelOutboundHandlerAdapter` |

### 5.4.3 Handler 执行顺序

以一个典型的编解码链为例：

```text
Pipeline:
  [HttpDecoder]         → Inbound: 将字节解码为 HttpRequest
  [HttpAggregator]      → Inbound: 聚合完整请求体
  [BusinessHandler]     → Inbound: 处理业务逻辑
  [HttpEncoder]         → Outbound: 将 HttpResponse 编码为字节
```

数据流入（读取）过程：

```text
Socket 读取字节
  → HttpDecoder.channelRead()   // 字节 → HttpRequest
  → HttpAggregator.channelRead() // 分片 → 完整请求
  → BusinessHandler.channelRead() // 业务处理
```

数据流出（写入）过程：

```text
BusinessHandler.write(response)
  → HttpEncoder.write()          // HttpResponse → 字节
  → Socket 写出字节
```

### 5.4.4 添加与删除 Handler

```java
pipeline.addLast("decoder", new HttpServerCodec());
pipeline.addLast("aggregator", new HttpObjectAggregator(65536));
pipeline.addLast("handler", new MyBusinessHandler());

// 按名字移除
pipeline.remove("aggregator");

// 替换
pipeline.replace("decoder", "new-decoder", new BetterDecoder());
```

**注意：** `ChannelInitializer` 中添加的 Handler 在连接建立后只会执行一次，之后其自身会被从 Pipeline 中移除。

## 5.5 ByteBuf 内存模型

### 5.5.1 ByteBuffer 的局限

JDK 原生的 `ByteBuffer` 存在以下问题：

| 问题 | 说明 |
|------|------|
| 固定容量 | 创建后不可扩容，需要手动 `flip()` 切换读写模式 |
| 单一 API | 只有一个 position 指针，操作不便 |
| 无引用计数 | 无法精确控制内存释放 |
| 类型单一 | 只有 heap 和 direct 两种，缺少池化能力 |

### 5.5.2 ByteBuf 的优势

Netty 的 `ByteBuf` 采用 **读写分离的双指针设计**，彻底消除了 `flip()` 的困扰：

```text
+-------------------+------------------+------------------+
| discardable bytes |  readable bytes  |  writable bytes  |
|    (已读/可丢弃)   |   (可读数据)      |   (可写空间)      |
+-------------------+------------------+------------------+
|                   |                  |                  |
0              readerIndex        writerIndex        capacity
```

核心操作：

```java
ByteBuf buf = Unpooled.buffer(256);

// 写入
buf.writeInt(42);
buf.writeBytes("hello".getBytes());

// 读取（readerIndex 自动前移）
int num = buf.readInt();           // 42
byte[] bytes = new byte[5];
buf.readBytes(bytes);              // "hello"

// 随机访问（不影响 readerIndex）
byte first = buf.getByte(0);

// 标记与重置
buf.markReaderIndex();
buf.readByte();
buf.resetReaderIndex();            // 回到标记位置
```

### 5.5.3 ByteBuf 分类

| 类型 | 分配方式 | 是否池化 | 特点 |
|------|----------|----------|------|
| Heap ByteBuf | `heapBuffer()` | 可选 | JVM 堆上，受 GC 管理 |
| Direct ByteBuf | `directBuffer()` | 可选 | 堆外内存，零拷贝友好 |
| Pooled Heap | `PooledByteBufAllocator` | 池化 | 减少 GC 压力 |
| Pooled Direct | `PooledByteBufAllocator` | 池化 | 性能最佳，Netty 默认 |

**最佳实践：**
- I/O 操作（网络读写）使用 Direct ByteBuf，减少一次堆内→堆外的拷贝
- 业务处理使用 Heap ByteBuf，便于操作
- 使用池化分配器（Netty 4.x 默认已开启）

### 5.5.4 引用计数与释放

ByteBuf 使用 **引用计数** 管理生命周期，防止内存泄漏：

```java
ByteBuf buf = allocator.buffer();
// 引用计数初始为 1
System.out.println(buf.refCnt());  // 1

buf.retain();  // 引用计数 +1 → 2
buf.release(); // 引用计数 -1 → 1
buf.release(); // 引用计数 -1 → 0，内存释放
```

**关键规则：**
- `channelRead()` 中分配的 ByteBuf，由下一个 Handler 负责释放
- `SimpleChannelInboundHandler` 会自动释放消息（调用 `ReferenceCountUtil.release(msg)`）
- 手动 `write()` 的 ByteBuf 由 Netty 负责释放

**内存泄漏检测：** 启动时加 JVM 参数 `-Dio.netty.leakDetection.level=PARANOID`，Netty 会在 ByteBuf 未释放时打印泄漏堆栈。

## 5.6 编解码机制

### 5.6.1 为什么需要编解码

TCP 是 **字节流协议**，没有消息边界。发送端写入的两条消息 `Hello` 和 `World`，接收端可能一次读到 `HelloWorld`，也可能分两次读到 `Hel` 和 `loWorld`。这就是 **TCP 粘包/拆包** 问题。

```text
发送端:                          接收端可能收到:
  write("Hello")                 情况1: "HelloWorld"     (粘包)
  write("World")                 情况2: "Hel" + "loWorld" (拆包)
                                 情况3: "Hello" + "World"  (正常)
```

Netty 提供了多种 Frame Decoder（帧解码器）来解决这个问题。

### 5.6.2 FixedLengthFrameDecoder

**定长帧解码器**：每条消息固定长度，不足时补空格。

```java
// 每条消息固定 10 字节
pipeline.addLast(new FixedLengthFrameDecoder(10));
```

```text
原始字节流: [Hello_____][World_____][12345_____]
解码结果:   "Hello"     "World"     "12345"
```

**适用场景：** 简单协议，消息长度固定。

### 5.6.3 DelimiterBasedFrameDecoder

**分隔符帧解码器**：用特殊字符（如 `\n`、`\r\n`）作为消息边界。

```java
// 以 \r\n 作为分隔符，最大帧长度 8192
pipeline.addLast(new DelimiterBasedFrameDecoder(8192,
    Delimiters.lineDelimiter()));
```

```text
原始字节流: "Hello\r\nWorld\r\n"
解码结果:   "Hello"  "World"
```

**适用场景：** 文本协议（如 Redis、Memcached 的部分命令）。

### 5.6.4 LengthFieldBasedFrameDecoder

**长度字段帧解码器**：最灵活的方案，在消息头部用 N 个字节表示消息体长度。

```java
// maxFrameLength=1024, lengthFieldOffset=0, lengthFieldLength=4,
// lengthAdjustment=0, initialBytesToStrip=4
pipeline.addLast(new LengthFieldBasedFrameDecoder(1024, 0, 4, 0, 4));
```

```text
原始数据:
+--------+------------------+
| Length  |     Payload      |
| 4 bytes |   N bytes        |
+--------+------------------+
| 0x0005 | H e l l o        |
| 0x0005 | W o r l d        |
+--------+------------------+

解码结果: "Hello"  "World"
```

参数说明：

| 参数 | 含义 |
|------|------|
| `maxFrameLength` | 最大帧长度，超过则抛异常 |
| `lengthFieldOffset` | 长度字段起始偏移 |
| `lengthFieldLength` | 长度字段占用字节数 |
| `lengthAdjustment` | 长度修正值（长度字段值 + adjustment = 实际载荷长度） |
| `initialBytesToStrip` | 跳过前 N 字节（如不想要长度头） |

**适用场景：** 大多数二进制协议（如 Dubbo、RocketMQ）。

### 5.6.5 编解码器组合模式

Netty 提供了 `Codec` 类将 Encoder 和 Decoder 合二为一：

```java
// 将 HttpRequestDecoder + HttpResponseEncoder 合并
pipeline.addLast(new HttpServerCodec());

// 自定义编解码器
public class MyMessageCodec extends MessageToMessageCodec<ByteBuf, MyMessage> {
    @Override
    protected void encode(ChannelHandlerContext ctx, MyMessage msg, List<Object> out) {
        // MyMessage → ByteBuf
    }

    @Override
    protected void decode(ChannelHandlerContext ctx, ByteBuf msg, List<Object> out) {
        // ByteBuf → MyMessage
    }
}
```

## 5.7 主从 Reactor 模型

### 5.7.1 Reactor 模式回顾

Reactor 模式是高性能网络服务器的经典架构，核心思想是 **一个或少量线程通过事件循环监听大量连接**。

三种典型的 Reactor 变体：

```text
单 Reactor 单线程:
  ┌──────────────────┐
  │  Reactor Thread   │
  │  ┌──────────────┐ │
  │  │ accept()     │ │
  │  │ read/write() │ │
  │  │ decode/encode│ │
  │  │ business()   │ │
  │  └──────────────┘ │
  └──────────────────┘
  问题: 任何阻塞都会影响所有连接

单 Reactor 多线程:
  ┌──────────────────┐
  │  Reactor Thread   │ ──→ Worker Pool (N threads)
  │  accept()         │
  │  read/write()     │
  └──────────────────┘
  问题: Reactor 单线程仍是瓶颈

主从 Reactor (Netty 采用):
  ┌──────────────┐
  │  Boss Group   │ ──→ accept 新连接
  │  (1 thread)   │     分配给 Worker
  └──────┬───────┘
         ▼
  ┌──────────────┐
  │ Worker Group  │ ──→ read/write I/O
  │ (N threads)   │     执行 Handler
  └──────────────┘
```

### 5.7.2 Netty 的主从 Reactor 实现

Netty 默认采用 **主从 Reactor** 模型：

```text
                        ┌─────────────────────────────────────┐
                        │         ServerBootstrap              │
                        └──────────────┬──────────────────────┘
                                       │
                   ┌───────────────────┼───────────────────┐
                   ▼                                       ▼
            bossGroup                                  workerGroup
         (NioEventLoopGroup)                      (NioEventLoopGroup)
         ┌────────────────┐                     ┌────────────────────┐
         │  NioEventLoop   │                     │  NioEventLoop-1    │
         │  (1 thread)     │  ── accept ──→      │  Channel A, B, C   │
         │  Selector       │  分配 Channel       │  read/write/decode │
         └────────────────┘                     ├────────────────────┤
                                                │  NioEventLoop-2    │
                                                │  Channel D, E      │
                                                │  read/write/decode │
                                                └────────────────────┘
                                                ├────────────────────┤
                                                │  NioEventLoop-N    │
                                                │  Channel F, G      │
                                                └────────────────────┘
```

### 5.7.3 一次请求的完整流程

以客户端发送一个 HTTP 请求为例，完整的数据流经过程：

```text
1. 客户端发起 TCP 连接
   ↓
2. OS 内核完成三次握手，连接进入 accept 队列
   ↓
3. Boss NioEventLoop 的 Selector 检测到 ACCEPT 事件
   ↓
4. Boss 调用 accept()，获得 SocketChannel
   ↓
5. Boss 通过 Round-Robin 选择一个 Worker NioEventLoop
   ↓
6. 将 SocketChannel 注册到 Worker 的 Selector（关注 READ 事件）
   ↓
7. 客户端发送数据，OS 将数据拷贝到 Socket 缓冲区
   ↓
8. Worker NioEventLoop 的 Selector 检测到 READ 事件
   ↓
9. Worker 从 Channel 读取数据到 ByteBuf
   ↓
10. 数据流经 Pipeline 中的 Handler 链：
    HttpDecoder → HttpAggregator → BusinessHandler
    ↓
11. BusinessHandler 处理业务逻辑，构造 Response
    ↓
12. Response 流经 Outbound Handler 链：
    HttpEncoder → 写出到 Channel
    ↓
13. OS 将数据从 Socket 缓冲区发送到网络
```

### 5.7.4 TaskQueue 的作用

当 Handler 中有耗时操作（如数据库查询、RPC 调用）时，不能阻塞 EventLoop 线程。Netty 提供了两种方式将任务提交到独立线程池：

```java
// 方式1：使用 ctx.channel().eventLoop().execute()
ctx.channel().eventLoop().execute(() -> {
    // 耗时操作
    String result = database.query(sql);
    ctx.writeAndFlush(result);
});

// 方式2：使用独立的业务线程池
EventLoopGroup businessGroup = new DefaultEventLoopGroup(8);
bootstrap.childHandler(new ChannelInitializer<SocketChannel>() {
    @Override
    protected void initChannel(SocketChannel ch) {
        ch.pipeline()
         .addLast(workerGroup, "codec", new HttpCodecHandler())     // I/O 线程
         .addLast(businessGroup, "biz", new BusinessHandler());     // 业务线程
    }
});
```

Handler 绑定线程池的规则：
- 如果指定了线程池，该 Handler 的方法由指定线程池中的线程执行
- 如果未指定，由 Channel 所在的 EventLoop 线程执行

### 5.7.5 线程模型调优建议

| 场景 | 建议配置 |
|------|----------|
| 简单代理/网关 | boss=1, worker=CPU×2, 无业务线程池 |
| 计算密集型业务 | boss=1, worker=CPU×2, 业务线程池=CPU×2 |
| I/O 密集型业务（DB/RPC） | boss=1, worker=CPU×2, 业务线程池=较大值(如100) |
| 海量连接、低吞吐 | boss=1, worker=CPU, 减少内存占用 |

---

> **本章小结：** Netty 通过 EventLoop 线程模型、Pipeline 责任链、ByteBuf 内存管理三大核心机制，将 Java NIO 的复杂性封装为一套优雅的编程模型。主从 Reactor 架构实现了连接管理与数据处理的分离，为高并发网络应用提供了坚实的基础设施。
>
> **纵横联系：**
> - 📖 **第二卷《Java 并发编程》**：EventLoop 模型本质上是单线程事件循环 + 多线程协作的并发设计，理解线程池（`DefaultEventLoopGroup`）和锁的取舍需要并发知识基础
> - 📖 **第三卷《Java I/O 与文件》**：Netty 的 ByteBuf 建立在 NIO 的 ByteBuffer 之上，Channel 抽象源于 `java.nio.channels`，理解底层 NIO 有助于排查 Netty 问题
> - 📖 **第六章 HTTP 协议**：Netty 内置了 `HttpServerCodec` 和 `HttpObjectAggregator`，是实现 HTTP 服务的常用框架
> - 📖 **后续微服务卷**：Dubbo、gRPC 等 RPC 框架的底层通信均基于 Netty
