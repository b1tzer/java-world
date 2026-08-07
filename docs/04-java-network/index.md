# 第四卷 网络与通信

> 回答"数据如何从一个 JVM 到另一个 JVM"。覆盖 TCP/IP → Socket → NIO → Netty → HTTP → Servlet/Spring MVC → RPC → 长连接。

## 章节

- [网络通信基础](/04-java-network/chapter-01-network-basics) — 分层模型、数据封装旅程
- [TCP/IP](/04-java-network/chapter-02-tcp-ip) — 三次握手/四次挥手、粘包拆包、性能参数
- [Socket 编程](/04-java-network/chapter-03-socket) — fd 与五元组、系统调用链、内核队列、Socket 选项
- [Java NIO](/04-java-network/chapter-04-nio) — Channel/Buffer/Selector、Reactor 模式
- [Netty](/04-java-network/chapter-05-netty) — EventLoop、Pipeline、ByteBuf、编解码
- [HTTP 协议](/04-java-network/chapter-06-http) — 方法语义、状态码、HTTP/1.1→2→3 演进
- [Servlet 到 Spring MVC](/04-java-network/chapter-07-servlet-springmvc) — Tomcat NIO、DispatcherServlet
- [RPC 与微服务](/04-java-network/chapter-08-rpc) — 序列化、服务发现、Dubbo/gRPC
- [长连接与实时通信](/04-java-network/chapter-09-long-connection) — WebSocket、SSE、IM 系统设计
- [网络诊断](/04-java-network/chapter-10-network-diagnostics) — 抓包、netstat、优化策略
