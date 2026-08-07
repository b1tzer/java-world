# 第4章 Java NIO：高性能网络模型

> **核心问题：** 如果一个线程大部分时间都在"等"，能不能换一种方式——让线程只在"有事做"的时候才工作？Java NIO（New I/O / Non-blocking I/O）给出了答案：用 Channel 替代 Stream，用 Buffer 管理数据，用 Selector 实现多路复用。一个线程就能管理成千上万的连接。

---

## 4.1 为什么需要 NIO

### 4.1.1 BIO 模型回顾

上一章 §3.5 我们用 Java Socket 写了一个 Echo Server。它的模型很简单：**每 accept 一个连接，就分配一个线程去处理它**——这就是 BIO（Blocking I/O）。

```text
┌─────────────────────────────────────────┐
│              Main Thread                 │
│   serverSocket.accept()  ◄── 阻塞等待   │
└──────────────┬──────────────────────────┘
               │ 新连接到达
       ┌───────▼───────┐
       │  Thread Pool   │
       ├───────┬───────┤
       │ T1    │ T2    │  T3 ...
       │       │       │
       │ read()│ read()│ read()
       │ 阻塞  │ 阻塞  │ 阻塞
       │ write()│write()│write()
       │ 阻塞  │ 阻塞  │ 阻塞
       └───────┴───────┘
```

每个线程的生命周期：

```text
BIO 时间线（单个连接）:
├── read 阻塞等待 200ms ──────────────────┤── 处理 5ms ──┤── read 阻塞等待 500ms ──┤
│◄────────── 线程被白白占用 ──────────────►│              │◄──── 又白等 ────────────►│
```

线程 90% 的时间都阻塞在 `read()` 上——不消耗 CPU，但**内存和调度资源一直被占着**。

### 4.1.2 BIO 的三大瓶颈

BIO 的问题不在于"慢"，而在于"等"——用最昂贵的资源（线程）去做最廉价的事情（等待）。具体表现为三个层面：

**一、内存开销**

每个 Java 线程需要独立的栈空间，默认约 512KB ~ 1MB。

| 连接数 | 线程数 | 栈内存（按 1MB/线程） | 结果 |
| :-- | :-- | :-- | :-- |
| 1,000 | 1,000 | ~1 GB | 勉强可用 |
| 10,000 | 10,000 | ~10 GB | 一台普通服务器扛不住 |
| 100,000 | 100,000 | ~100 GB | 物理上不可能 |

**二、调度开销**

线程数远超 CPU 核心数时，操作系统大量时间花在**上下文切换**（保存/恢复寄存器、刷新 TLB）而非执行业务逻辑上。CPU 缓存也会因频繁切换而失效。

**三、资源浪费**

很多连接是"空闲"的——比如长连接客户端每隔 30 秒发一次心跳，但线程依然被占用在阻塞 `read()` 上，白白消耗内存。

```text
线程状态分布（典型 Web 服务器）:
┌──────────────────────────────────────────────┐
│ ████████ 10%  计算（业务逻辑）                 │
│ ████████████████████████████████████ 70% 阻塞等待 I/O │
│ ██████ 10%  等待调度                          │
│ ██████ 10%  其他（GC 等）                      │
└──────────────────────────────────────────────┘
```

### 4.1.3 压测验证：BIO 的极限在哪里

用压测脚本模拟并发连接，直观感受 BIO 的天花板：

```java
// 压测：同时发起 N 个长连接
public class BioStressTest {
    public static void main(String[] args) throws Exception {
        int connectionCount = 5000;
        CountDownLatch latch = new CountDownLatch(connectionCount);

        for (int i = 0; i < connectionCount; i++) {
            final int id = i;
            new Thread(() -> {
                try {
                    Socket s = new Socket("localhost", 8080);
                    s.getOutputStream().write(("ping-" + id + "\n").getBytes());
                    s.getOutputStream().flush();
                    byte[] buf = new byte[1024];
                    s.getInputStream().read(buf);
                    latch.countDown();
                    Thread.sleep(Long.MAX_VALUE);     // 保持连接
                } catch (Exception e) {
                    latch.countDown();
                }
            }).start();
        }
        latch.await();
        System.out.println("All " + connectionCount + " connections established.");
    }
}
```

| 连接数 | 结果 | 瓶颈 |
| :-- | :-- | :-- |
| 1,000 | ✅ 正常 | — |
| 5,000 | ⚠️ 变慢 | 线程数过多，GC 频繁 |
| 10,000 | ❌ OOM | `OutOfMemoryError: unable to create new native thread` |

### 4.1.4 BIO 的适用边界

尽管 BIO 有明显的天花板，它并没有完全过时：

| 场景 | 为什么 BIO 仍然合理 |
| :-- | :-- |
| 连接数少（< 100） | 线程开销可忽略 |
| 请求-响应模式，连接生命周期短 | 每个连接占用时间极短 |
| 原型开发、Demo | 代码简单，50 行搞定 |
| 遗留系统集成 | 旧框架基于 BIO（如 Servlet 2.x） |

> Tomcat 7 以前默认使用 BIO Connector，每个请求占用一个线程。Tomcat 8.5 起彻底移除了 BIO，全面转向 NIO——这是 Java 生态从 BIO 过渡到 NIO 的标志性事件。

### 4.1.5 NIO 的核心思想：事件驱动

BIO 的根因是：**线程在"等数据来"**。不管有没有数据，线程都被占着。

NIO 换了一个思路：**不问"有没有数据"，而是让操作系统在"有数据可读"时通知我。**

```text
BIO:  线程 → read() → 阻塞等数据 → 数据到了 → 处理 → read() → 阻塞等 ...
NIO:  线程 → 注册关心 READ 事件 → 做其他事 → Selector 通知"可读" → 处理 → 继续等通知
```

| 对比维度 | BIO | NIO |
| :-- | :-- | :-- |
| I/O 模型 | 阻塞（Blocking） | 非阻塞（Non-blocking） |
| 线程与连接 | 1 : 1 | 1 : N |
| 等待方式 | 线程挂起 | 事件通知（多路复用） |
| 万连接内存 | ~10 GB（万线程栈） | ~数百 MB（少量线程 + Buffer） |
| 编程复杂度 | 低 | 高 |
| 适用场景 | 连接数少、延迟不敏感 | 高并发、低延迟 |

### 4.1.6 NIO 的三大核心组件

```text
┌──────────────────────────────────────────────────┐
│                   NIO 模型                        │
│                                                  │
│   ┌───────────┐   ┌───────────┐   ┌──────────┐  │
│   │  Channel   │   │  Buffer   │   │ Selector │  │
│   │  双向通道  │◄─►│  数据容器  │   │ 事件多路 │  │
│   │           │   │           │   │  复用器   │  │
│   └───────────┘   └───────────┘   └──────────┘  │
│        ▲                              │          │
│        │         注册 + 关注事件       │          │
│        └──────────────────────────────┘          │
└──────────────────────────────────────────────────┘
```

下面逐一深入。

---

## 4.2 Channel：双向数据通道

### 4.2.1 Stream vs Channel

在 BIO 中，数据通过 **Stream（流）** 读写。Stream 是**单向**的：`InputStream` 只读，`OutputStream` 只写。

NIO 引入了 **Channel（通道）**，它是**双向**的——同一个 Channel 既可以读也可以写。

| 特性 | Stream | Channel |
|------|--------|---------|
| 方向 | 单向（in 或 out） | 双向（可读可写） |
| 阻塞 | 默认阻塞 | 默认非阻塞 |
| 数据操作 | 直接读写字节 | 必须通过 Buffer |
| 类比 | 单行车道 | 双向车道 |

### 4.2.2 常用 Channel 类型

```java
// 文件通道
FileChannel fileChannel = FileChannel.open(Paths.of("data.txt"), StandardOpenOption.READ);

// TCP 网络通道（本章重点）
SocketChannel clientChannel = SocketChannel.open(new InetSocketAddress("localhost", 8080));
ServerSocketChannel serverChannel = ServerSocketChannel.open();
serverChannel.bind(new InetSocketAddress(8080));

// UDP 网络通道
DatagramChannel udpChannel = DatagramChannel.open();
```

| Channel 类型 | 用途 | 对应 BIO 类 |
|-------------|------|------------|
| `ServerSocketChannel` | 监听 TCP 连接 | `ServerSocket` |
| `SocketChannel` | TCP 双向读写 | `Socket` |
| `DatagramChannel` | UDP 读写 | `DatagramSocket` |
| `FileChannel` | 文件读写（仅阻塞模式） | `FileInputStream/OutputStream` |

### 4.2.3 非阻塞模式

Channel 默认是阻塞的，需要手动切换为非阻塞：

```java
ServerSocketChannel ssc = ServerSocketChannel.open();
ssc.configureBlocking(false);    // 关键：设为非阻塞

SocketChannel sc = ssc.accept(); // 非阻塞，无连接时返回 null（而非阻塞等待）
```

非阻塞模式是 NIO 的基础——只有非阻塞的 Channel 才能注册到 Selector 上。

---

## 4.3 Buffer：NIO 的数据容器

### 4.3.1 为什么需要 Buffer

在 BIO 中，`read(byte[] buf)` 直接把数据读到字节数组里。NIO 的 Channel 不能直接读写字节，**所有数据必须先经过 Buffer**。

```text
BIO:   Stream  ──read──►  byte[]
NIO:   Channel ──read──►  Buffer ──get()──►  byte[]
```

### 4.3.2 Buffer 的三大属性

每个 Buffer 内部维护三个关键指针：

```text
Buffer 内存布局:
┌───┬───┬───┬───┬───┬───┬───┬───┐
│ 0 │ 1 │ 2 │ 3 │ 4 │ 5 │ 6 │ 7 │   capacity = 8
└───┴───┴───┴───┴───┴───┴───┴───┘
          ▲           ▲
       position=2   limit=5
       (下一个读/写位置) (可操作的上界)

已写入数据: [0,1]
可读数据:   [2,3,4] (position 到 limit)
不可访问:   [5,6,7] (limit 到 capacity)
```

| 属性 | 含义 | 取值范围 |
|------|------|----------|
| **capacity** | Buffer 的总容量，创建后不可变 | 固定 |
| **limit** | 第一个不可读/写的索引 | 0 ≤ limit ≤ capacity |
| **position** | 下一个要读/写的位置 | 0 ≤ position ≤ limit |

### 4.3.3 四个核心操作

Buffer 的使用围绕四个方法展开：

```java
// 1. 写入数据
buffer.put((byte) 'A');    // position: 0 → 1

// 2. flip()：从写模式切换到读模式
buffer.flip();             // limit = position; position = 0
// 现在 position=0, limit=之前写入的字节数, 可以从头开始读

// 3. 读取数据
byte b = buffer.get();     // position: 0 → 1

// 4. clear()：清空整个 Buffer，准备重新写入
buffer.clear();            // position = 0; limit = capacity

// 5. compact()：保留未读数据，准备继续写入
buffer.compact();          // 把 [position, limit) 的数据复制到开头，position = 剩余数据量
```

```text
put() 写入 3 字节后:
┌───┬───┬───┬───┬───┬───┬───┬───┐
│ A │ B │ C │   │   │   │   │   │  pos=3, limit=8
└───┴───┴───┴───┴───┴───┴───┴───┘

flip() 后（准备读）:
┌───┬───┬───┬───┬───┬───┬───┬───┐
│ A │ B │ C │   │   │   │   │   │  pos=0, limit=3
└───┴───┴───┴───┴───┴───┴───┴───┘
  ▲               ▲
  position        limit

读取 1 字节 (get()) 后:
┌───┬───┬───┬───┬───┬───┬───┬───┐
│ A │ B │ C │   │   │   │   │   │  pos=1, limit=3
└───┴───┴───┴───┴───┴───┴───┴───┘
      ▲           ▲
      position    limit

compact() 后（保留未读 B,C，准备继续写）:
┌───┬───┬───┬───┬───┬───┬───┬───┐
│ B │ C │   │   │   │   │   │   │  pos=2, limit=8
└───┴───┴───┴───┴───┴───┴───┴───┘
          ▲
          position
```

### 4.3.4 Buffer 类型

```java
ByteBuffer buf = ByteBuffer.allocate(1024);      // 堆内存，受 GC 管理
ByteBuffer directBuf = ByteBuffer.allocateDirect(1024); // 堆外内存，零拷贝友好

// 其他基本类型 Buffer
CharBuffer charBuf = CharBuffer.allocate(256);
IntBuffer intBuf = IntBuffer.allocate(64);
LongBuffer longBuf = LongBuffer.allocate(32);
```

| 分配方式 | 优点 | 缺点 |
|----------|------|------|
| `allocate()` | 分配快，受 GC 管理 | I/O 时可能需要额外拷贝 |
| `allocateDirect()` | 减少内核态/用户态拷贝 | 分配慢，不当使用会内存泄漏 |

> **实际经验：** 长期存活的 Buffer（如连接池中的读写缓冲区）用 `allocateDirect()`；短期临时 Buffer 用 `allocate()`。

---

## 4.4 零拷贝：NIO 的性能杀手锏

传统 I/O 的一个痛点是数据拷贝次数太多。以"从文件读取数据发送到网络"为例：

```text
传统 I/O（4 次拷贝 + 4 次上下文切换）：
  磁盘 → 内核缓冲区 → 用户缓冲区 → Socket 缓冲区 → 网卡
         read()         用户态        write()
         (内核→用户)    处理数据       (用户→内核)
```

4 次拷贝中有 2 次是"多余的"——数据从内核缓冲区拷贝到用户缓冲区，处理完又拷贝回内核缓冲区。用户空间只是"过了一下手"，什么也没做。

零拷贝的核心思想：**让数据留在内核空间，不拷贝到用户空间**。

### FileChannel.transferTo()

```java
// 传统方式：数据经过用户空间
FileChannel fileChannel = FileInputStream.open().getChannel();
ByteBuffer buffer = ByteBuffer.allocate(1024);
fileChannel.read(buffer);        // 内核 → 用户
socketChannel.write(buffer);     // 用户 → 内核

// 零拷贝：数据不经过用户空间
FileChannel fileChannel = FileInputStream.open().getChannel();
fileChannel.transferTo(0, fileChannel.size(), socketChannel);
// 底层调用 sendfile() 系统调用
// 磁盘 → 内核缓冲区 → 网卡（2 次拷贝，0 次用户态切换）
```

`transferTo()` 底层调用操作系统的 `sendfile()` 系统调用，数据直接从内核的文件缓冲区传到 Socket 缓冲区，不经过用户空间。

### 零拷贝的适用场景

| 场景 | 是否适合 | 原因 |
|------|---------|------|
| 文件服务器（Nginx、静态资源） | ✅ 非常适合 | 大文件传输，数据不需要修改 |
| 消息队列（Kafka） | ✅ 非常适合 | 消息从磁盘直接发到网络 |
| 数据压缩/加密 | ❌ 不适合 | 数据需要在用户空间处理 |
| 小文件传输 | ⚠️ 收益有限 | 系统调用开销可能抵消零拷贝收益 |

Kafka 的高吞吐很大程度上归功于零拷贝——消费者拉取消息时，数据从磁盘直接通过 `transferTo()` 发送到网络，不经过 JVM 堆内存。

### DirectByteBuffer 与零拷贝

`ByteBuffer.allocateDirect()` 分配的堆外内存也和零拷贝有关。普通堆内存（`allocate()`）在 I/O 操作时，JVM 需要先将数据从堆拷贝到临时的直接内存（因为操作系统不能直接访问 Java 堆）。`allocateDirect()` 跳过了这一步。

```text
allocate()：       堆内存 → 临时直接内存 → 内核缓冲区 → 网卡
allocateDirect()： 直接内存 → 内核缓冲区 → 网卡
```

所以 NIO 编程中，长期存活的 Buffer 应该用 `allocateDirect()`，短期临时的用 `allocate()`。

---

## 4.5 Selector：一个线程管理万千连接

### 4.5.1 多路复用器是什么

**Selector（选择器）** 是 NIO 实现高并发的核心。它的作用是：**让一个线程同时监听多个 Channel 的 I/O 事件。**

```text
                    ┌───────────────────┐
                    │    Selector 线程   │
                    │   (单个 Event Loop) │
                    └────────┬──────────┘
                             │ select() 阻塞等待事件
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
    ┌──────────┐     ┌──────────┐     ┌──────────┐
    │Channel 1 │     │Channel 2 │     │Channel N │
    │客户端连接 │     │客户端连接 │     │客户端连接 │
    │(可读事件) │     │(可写事件) │     │(可读事件) │
    └──────────┘     └──────────┘     └──────────┘
```

### 4.5.2 事件类型

| 事件 | 常量 | 含义 |
|------|------|------|
| 连接就绪 | `SelectionKey.OP_CONNECT` | 客户端连接建立完成 |
| 接受就绪 | `SelectionKey.OP_ACCEPT` | 有新连接到达（ServerSocketChannel） |
| 读就绪 | `SelectionKey.OP_READ` | Channel 有数据可读 |
| 写就绪 | `SelectionKey.OP_WRITE` | Channel 可以写入数据 |

### 4.5.3 Selector 的使用流程

```java
// 第一步：创建 Selector
Selector selector = Selector.open();

// 第二步：将 Channel 注册到 Selector，指定关注的事件
ServerSocketChannel ssc = ServerSocketChannel.open();
ssc.configureBlocking(false);
ssc.register(selector, SelectionKey.OP_ACCEPT);

// 第三步：循环等待事件
while (true) {
    int readyCount = selector.select();  // 阻塞，直到至少一个事件就绪
    if (readyCount == 0) continue;

    // 第四步：遍历就绪事件
    Set<SelectionKey> keys = selector.selectedKeys();
    Iterator<SelectionKey> iter = keys.iterator();

    while (iter.hasNext()) {
        SelectionKey key = iter.next();

        if (key.isAcceptable()) {
            // 新连接到达
            handleAccept(key, selector);
        } else if (key.isReadable()) {
            // 有数据可读
            handleRead(key);
        }

        iter.remove();  // 必须手动移除，否则下次还会被处理
    }
}
```

### 4.5.4 select() 的三种变体

```java
selector.select();              // 阻塞，直到有事件就绪
selector.select(1000);          // 阻塞最多 1000ms，超时返回 0
selector.selectNow();           // 非阻塞，立即返回当前就绪数
```

### 4.5.5 SelectionKey：事件与数据的桥梁

`SelectionKey` 是 Channel 和 Selector 之间的"注册凭证"，它可以附带一个**附件对象**（通常用于存储该连接的状态或缓冲区）：

```java
// 注册时附带附件
SelectionKey key = channel.register(selector, SelectionKey.OP_READ);
key.attach(new ClientState());  // 附加一个状态对象

// 取出附件
ClientState state = (ClientState) key.attachment();
```

---

## 4.6 NIO Reactor 模式

### 4.6.1 从 Selector 到 Reactor

直接使用 Selector 的代码虽然能工作，但在生产环境中需要考虑：
- 事件分发的线程安全
- 读写操作不应阻塞 Selector 线程
- 不同事件应由不同处理器处理

**Reactor 模式**是对 Selector 使用方式的标准化抽象。

### 4.6.2 单线程 Reactor

```text
┌─────────────────────────────────────────────────────────────┐
│                     Reactor Thread                           │
│                                                             │
│   ┌──────────┐     ┌───────────┐     ┌──────────────────┐  │
│   │ Selector │────►│ Dispatcher│────►│ Handler          │  │
│   │ select() │     │ 分发事件   │     │ 处理业务逻辑     │  │
│   └──────────┘     └───────────┘     │ (read/decode/    │  │
│                                      │  process/encode/  │  │
│                                      │  write)           │  │
│                                      └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

```java
public class NioEchoServer {
    public static void main(String[] args) throws IOException {
        Selector selector = Selector.open();
        ServerSocketChannel ssc = ServerSocketChannel.open();
        ssc.configureBlocking(false);
        ssc.bind(new InetSocketAddress(8080));
        ssc.register(selector, SelectionKey.OP_ACCEPT);

        System.out.println("NIO Echo Server started on port 8080");

        ByteBuffer buffer = ByteBuffer.allocate(1024);

        while (true) {
            selector.select();  // 阻塞等待事件

            Set<SelectionKey> keys = selector.selectedKeys();
            Iterator<SelectionKey> iter = keys.iterator();

            while (iter.hasNext()) {
                SelectionKey key = iter.next();
                iter.remove();

                if (key.isAcceptable()) {
                    // 处理新连接
                    ServerSocketChannel server = (ServerSocketChannel) key.channel();
                    SocketChannel client = server.accept();
                    client.configureBlocking(false);
                    client.register(selector, SelectionKey.OP_READ);
                    System.out.println("New connection: " + client.getRemoteAddress());

                } else if (key.isReadable()) {
                    // 处理可读事件
                    SocketChannel client = (SocketChannel) key.channel();
                    buffer.clear();
                    int bytesRead = client.read(buffer);

                    if (bytesRead == -1) {
                        System.out.println("Client disconnected");
                        client.close();
                    } else {
                        buffer.flip();
                        client.write(buffer);  // Echo 回写
                    }
                }
            }
        }
    }
}
```

### 4.6.3 多线程 Reactor

单线程 Reactor 的问题是：**业务逻辑处理会阻塞 Selector 线程**，导致其他连接的事件无法及时处理。

解决方案：将 Handler 的执行交给 Worker 线程池。

```text
┌─────────────────────────────────────┐
│         Main Reactor Thread         │
│                                     │
│   Selector.select()                 │
│   ├── Accept ──► 注册 READ 事件     │
│   └── Read ──► 提交给 Worker Pool   │
└──────────────────┬──────────────────┘
                   │
        ┌──────────▼──────────┐
        │   Worker Thread Pool │
        ├──────────┬──────────┤
        │ Thread-1 │ Thread-2 │  ...
        │  decode  │  decode  │
        │  process │  process │
        │  encode  │  encode  │
        │  write   │  write   │
        └──────────┴──────────┘
```

### 4.6.4 主从多 Reactor 模式

大型框架（如 Netty）采用的模式：

```text
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌──────────────┐         ┌──────────────────────────────┐ │
│  │ Boss Reactor  │         │      Worker Reactor Pool     │ │
│  │ (1 个线程)    │         │      (N 个线程)              │ │
│  │              │  accept  │                              │ │
│  │ Selector     ├────────►│  Worker-1  Worker-2  ...     │ │
│  │ 只处理 ACCEPT│         │  处理 READ/WRITE 事件        │ │
│  └──────────────┘         └──────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

| 角色 | 职责 | 线程数 |
|------|------|--------|
| Boss Reactor | 接受新连接，注册到 Worker | 1 |
| Worker Reactor | 处理已建立连接的读写事件 | CPU 核心数 × 2 |

---

## 4.7 NIO 的真实限制

### 4.7.1 编程复杂度

用原生 NIO 写一个生产级的网络服务器，需要处理：

```text
手动管理的事项清单:
├── Buffer 的 flip / clear / compact 切换（极易出错）
├── 半包 / 粘包问题（TCP 是字节流，没有消息边界）
├── SelectionKey 的 attach / detach 生命周期
├── Channel 的非阻塞写（一次 write 可能没写完，需要注册 OP_WRITE 继续写）
├── 空闲连接检测与超时关闭
├── 线程安全（多个线程操作同一个 Channel）
└── 异常处理（连接重置、管道破裂等）
```

一个简单的 NIO 服务器，代码量轻松超过 500 行，而等价的 BIO 版本只需 50 行。

### 4.7.2 epoll 空轮询 Bug

这是 JDK 中一个著名的 Bug（JDK-6670302）：

**现象：** 在 Linux 上，`Selector.select()` 方法有时会**立即返回 0**，即使没有事件就绪。这导致 CPU 空转（spin），CPU 使用率飙升到 100%。

```java
// 正常情况：select() 阻塞直到有事件
int ready = selector.select(timeout);

// Bug：select() 立即返回 0，循环不断空转
while (true) {
    int ready = selector.select(timeout);  // 应该阻塞，但立刻返回 0！
    // ready = 0，没有事件，但也没阻塞
    // → 循环空转 → CPU 100%
}
```

**Netty 的解决方案：** 检测到连续 N 次（默认 512 次）空返回后，**重建 Selector**：

```java
// Netty 的规避策略（简化示意）
int selectorInvocations = 0;
while (true) {
    long beforeSelect = System.nanoTime();
    int ready = selector.select(timeout);
    selectorInvocations++;

    if (ready == 0 && selectorInvocations > 512) {
        // 检测到空轮询 Bug，重建 Selector
        Selector newSelector = Selector.open();
        // 把所有 Channel 重新注册到新 Selector
        rebuildSelector(newSelector);
        selector = newSelector;
        selectorInvocations = 0;
    }
}
```

### 4.7.3 其他痛点

| 问题 | 描述 |
|------|------|
| **API 设计反人类** | `ByteBuffer` 的 `flip/clear/compact` 容易遗忘，导致数据错乱 |
| **缺少协议支持** | HTTP、WebSocket、SSL 都要自己实现 |
| **Buffer 只能操作 position 和 limit 之间** | 不能像数组一样随机读写 |
| **FileChannel 不支持非阻塞** | 文件 I/O 无法用 Selector 管理 |
| **跨平台行为不一致** | Windows 的 `select` 实现和 Linux 的 `epoll` 性能差距大 |

### 4.7.4 从 NIO 到 Netty

正是因为原生 NIO 的这些问题，社区才催生了 **Netty**：

```text
原生 NIO 的痛点              Netty 的解决方案
─────────────────           ─────────────────
Buffer 操作复杂        ──►  ByteBuf（更友好的 API，自动扩容）
epoll 空轮询 Bug       ──►  自动检测 + 重建 Selector
缺少协议支持           ──►  内置 HTTP/HTTPS/WebSocket/SSL 编解码
手动管理线程模型       ──►  EventLoopGroup 抽象
半包粘包               ──►  内置拆包器（LengthField, Delimiter, ...）
```

> Netty 是目前 Java 高性能网络编程的事实标准。学习原生 NIO 不是为了用它写生产代码，而是为了**理解 Netty 的设计动机**——当你知道"为什么"，才能真正用好"是什么"。

---

## 本章小结

| 组件 | 职责 | 核心类 |
|------|------|--------|
| **Channel** | 双向数据通道 | `SocketChannel`, `ServerSocketChannel` |
| **Buffer** | 数据读写的容器 | `ByteBuffer`, `CharBuffer` |
| **Selector** | 多路复用器，事件通知 | `Selector`, `SelectionKey` |
| **Reactor** | 标准化的事件驱动架构模式 | 手写 → Netty |

**NIO 的本质：** 把"I/O 等待"从线程职责中剥离，交给操作系统（epoll/kqueue），让线程只负责"有事件时处理"。这就是**事件驱动**的精髓。

---

> **纵横联系：**
> - **本卷第3章** 讲述的 BIO 模型是 NIO 的对比基准——正是因为 BIO 的"一连接一线程"无法扩展，才催生了 NIO。
> - **本卷第5章** 将讲解 Netty 框架，它是本章 NIO 三大组件（Channel + Buffer + Selector）加上 Reactor 模式的工业级封装。
> - **第一卷《Java 语言基础》** 中的泛型（`SelectionKey.attach()` 的类型安全）、异常处理（`IOException` 的各种子类）在本章代码中反复出现。
> - **第二卷《Java 并发编程》** 中的线程池、线程安全、CAS 等概念是理解多线程 Reactor 模式的前置知识。
