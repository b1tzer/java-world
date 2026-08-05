# 第3章 Java Socket 编程：网络抽象的起点

> **核心问题：** 操作系统如何把网线上的电信号变成程序可读写的字节流？Java 程序员第一次"触网"应该从哪里开始？本章从 Socket 的本质出发，带你理解阻塞 I/O 模型的运作方式、它的天花板在哪里，并用一个完整的 Echo Server/Client 把理论变成可运行的代码。

---

## 3.1 Socket 是什么

### 3.1.1 从物理链路到编程接口

一台计算机要和另一台计算机通信，底层需要网卡、驱动、协议栈（TCP/IP）等一系列软硬件协作。对应用程序而言，不可能直接操作网卡寄存器——操作系统需要提供一个**统一的编程抽象**，这就是 **Socket（套接字）**。

```
┌──────────────┐
│  Application │
└──────┬───────┘
       │  read() / write()
┌──────▼───────┐
│    Socket     │  ← OS 提供的抽象：IP + Port
├──────────────┤
│  TCP / UDP    │
├──────────────┤
│      IP       │
├──────────────┤
│  Link Layer   │
└──────────────┘
```

一个 Socket 由两个维度唯一标识：

| 维度 | 含义 | 示例 |
|------|------|------|
| **IP 地址** | 哪台机器 | `192.168.1.100` |
| **端口号 (Port)** | 机器上的哪个进程 | `8080` |

> 类比：IP 是"小区地址"，Port 是"门牌号"。快递员（网络包）需要两者兼备才能把包裹送到正确的住户（进程）手中。

### 3.1.2 Socket 的两种类型

| 类型 | 协议 | 特点 | 典型场景 |
|------|------|------|----------|
| **Stream Socket** | TCP | 面向连接、可靠、有序 | HTTP、数据库连接 |
| **Datagram Socket** | UDP | 无连接、不可靠、低延迟 | DNS、视频流、游戏 |

本书以 TCP Stream Socket 为主线，因为 Java 企业级开发中绝大多数网络通信基于 TCP。

### 3.1.3 Socket 的生命周期

```
  Server                          Client
    │                                │
    │ bind() + listen()              │
    │                                │
    │         ◄── TCP 三次握手 ──    │ connect()
    │                                │
    │ accept() ──► new Socket        │
    │                                │
    │ ◄──── read / write ────►      │ read / write
    │                                │
    │ close()         ◄── 四次挥手 ──┤ close()
    │                                │
```

在 Java 中，这个生命周期映射为两个核心类：

- **`ServerSocket`**：监听端口，等待连接（服务端）
- **`Socket`**：代表一条已建立的连接（客户端和服务端各持一端）

---

## 3.2 BIO 模型

### 3.2.1 什么是 BIO

**BIO（Blocking I/O）** 是 Java 最早的网络 I/O 模型。其核心特征是：当线程调用 `InputStream.read()` 时，如果对端尚未发送数据，**线程会被阻塞（挂起）**，直到数据到达或连接关闭。

```java
// 典型的阻塞读取
InputStream in = socket.getInputStream();
int data = in.read();  // 线程在此阻塞，直到有数据可读
```

### 3.2.2 一连接一线程模型

为了让多个客户端能同时被服务，BIO 的经典做法是：**每接受一个连接，就创建一个新线程来处理它。**

```
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

Java 代码骨架如下：

```java
ServerSocket serverSocket = new ServerSocket(8080);
ExecutorService pool = Executors.newCachedThreadPool();

while (true) {
    Socket socket = serverSocket.accept();           // 主线程阻塞等待连接
    pool.submit(() -> handleClient(socket));          // 提交给线程池处理
}

void handleClient(Socket socket) {
    try (socket) {
        InputStream in = socket.getInputStream();
        OutputStream out = socket.getOutputStream();
        byte[] buf = new byte[1024];
        int len;
        while ((len = in.read(buf)) != -1) {         // 工作线程阻塞读取
            out.write(buf, 0, len);                   // 回写（Echo）
        }
    } catch (IOException e) {
        // 处理异常
    }
}
```

### 3.2.3 BIO 的工作流程

```
时间轴 ──────────────────────────────────────►

Thread-1: [accept]──[read 阻塞 50ms]──[write]──[read 阻塞 200ms]──[write]──[close]
Thread-2:           [accept]──[read 阻塞 100ms]──[write]──[read 阻塞 ...]
Thread-3:                        [accept]──[read 阻塞 80ms]──[write]──...

注意：每个线程大部分时间都在"等"（阻塞在 read 上），真正做计算的时间很短。
```

---

## 3.3 BIO 为什么无法支撑高并发

### 3.3.1 问题一：线程内存开销巨大

每个 Java 线程需要独立的栈空间，默认约 **512KB ~ 1MB**。

| 连接数 | 线程数 | 栈内存（按 1MB/线程） | 说明 |
|--------|--------|----------------------|------|
| 1,000 | 1,000 | ~1 GB | 勉强可用 |
| 10,000 | 10,000 | ~10 GB | 一台普通服务器扛不住 |
| 100,000 | 100,000 | ~100 GB | 物理上不可能 |

> 现实中很多连接是"空闲"的——比如长连接客户端每隔 30 秒发一次心跳，但线程依然被占用在阻塞 `read()` 上，白白消耗内存。

### 3.3.2 问题二：线程调度开销

操作系统调度线程需要：
- **上下文切换**：保存/恢复寄存器、刷新 TLB、切换内核态/用户态
- **CPU 缓存失效**：切换后 L1/L2 缓存几乎全部失效

当线程数远超 CPU 核心数时，CPU 大量时间花在"切换线程"而非"执行任务"上：

```
CPU 核心数: 8
线程数:     5000

每个核心平均分摊: 625 个线程
→ 大量时间花在上下文切换 → 吞吐量反而下降
```

### 3.3.3 问题三：资源浪费——"占着茅坑不拉屎"

BIO 线程在 `read()` 阻塞期间：

```
线程状态分布（典型 Web 服务器）:
┌──────────────────────────────────────────────┐
│ ████████ 10%  计算（业务逻辑）                 │
│ ████████████████████████████████████ 70% 阻塞等待 I/O │
│ ██████ 10%  等待调度                          │
│ ██████ 10%  其他（GC 等）                      │
└──────────────────────────────────────────────┘
```

90% 的时间在"等"，但线程和内存已经被占住了。这就是资源浪费的本质。

### 3.3.4 总结：BIO 的天花板

| 问题 | 根因 | 后果 |
|------|------|------|
| 内存爆炸 | 一连接一线程 | 连接数上不去 |
| CPU 空转 | 上下文切换 | 吞吐量上不去 |
| 资源浪费 | 阻塞等待期间线程被占 | 硬件利用率低 |

> **一句话总结：** BIO 的问题不在于"慢"，而在于"等"——用最昂贵的资源（线程）去做最廉价的事情（等待）。

### 3.3.5 真实世界中的 BIO 场景

尽管 BIO 有明显的天花板，但它在以下场景中依然是合理的选择：

| 场景 | 原因 | 示例 |
|------|------|------|
| 连接数少（< 100） | 线程开销可忽略 | 内部管理后台、小型工具 |
| 请求-响应模式 | 每个连接生命周期短 | 传统 RPC 调用 |
| 原型开发 | 代码简单，快速验证 | Demo、测试服务 |
| 与遗留系统集成 | 旧框架基于 BIO | Servlet 2.x 容器 |

> **注意：** Tomcat 7 以前默认使用 BIO Connector（`org.apache.coyote.http11.Http11Protocol`），每个请求占用一个线程。Tomcat 8.5 起彻底移除了 BIO Connector，全面转向 NIO。这是 Java 生态从 BIO 过渡到 NIO 的标志性事件。

---

## 3.4 Java Socket 编程实战

### 3.4.1 Echo Server

一个最简单的服务端：接收客户端发来的任何数据，原样回传（Echo）。

```java
import java.io.*;
import java.net.*;
import java.util.concurrent.*;

public class EchoServer {
    private final int port;
    private final ExecutorService pool;

    public EchoServer(int port) {
        this.port = port;
        this.pool = Executors.newCachedThreadPool();
    }

    public void start() throws IOException {
        ServerSocket serverSocket = new ServerSocket(port);
        System.out.println("Echo Server started on port " + port);

        while (true) {
            Socket clientSocket = serverSocket.accept();  // 阻塞等待
            System.out.println("New connection: " + clientSocket.getRemoteSocketAddress());
            pool.submit(() -> handleClient(clientSocket));
        }
    }

    private void handleClient(Socket socket) {
        try (socket) {
            InputStream in = socket.getInputStream();
            OutputStream out = socket.getOutputStream();
            byte[] buffer = new byte[1024];
            int bytesRead;

            while ((bytesRead = in.read(buffer)) != -1) {   // 阻塞读
                String received = new String(buffer, 0, bytesRead);
                System.out.println("[" + Thread.currentThread().getName() + "] Received: " + received.trim());
                out.write(buffer, 0, bytesRead);              // Echo 回写
                out.flush();
            }
        } catch (IOException e) {
            System.err.println("Client disconnected: " + e.getMessage());
        }
    }

    public static void main(String[] args) throws IOException {
        new EchoServer(8080).start();
    }
}
```

### 3.4.2 Echo Client

```java
import java.io.*;
import java.net.*;
import java.util.Scanner;

public class EchoClient {
    public static void main(String[] args) throws IOException {
        Socket socket = new Socket("localhost", 8080);
        System.out.println("Connected to Echo Server");

        OutputStream out = socket.getOutputStream();
        InputStream in = socket.getInputStream();
        Scanner scanner = new Scanner(System.in);

        while (true) {
            System.out.print("You> ");
            String line = scanner.nextLine();
            if ("quit".equalsIgnoreCase(line)) break;

            out.write((line + "\n").getBytes());
            out.flush();

            byte[] buffer = new byte[1024];
            int bytesRead = in.read(buffer);                  // 阻塞等待回复
            if (bytesRead == -1) break;

            System.out.println("Server> " + new String(buffer, 0, bytesRead).trim());
        }

        socket.close();
        System.out.println("Disconnected.");
    }
}
```

### 3.4.3 运行效果

```
终端 1 (Server):                          终端 2 (Client):
$ java EchoServer                         $ java EchoClient
Echo Server started on port 8080          Connected to Echo Server
                                          You> hello
[nio-8080-exec-1] Received: hello         Server> hello
                                          You> 你好世界
[nio-8080-exec-1] Received: 你好世界       Server> 你好世界
                                          You> quit
                                          Disconnected.
```

### 3.4.4 代码剖析：关键细节

上面的 Echo Server 虽然简短，但有几个值得注意的设计细节：

**1. 为什么用 `CachedThreadPool` 而不是 `FixedThreadPool`？**

```java
// CachedThreadPool：空闲线程会被回收，新连接到来时按需创建
Executors.newCachedThreadPool();
// 适合：连接数波动大的场景

// FixedThreadPool：固定线程数，超出的请求在队列中等待
Executors.newFixedThreadPool(100);
// 适合：需要严格控制资源上限的场景
```

在生产环境中，更推荐使用 `FixedThreadPool` 或自定义 `ThreadPoolExecutor`，避免无限制创建线程：

```java
ExecutorService pool = new ThreadPoolExecutor(
    10,                                        // 核心线程数
    200,                                       // 最大线程数
    60L, TimeUnit.SECONDS,                     // 空闲线程存活时间
    new LinkedBlockingQueue<>(1024),            // 任务队列
    new ThreadFactoryBuilder().setNameFormat("echo-%d").build(),
    new ThreadPoolExecutor.AbortPolicy()        // 拒绝策略
);
```

**2. 为什么 `out.flush()` 是必要的？**

```java
out.write(buffer, 0, bytesRead);
out.flush();  // ← 这一行不能省
```

`OutputStream` 的 `write()` 默认使用缓冲区，数据不会立即发送到网络。`flush()` 强制将缓冲区的数据刷入 TCP 发送缓冲区。如果不调用 `flush()`，客户端可能一直收不到回复，直到缓冲区满或连接关闭。

**3. 为什么用 `try (socket)` 语法？**

```java
try (socket) {  // 等价于 try-with-resources
    // ...
}
```

Java 7 引入的 try-with-resources 语法确保 `socket.close()` 在异常或正常退出时都会被调用，避免资源泄漏。

---

### 3.4.5 压测：BIO 的极限在哪里

用简单的压测脚本模拟并发连接：

```java
// 压测客户端：同时发起 N 个长连接，每秒发送一条消息
public class EchoStressTest {
    public static void main(String[] args) throws Exception {
        int connectionCount = 5000;
        CountDownLatch latch = new CountDownLatch(connectionCount);

        for (int i = 0; i < connectionCount; i++) {
            final int id = i;
            new Thread(() -> {
                try {
                    Socket s = new Socket("localhost", 8080);
                    OutputStream out = s.getOutputStream();
                    out.write(("ping-" + id + "\n").getBytes());
                    out.flush();
                    byte[] buf = new byte[1024];
                    s.getInputStream().read(buf);    // 阻塞
                    latch.countDown();
                    Thread.sleep(Long.MAX_VALUE);     // 保持连接
                } catch (Exception e) {
                    System.err.println("Connection " + id + " failed: " + e.getMessage());
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
|--------|------|------|
| 1,000 | ✅ 正常 | — |
| 5,000 | ⚠️ 变慢 | 线程数过多，GC 频繁 |
| 10,000 | ❌ OOM 或无法创建线程 | `OutOfMemoryError: unable to create new native thread` |

> 这个实验清晰地展示了 BIO 的天花板。要突破它，就需要换一种思路——不是"等数据来"，而是"数据来了通知我"。这就是下一章要讲的 **NIO**。

---

## 本章小结

| 概念 | 要点 |
|------|------|
| Socket | IP + Port，OS 提供的网络编程抽象 |
| BIO | 阻塞 I/O，`read()` 会挂起线程直到数据到达 |
| 一连接一线程 | BIO 的经典模型，简单但不可扩展 |
| 三大瓶颈 | 内存开销、调度开销、资源浪费 |
| 突破方向 | 用事件通知替代阻塞等待 → NIO |

---

> **纵横联系：**
> - **本卷第2章** 已经介绍了网络分层模型和 TCP/IP 协议基础，本章的 Socket 正是传输层 TCP 的编程接口。
> - **本卷第4章** 将深入讲解 Java NIO（Non-blocking I/O），它是对本章 BIO 模型的根本性革新——从"一个线程盯一个连接"进化为"一个线程管理万千连接"。
> - **第一卷《Java 语言基础》** 中讲过的线程与并发知识（`ExecutorService`、`CountDownLatch` 等）在本章代码中大量使用，是理解 BIO 模型的前置基础。
