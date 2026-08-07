# 第6章 HTTP 协议：应用层通信标准

> TCP 解决了"字节如何可靠地从 A 传到 B"的问题，但两个应用程序之间要交换什么数据、用什么格式、如何确认对方理解了——这些"业务通信规则"TCP 并不关心。HTTP（HyperText Transfer Protocol）正是为解决这个问题而诞生的应用层协议：它定义了客户端与服务器之间**请求-响应**的完整语义，是当今互联网上最广泛使用的通信标准。

## 6.1 HTTP 为什么出现

### 6.1.1 从 TCP 到 HTTP

TCP 是传输层协议，提供可靠的字节流传输。但仅有 TCP 是不够的：

```text
问题：浏览器想要获取 www.example.com 的首页

TCP 能做到：建立连接 → 发送字节 → 接收字节 → 关闭连接

TCP 做不到：
  - 发什么格式的请求？            → HTTP 定义了请求报文格式
  - 怎么告诉服务器我要哪个资源？   → HTTP 定义了 URI + 方法
  - 服务器怎么告诉客户端结果？     → HTTP 定义了响应报文格式
  - 返回的数据是什么类型？         → HTTP 定义了 Content-Type
  - 连接要不要保持？               → HTTP 定义了 Connection 头
```

### 6.1.2 HTTP 的设计哲学

HTTP 由 Tim Berners-Lee 在 1989 年发明，其设计遵循几个核心原则：

| 原则 | 含义 | 体现 |
|------|------|------|
| **简单性** | 协议报文是人类可读的文本 | 请求/响应格式为纯 ASCII 文本 |
| **无状态** | 服务器不记住客户端的上下文 | 每个请求独立，不依赖之前的请求 |
| **可扩展** | 通过头部字段扩展能力 | 自定义 Header、Content-Type 等 |
| **面向资源** | 一切皆资源，用 URI 标识 | `/api/users/123` 表示 ID 为 123 的用户 |

### 6.1.3 协议分层中的位置

```text
┌─────────────────────────────────────────┐
│  应用层    HTTP / HTTPS / WebSocket     │  ← 本章主角
├─────────────────────────────────────────┤
│  传输层    TCP / UDP                    │
├─────────────────────────────────────────┤
│  网络层    IP                           │
├─────────────────────────────────────────┤
│  链路层    Ethernet / Wi-Fi             │
└─────────────────────────────────────────┘
```

HTTP 工作在 TCP 之上（HTTP/3 之前），默认端口 80（HTTPS 默认 443）。

## 6.2 HTTP 报文结构

### 6.2.1 请求报文（Request）

HTTP 请求由三部分组成：**请求行**、**请求头**、**请求体**。

```text
┌────────────────────────────────────────────┐
│ 请求行 (Request Line)                       │
│   方法  空格  URI  空格  版本  CRLF         │
├────────────────────────────────────────────┤
│ 请求头 (Request Headers)                    │
│   Header-Name: Header-Value  CRLF          │
│   ...                                      │
│   CRLF (空行，标识头部结束)                  │
├────────────────────────────────────────────┤
│ 请求体 (Request Body)                       │
│   (可选，POST/PUT/PATCH 时携带数据)         │
└────────────────────────────────────────────┘
```

一个真实的请求示例：

```http
POST /api/users HTTP/1.1
Host: www.example.com
Content-Type: application/json
Content-Length: 45
Authorization: Bearer eyJhbGciOi...
Connection: keep-alive

{"name":"张三","email":"zhangsan@example.com"}
```

各部分解析：

| 部分 | 内容 | 说明 |
|------|------|------|
| 请求行 | `POST /api/users HTTP/1.1` | 方法=POST，资源=/api/users，版本=HTTP/1.1 |
| Host | `www.example.com` | 虚拟主机必需字段 |
| Content-Type | `application/json` | 请求体的数据格式 |
| Content-Length | `45` | 请求体的字节长度 |
| Authorization | `Bearer eyJ...` | 认证凭据 |
| 请求体 | `{"name":"张三",...}` | 实际提交的数据 |

### 6.2.2 响应报文（Response）

```text
┌────────────────────────────────────────────┐
│ 状态行 (Status Line)                        │
│   版本  空格  状态码  空格  原因短语  CRLF   │
├────────────────────────────────────────────┤
│ 响应头 (Response Headers)                   │
│   Header-Name: Header-Value  CRLF          │
│   ...                                      │
│   CRLF                                     │
├────────────────────────────────────────────┤
│ 响应体 (Response Body)                      │
│   (实际的资源内容)                           │
└────────────────────────────────────────────┘
```

响应示例：

```http
HTTP/1.1 201 Created
Content-Type: application/json
Content-Length: 62
Location: /api/users/42
Date: Tue, 04 Aug 2026 14:00:00 GMT

{"id":42,"name":"张三","email":"zhangsan@example.com"}
```

### 6.2.3 Header 字段分类

| 类别 | 示例 | 说明 |
|------|------|------|
| **通用头** | `Date`, `Connection`, `Cache-Control` | 请求和响应都可以使用 |
| **请求头** | `Host`, `Authorization`, `Accept`, `User-Agent` | 客户端发给服务器 |
| **响应头** | `Server`, `Set-Cookie`, `ETag`, `Location` | 服务器发给客户端 |
| **实体头** | `Content-Type`, `Content-Length`, `Content-Encoding` | 描述 Body 的元数据 |

### 6.2.4 请求/响应在 TCP 中的传输

HTTP 报文通过 TCP 字节流传输，请求和响应是交替进行的：

```text
客户端                                 服务器
  │                                     │
  │ ──── TCP 三次握手 ─────────────→    │
  │                                     │
  │ ──── HTTP Request ─────────────→    │
  │                                     │
  │ ←──── HTTP Response ───────────    │
  │                                     │
  │ ──── HTTP Request ─────────────→    │  (Keep-Alive 复用连接)
  │                                     │
  │ ←──── HTTP Response ───────────    │
  │                                     │
  │ ──── TCP 四次挥手 ─────────────→    │
```

## 6.3 HTTP 方法语义

### 6.3.1 标准方法一览

HTTP 定义了一组 **请求方法**，每个方法有明确的语义：

| 方法 | 语义 | 有请求体 | 有响应体 | 安全 | 幂等 |
|------|------|----------|----------|------|------|
| **GET** | 获取资源 | 否 | 是 | ✅ | ✅ |
| **POST** | 提交数据/创建资源 | 是 | 是 | ❌ | ❌ |
| **PUT** | 全量替换资源 | 是 | 可选 | ❌ | ✅ |
| **DELETE** | 删除资源 | 否 | 可选 | ❌ | ✅ |
| **PATCH** | 部分更新资源 | 是 | 可选 | ❌ | ❌ |
| **HEAD** | 获取资源元数据（无 Body） | 否 | 否 | ✅ | ✅ |
| **OPTIONS** | 查询服务器支持的方法 | 否 | 是 | ✅ | ✅ |

### 6.3.2 安全与幂等

这两个属性是 HTTP 方法语义的核心：

**安全（Safe）：** 不修改服务器上的资源。GET 和 HEAD 是安全的——它们只是"读"操作，不会产生副作用。

**幂等（Idempotent）：** 同一个请求执行一次和执行多次，效果相同。

```text
幂等的例子：
  PUT /users/42 {"name":"李四"}
  → 执行1次：name = "李四"
  → 执行10次：name = "李四"  (结果相同)

非幂等的例子：
  POST /orders {"amount":100}
  → 执行1次：创建1个订单
  → 执行10次：创建10个订单  (结果不同！)
```

### 6.3.3 GET vs POST 的常见误解

| 误解 | 事实 |
|------|------|
| "GET 参数有长度限制" | 协议本身无限制，是浏览器/服务器的实现限制 |
| "POST 比 GET 安全" | 都是明文传输，安全性取决于 HTTPS，而非方法 |
| "GET 不能有 Body" | 协议允许，但大部分服务器/框架会忽略 |
| "GET 只用于查询" | 语义建议如此，但不是强制（有些 API 用 GET 做搜索） |

### 6.3.4 RESTful 方法映射

REST 架构风格将 HTTP 方法映射到 CRUD 操作：

```text
CRUD 操作      HTTP 方法       URI 示例            语义
─────────      ──────────      ──────────          ──────
Create         POST            /api/users          创建新用户
Read           GET             /api/users/42       获取用户 42
Update         PUT             /api/users/42       全量更新用户 42
Update         PATCH           /api/users/42       部分更新用户 42
Delete         DELETE          /api/users/42       删除用户 42
List           GET             /api/users?page=1   获取用户列表
```

## 6.4 HTTP 状态码

### 6.4.1 状态码分类

HTTP 状态码是三位数字，按首位分类：

| 范围 | 类别 | 含义 |
|------|------|------|
| 1xx | 信息性 | 请求已接收，继续处理 |
| 2xx | 成功 | 请求已成功处理 |
| 3xx | 重定向 | 需要进一步操作 |
| 4xx | 客户端错误 | 请求有误 |
| 5xx | 服务器错误 | 服务器处理失败 |

### 6.4.2 常见状态码详解

#### 2xx 成功

| 状态码 | 名称 | 语义 | 典型场景 |
|--------|------|------|----------|
| 200 | OK | 请求成功 | GET 返回资源、PUT 更新成功 |
| 201 | Created | 资源已创建 | POST 创建资源成功，配合 `Location` 头 |
| 204 | No Content | 成功但无响应体 | DELETE 删除成功 |

#### 3xx 重定向

| 状态码 | 名称 | 语义 | 缓存 |
|--------|------|------|------|
| 301 | Moved Permanently | 永久重定向 | 浏览器会缓存 |
| 302 | Found | 临时重定向 | 不缓存 |
| 304 | Not Modified | 资源未修改 | 配合 `ETag`/`If-None-Match` |

304 的工作流程：

```text
客户端: GET /style.css
        If-None-Match: "abc123"
→

← 服务器: 比对 ETag
          如果匹配 → 304 Not Modified (不传输 Body，节省带宽)
          如果不匹配 → 200 OK + 新的 style.css
```

#### 4xx 客户端错误

| 状态码 | 名称 | 语义 | 典型场景 |
|--------|------|------|----------|
| 400 | Bad Request | 请求格式错误 | JSON 语法错误、参数缺失 |
| 401 | Unauthorized | 未认证 | 缺少或无效的 Token |
| 403 | Forbidden | 无权限 | 已认证但权限不足 |
| 404 | Not Found | 资源不存在 | URI 错误或资源已删除 |
| 405 | Method Not Allowed | 方法不支持 | 用 POST 访问只支持 GET 的资源 |
| 429 | Too Many Requests | 请求过多 | 触发限流 |

**401 vs 403 的区别：**

```text
401 Unauthorized (未认证):
  → "你是谁？请先登录。"
  → 通常配合 WWW-Authenticate 头返回

403 Forbidden (无权限):
  → "我知道你是谁，但你没权限。"
  → 登录后访问无权资源
```

#### 5xx 服务器错误

| 状态码 | 名称 | 语义 | 典型场景 |
|--------|------|------|----------|
| 500 | Internal Server Error | 服务器内部错误 | 未捕获的异常、Bug |
| 502 | Bad Gateway | 网关错误 | 反向代理后端不可达 |
| 503 | Service Unavailable | 服务不可用 | 服务器过载或维护 |
| 504 | Gateway Timeout | 网关超时 | 后端响应超时 |

### 6.4.3 状态码设计原则

<SvgDiagram src="/diagrams/http-status-decision.svg" />

## 6.5 HTTP/1.1 → HTTP/2 → HTTP/3

### 6.5.1 HTTP/1.0 的局限

HTTP/1.0 的默认行为是 **一个请求一个连接**：

```text
HTTP/1.0:
  请求1 → 建立TCP → 发送 → 接收 → 关闭TCP
  请求2 → 建立TCP → 发送 → 接收 → 关闭TCP
  请求3 → 建立TCP → 发送 → 接收 → 关闭TCP

问题：每次请求都要 TCP 三次握手 + 四次挥手，延迟巨大
```

### 6.5.2 HTTP/1.1 的改进

HTTP/1.1（1997 年，RFC 2068；1999 年修订为 RFC 2616）引入了多项关键改进：

| 特性 | 说明 |
|------|------|
| **持久连接** | 默认 `Connection: keep-alive`，复用 TCP 连接 |
| **管线化（Pipelining）** | 允许连续发送多个请求，不必等前一个响应返回 |
| **分块传输** | `Transfer-Encoding: chunked`，不必提前知道内容长度 |
| **Host 头** | 必需字段，支持虚拟主机 |
| **缓存增强** | `ETag`、`If-None-Match`、`Cache-Control` |

```text
HTTP/1.1 Keep-Alive + Pipelining:
  建立TCP → 请求1 → 请求2 → 请求3 → 响应1 → 响应2 → 响应3 → 关闭TCP
                  ↑
                  不必等响应1就能发请求2

问题：响应必须按请求顺序返回（队头阻塞）
```

**HTTP/1.1 的瓶颈：**

```text
问题1 — 队头阻塞 (Head-of-Line Blocking):
  请求1 的响应慢 → 请求2、3 的响应即使已就绪也必须排队等待

问题2 — 连接数限制:
  浏览器对同一域名限制 6-8 个 TCP 连接
  需要域名分片 (domain sharding) 来突破限制

问题3 — 头部冗余:
  每个请求都携带完整的 Header（Cookie 等），大量重复
```

### 6.5.3 HTTP/2 的革命

HTTP/2（2015 年，RFC 7540）基于 Google 的 SPDY 协议，引入了根本性改变：

#### 二进制分帧层

HTTP/2 将通信分解为更小的 **帧（Frame）**，在 **流（Stream）** 上传输：

<SvgDiagram src="/diagrams/http-message-format.svg" />

#### 多路复用（Multiplexing）

HTTP/2 最核心的特性：**一个 TCP 连接上可以并行传输多个请求/响应，互不阻塞**。

<SvgDiagram src="/diagrams/http2-multiplex.svg" />

#### 头部压缩（HPACK）

HTTP/2 使用 HPACK 算法压缩头部：

```text
请求1: Cookie: session=abc123; token=xyz789    (100 bytes)
请求2: Cookie: session=abc123; token=xyz789    (HTTP/1.1 重复100 bytes)
                                                (HTTP/2: 引用索引，~5 bytes)
```

#### 服务器推送（Server Push）

服务器可以主动推送客户端可能需要的资源：

```text
客户端: GET /index.html
服务器:
  → 响应 /index.html
  → 推送 /style.css (客户端可能需要)
  → 推送 /app.js    (客户端可能需要)

省去了客户端解析 HTML 后再请求 CSS/JS 的往返时间
```

#### HTTP/2 与 HTTP/1.1 对比

| 特性 | HTTP/1.1 | HTTP/2 |
|------|----------|--------|
| 传输格式 | 文本 | 二进制帧 |
| 多路复用 | ❌ (队头阻塞) | ✅ (Stream 级别并行) |
| 头部压缩 | ❌ (重复传输) | ✅ (HPACK) |
| 服务器推送 | ❌ | ✅ |
| 连接数 | 6-8 个 TCP 连接 | 1 个 TCP 连接 |
| 队头阻塞 | 应用层存在 | 应用层消除，TCP 层仍存在 |

### 6.5.4 HTTP/3：从 TCP 到 QUIC

HTTP/2 解决了应用层的队头阻塞，但 **TCP 层的队头阻塞仍然存在**：

```text
TCP 层队头阻塞:
  Packet 1 (Stream 1) 丢失 → Packet 2 (Stream 2) 即使已到达也必须等待
                              ↑ TCP 保证有序交付，上层无法绕过
```

HTTP/3（2022 年，RFC 9114）彻底抛弃 TCP，基于 **QUIC（Quick UDP Internet Connections）** 协议：

#### QUIC 的核心特性

<SvgDiagram src="/diagrams/http-quic-stack.svg" />

| 特性 | 说明 |
|------|------|
| **无队头阻塞** | 每个 Stream 独立可靠传输，一个丢包不影响其他 Stream |
| **0-RTT** | 首次连接 1-RTT，后续连接 0-RTT（比 TCP+TLS 的 3-RTT 快） |
| **内置加密** | TLS 1.3 内置于 QUIC，无明文传输 |
| **连接迁移** | 基于 Connection ID 而非 IP:Port，Wi-Fi 切 4G 不断连 |

#### 0-RTT 建立过程

<SvgDiagram src="/diagrams/http-evolution.svg" />

#### 三个版本的演进对比

| 维度 | HTTP/1.1 | HTTP/2 | HTTP/3 |
|------|----------|--------|--------|
| 传输层 | TCP | TCP | QUIC (UDP) |
| 传输格式 | 文本 | 二进制帧 | 二进制帧 |
| 多路复用 | ❌ | ✅ (应用层) | ✅ (传输层) |
| 队头阻塞 | 应用层+TCP | 仅 TCP | 无 |
| 头部压缩 | ❌ | HPACK | QPACK |
| 加密 | 可选 (TLS) | 可选 (TLS) | 必须 (TLS 1.3) |
| 连接建立 | TCP 3次 + TLS 2次 | TCP 3次 + TLS 2次 | 1次 (0-RTT恢复) |
| 连接迁移 | ❌ | ❌ | ✅ |
| 浏览器支持 | 全部 | 全部主流 | Chrome/Edge/Firefox |

### 6.5.5 HTTP 版本选择建议

```text
新项目应该用哪个版本？

  是否需要支持旧设备/旧代理？
    ├─ 是 → HTTP/1.1 + TLS (兼容性最好)
    └─ 否
         是否在内网/服务间通信？
           ├─ 是 → HTTP/2 (gRPC 默认 HTTP/2，内网无需 UDP)
           └─ 否 → HTTP/3 (面向用户，最佳性能)
```

**注意：** HTTP/2 和 HTTP/3 的上层语义（方法、状态码、头部字段）与 HTTP/1.1 完全兼容，应用层代码通常无需改动。版本升级主要影响的是传输层性能。

---

> **本章小结：** HTTP 协议定义了应用层通信的完整语义——用方法表达操作意图，用状态码传达处理结果，用头部字段协商元数据。从 HTTP/1.1 的 Keep-Alive 到 HTTP/2 的多路复用，再到 HTTP/3 基于 QUIC 的零队头阻塞，每一次演进都在解决前一版本的性能瓶颈，同时保持上层 API 的兼容性。
>
> **纵横联系：**
> - 📖 **第五章 Netty**：Netty 内置 `HttpServerCodec`、`HttpObjectAggregator`，是 Java 实现 HTTP 服务的主流框架；HTTP/2 的二进制帧在 Netty 中以 `Http2FrameCodec` 实现
> - 📖 **第三卷《Java I/O 与文件》**：HTTP 报文本质是通过 TCP Socket 传输的字节流，理解 Socket 编程有助于理解 HTTP 的底层传输
> - 📖 **第二卷《Java 并发编程》**：HTTP/2 的多路复用与 Netty 的 EventLoop 线程模型配合使用时，需要理解并发安全问题
> - 📖 **后续微服务卷**：RESTful API 设计、gRPC（基于 HTTP/2）、服务网关（Envoy/Nginx 对 HTTP/3 的支持）均建立在本章知识之上
