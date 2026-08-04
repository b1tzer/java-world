# 第四卷 网络与通信

> 回答"数据如何从一个 JVM 到另一个 JVM"。覆盖 TCP/IP → Socket → NIO → Netty → HTTP → Servlet/Spring MVC → RPC → 长连接。

## 章节

- [网络通信基础](chapter-01-network-basics.md) — 分层模型、数据封装旅程
- [TCP/IP](chapter-02-tcp-ip.md) — 三次握手/四次挥手、粘包拆包、性能参数
- [Socket 编程](chapter-03-socket.md) — BIO 模型、一连接一线程的瓶颈
- [Java NIO](chapter-04-nio.md) — Channel/Buffer/Selector、Reactor 模式
- [Netty](chapter-05-netty.md) — EventLoop、Pipeline、ByteBuf、编解码
- [HTTP 协议](chapter-06-http.md) — 方法语义、状态码、HTTP/1.1→2→3 演进
- [Servlet 到 Spring MVC](chapter-07-servlet-springmvc.md) — Tomcat NIO、DispatcherServlet
- [RPC 与微服务](chapter-08-rpc.md) — 序列化、服务发现、Dubbo/gRPC
- [长连接与实时通信](chapter-09-long-connection.md) — WebSocket、SSE、IM 系统设计
- [网络诊断](chapter-10-network-diagnostics.md) — 抓包、netstat、优化策略
