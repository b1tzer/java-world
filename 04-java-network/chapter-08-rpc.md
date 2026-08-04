# 第8章 RPC 与微服务通信

> 当一个服务需要调用另一个服务的功能时，为什么不能像调用本地方法一样简单？RPC（远程过程调用）的核心使命就是让远程调用看起来像本地调用。但"看起来像"背后隐藏着序列化、网络传输、服务发现、负载均衡、容错等一系列复杂问题。本章将从 RPC 的本质出发，拆解其核心组件，并对比主流 RPC 框架的设计取舍。

## 8.1 为什么需要 RPC

### 8.1.1 从单体到微服务

在单体架构中，所有模块运行在同一个 JVM 内，方法调用通过内存中的对象引用完成：

```java
// 单体架构: 本地方法调用
UserService userService = new UserService();
User user = userService.findById(1L);  // 直接内存调用, 无网络开销
```

当系统拆分为微服务后，`UserService` 运行在另一台机器上，本地调用不再可能：

```java
// 微服务架构: 需要远程调用
// 方式1: 直接使用 HTTP (手动)
String json = httpClient.get("http://user-service/api/users/1");
User user = objectMapper.readValue(json, User.class);

// 方式2: 使用 RPC (自动)
User user = userService.findById(1L);  // 看起来像本地调用!
```

RPC 的价值在于：**消除分布式系统的通信复杂度，让开发者用调用本地方法的方式调用远程服务**。

### 8.1.2 HTTP vs RPC

| 维度 | HTTP (RESTful) | RPC |
|------|---------------|-----|
| 语义模型 | 面向资源 (Resource-Oriented) | 面向方法 (Method-Oriented) |
| 通信风格 | 请求-响应 | 请求-响应 / 单向 / 双向流 |
| 协议文本 | HTTP/1.1 文本协议 | 自定义二进制协议 (通常) |
| 序列化 | JSON / XML (文本) | Protobuf / Hessian (二进制) |
| 接口定义 | URL + HTTP Method | IDL (Interface Definition Language) |
| 服务发现 | DNS / API Gateway | 注册中心 (Nacos, Consul) |
| 典型延迟 | 10-100ms | 1-10ms |
| 生态工具 | Swagger / OpenAPI | IDL 代码生成 |
| 适用场景 | 对外 API、跨语言互操作 | 内部服务间高频调用 |

**选择建议**：
- 对外暴露的 API → HTTP RESTful（通用性好，浏览器可直接调用）
- 内部服务间调用 → RPC（性能高，类型安全，代码生成）

## 8.2 RPC 核心组成

一个完整的 RPC 调用涉及六个核心环节，理解它们就是理解 RPC 的全部。

### 8.2.1 调用流程全景

```
  客户端 (Consumer)                                    服务端 (Provider)
  ┌───────────────────┐                               ┌───────────────────┐
  │                   │                               │                   │
  │  业务代码          │                               │  业务代码          │
  │  userService       │                               │  UserService       │
  │  .findById(1)     │                               │  .findById(1)      │
  │       │           │                               │       ▲            │
  │       ▼           │                               │       │            │
  │  ┌─────────┐      │                               │  ┌─────────┐      │
  │  │ Client  │      │                               │  │ Server  │      │
  │  │ Stub    │      │                               │  │ Stub    │      │
  │  └────┬────┘      │                               │  └────▲────┘      │
  │       │           │                               │       │            │
  │       ▼           │                               │       │            │
  │  ┌─────────┐      │     网络传输                    │  ┌─────────┐      │
  │  │序列化    │──────┼──── Socket ───────────────────▶│  │反序列化  │      │
  │  │(编码)    │      │    二进制字节流                  │  │(解码)    │      │
  │  └─────────┘      │                               │  └─────────┘      │
  │                   │                               │                   │
  └───────────────────┘                               └───────────────────┘
```

### 8.2.2 各环节详解

```
调用方: findById(1)
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ 1. Client Stub (客户端存根)                               │
│    - 拦截方法调用                                         │
│    - 提取方法名、参数类型、参数值                           │
│    - 封装为调用请求 (InvocationRequest)                    │
│                                                           │
│    请求结构:                                               │
│    {                                                      │
│      "interface": "com.example.UserService",              │
│      "method": "findById",                               │
│      "parameterTypes": ["java.lang.Long"],               │
│      "arguments": [1]                                    │
│    }                                                      │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│ 2. 序列化 (Serialization)                                │
│    - 将 Java 对象转换为字节数组                             │
│    - JSON / Protobuf / Hessian / Kryo                    │
│    - 关注: 体积、速度、跨语言支持                           │
│                                                           │
│    序列化后: [0x0A, 0x04, ...] (二进制字节流)              │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│ 3. 协议封装 (Protocol)                                   │
│    - 添加协议头 (魔数、版本、消息类型、序列化类型)           │
│    - 添加消息长度 (解决粘包/拆包)                          │
│    - 可选: 压缩、加密                                     │
│                                                           │
│    协议帧:                                                │
│    ┌────────┬───────┬────────┬──────┬────────┬────────┐  │
│    │ 魔数   │ 版本  │消息类型│序列化│ 消息长度│ 消息体  │  │
│    │ 4byte  │1byte │ 1byte │1byte│ 4byte  │ N byte │  │
│    └────────┴───────┴────────┴──────┴────────┴────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│ 4. 网络传输 (Network Transport)                          │
│    - Socket 发送字节流                                    │
│    - 连接管理 (连接池、心跳、重连)                          │
│    - 超时控制、重试策略                                    │
└──────────────────────┬──────────────────────────────────┘
                       │
            ═══════════╪═════════ 网络 ═══════════════════
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Server Stub (服务端存根)                               │
│    - 反序列化: 字节流 → InvocationRequest                 │
│    - 查找本地实现类 (通过接口名找到实现 Bean)               │
│    - 通过反射调用真实方法                                  │
│    - 将返回值序列化并写回                                  │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
              UserService.findById(1)
              return User(id=1, name="张三")
```

## 8.3 序列化机制

序列化是 RPC 的核心环节之一。不同的序列化方案在性能、体积、跨语言支持等方面差异显著。

### 8.3.1 序列化方案对比

| 方案 | 格式 | 体积 | 速度 | 跨语言 | 可读性 | 典型应用 |
|------|------|------|------|--------|--------|---------|
| JSON | 文本 | 大 | 慢 | ✅ 优秀 | ✅ 人可读 | REST API、配置文件 |
| Protobuf | 二进制 | 小 | 快 | ✅ 优秀 | ❌ 不可读 | gRPC、Kafka 消息 |
| Hessian | 二进制 | 中 | 较快 | ✅ 较好 | ❌ 不可读 | Dubbo 默认 |
| Kryo | 二进制 | 小 | 很快 | ❌ Java-only | ❌ 不可读 | Java 内部序列化 |
| Thrift | 二进制 | 小 | 快 | ✅ 优秀 | ❌ 不可读 | Thrift 框架 |

### 8.3.2 序列化示例对比

以一个简单的 User 对象为例，对比不同序列化的结果：

```java
public class User implements Serializable {
    private Long id = 1L;
    private String name = "张三";
    private Integer age = 30;
}
```

**JSON 序列化**：

```json
{"id":1,"name":"张三","age":30}
// 大小: 约 35 字节 (UTF-8)
// 特点: 人类可读, 无需 schema, 但体积大
```

**Protobuf 序列化**：

```
08 01 12 06 E5 BC A0 E4 B8 89 18 1E
// 大小: 约 14 字节
// 特点: 需要 .proto 定义文件, 体积小, 编解码快
```

```protobuf
// user.proto
syntax = "proto3";

message User {
    int64 id = 1;
    string name = 2;
    int32 age = 3;
}
```

**Hessian 序列化**：

```
C0 01 63 6F 6D 2E 65 78 61 6D ...
// 大小: 约 25 字节
// 特点: 自描述, Java 对象图支持好, Dubbo 默认
```

### 8.3.3 序列化性能基准

```
序列化速度 (ops/s, 越高越好):
Kryo     ████████████████████████████████████  1,200,000
Protobuf ██████████████████████████            850,000
Hessian  ████████████████████                  650,000
JSON     ██████████████                        450,000

反序列化速度 (ops/s, 越高越好):
Kryo     ████████████████████████████████████  1,100,000
Protobuf █████████████████████████████         980,000
Hessian  █████████████████████                 700,000
JSON     █████████████████                     550,000

序列化后体积 (bytes, 越小越好):
Protobuf ██                                    14
Kryo     ███                                   18
Hessian  █████                                 25
JSON     ██████████████                        35
```

> **注意**：以上数据为相对值，实际性能与数据结构复杂度、JVM 版本、硬件环境相关。选型时应基于实际业务数据做基准测试。

### 8.3.4 选型建议

```
需要跨语言?
├── 是 → JSON (简单场景) 或 Protobuf (高性能场景)
└── 否 → 纯 Java?
         ├── 是 → Kryo (最快) 或 Hessian (成熟)
         └── 否 → Protobuf (通用性最好)
```

## 8.4 服务发现

在微服务架构中，服务实例的网络地址是动态变化的（容器扩缩容、滚动更新）。服务发现解决了"我该调用哪个实例"的问题。

### 8.4.1 服务发现架构

```
┌────────────────────────────────────────────────────────────────┐
│                        注册中心 (Registry)                      │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  服务名        实例列表                                    │  │
│  │  user-service  → [192.168.1.10:8080, 192.168.1.11:8080]  │  │
│  │  order-service → [192.168.1.20:8081]                      │  │
│  │  pay-service   → [192.168.1.30:8082, 192.168.1.31:8082]  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
└──────────────▲───────────────────────────────▲─────────────────┘
               │ 注册 (Register)               │ 订阅/拉取 (Subscribe)
               │ 心跳 (Heartbeat)              │
               │                               │
┌──────────────┴──────────┐   ┌───────────────┴─────────────────┐
│    Provider (服务提供者)  │   │    Consumer (服务消费者)          │
│                          │   │                                  │
│  启动时:                  │   │  启动时:                          │
│  1. 注册自身到注册中心     │   │  1. 从注册中心拉取服务列表         │
│  2. 定期发送心跳           │   │  2. 订阅服务变更通知              │
│                          │   │                                  │
│  运行时:                  │   │  运行时:                          │
│  3. 处理 RPC 请求          │   │  3. 根据负载均衡策略选择实例       │
│                          │   │  4. 发起 RPC 调用                │
│  停止时:                  │   │                                  │
│  4. 从注册中心注销         │   │  5. 实例下线时自动更新本地缓存     │
└──────────────────────────┘   └──────────────────────────────────┘
```

### 8.4.2 主流注册中心对比

| 注册中心 | CAP 定位 | 一致性协议 | 健康检查 | 配置管理 | 适用场景 |
|---------|---------|-----------|---------|---------|---------|
| Nacos | AP/CP 可切换 | Raft/Distro | 心跳/探活 | ✅ | Dubbo 生态首选 |
| ZooKeeper | CP | ZAB | 心跳 | ❌ | 强一致性场景 |
| Consul | CP | Raft | 主动探活 | ❌ | 多数据中心 |
| Eureka | AP | 无 (最终一致) | 心跳 | ❌ | Spring Cloud |

### 8.4.3 负载均衡策略

当同一个服务有多个实例时，Consumer 需要选择一个实例进行调用：

```java
// 常见负载均衡策略
public interface LoadBalancer {
    Instance select(List<Instance> instances, Invocation invocation);
}
```

| 策略 | 算法 | 特点 | 适用场景 |
|------|------|------|---------|
| Random | 随机选择 | 简单，长期均匀 | 通用场景 |
| RoundRobin | 轮询 | 严格均匀分配 | 实例性能相近 |
| WeightedRoundRobin | 加权轮询 | 按权重分配 | 实例性能不同 |
| LeastActive | 最少活跃数 | 优先选压力小的 | 请求耗时差异大 |
| ConsistentHash | 一致性哈希 | 相同参数总是路由到同一实例 | 有状态服务、缓存 |

```java
// 最少活跃数负载均衡示例
public class LeastActiveLoadBalancer implements LoadBalancer {

    @Override
    public Instance select(List<Instance> instances, Invocation invocation) {
        Instance leastActive = null;
        int leastActiveCount = Integer.MAX_VALUE;

        for (Instance instance : instances) {
            int activeCount = instance.getActiveCount(); // 当前正在处理的请求数
            if (activeCount < leastActiveCount) {
                leastActiveCount = activeCount;
                leastActive = instance;
            }
        }
        return leastActive;
    }
}
```

## 8.5 RPC 框架对比

### 8.5.1 三大框架概览

| 维度 | Dubbo | gRPC | Thrift |
|------|-------|------|--------|
| 开发语言 | Java (主) | 多语言 | 多语言 |
| 序列化 | Hessian2 (默认) / Protobuf | Protobuf (默认) | Thrift Binary |
| 传输协议 | Dubbo 协议 / Triple | HTTP/2 | 自定义 TCP |
| 服务治理 | ✅ 内置 (路由/限流/熔断) | ❌ 需集成 | ❌ 需集成 |
| 代码生成 | 接口定义 + 注册 | .proto 文件生成 | .thrift 文件生成 |
| 生态 | Java 微服务首选 | 云原生、跨语言 | 跨语言 |
| 学习曲线 | 中 | 低 | 中 |

### 8.5.2 Dubbo 架构

Dubbo 是 Java 生态中最成熟的 RPC 框架，其架构体现了典型的 RPC 设计模式：

```
┌─────────────────────────────────────────────────────────────────┐
│                        Dubbo 架构                                │
│                                                                  │
│  Consumer 端                     Provider 端                     │
│  ┌──────────────┐               ┌──────────────┐                │
│  │ 业务代码      │               │ 业务代码      │                │
│  │              │               │              │                │
│  └──────┬───────┘               └──────▲───────┘                │
│         │                              │                        │
│  ┌──────▼───────┐               ┌──────┴───────┐                │
│  │ Proxy (代理)  │               │ Invoker      │                │
│  └──────┬───────┘               └──────▲───────┘                │
│         │                              │                        │
│  ┌──────▼───────┐               ┌──────┴───────┐                │
│  │ Cluster (集群)│               │ Filter (过滤) │                │
│  │ - 容错       │               │ - 日志        │                │
│  │ - 路由       │               │ - 鉴权        │                │
│  └──────┬───────┘               └──────▲───────┘                │
│         │                              │                        │
│  ┌──────▼───────┐               ┌──────┴───────┐                │
│  │ Protocol      │               │ Protocol      │                │
│  └──────┬───────┘               └──────▲───────┘                │
│         │                              │                        │
│  ┌──────▼───────┐    网络传输    ┌──────┴───────┐                │
│  │ Exchange      │◄─────────────►│ Exchange      │                │
│  │ (请求-响应)   │               │ (请求-响应)   │                │
│  └──────┬───────┘               └──────▲───────┘                │
│         │                              │                        │
│  ┌──────▼───────┐               ┌──────┴───────┐                │
│  │ Transport     │               │ Transport     │                │
│  │ (Netty/Mina)  │               │ (Netty/Mina)  │                │
│  └──────────────┘               └──────────────┘                │
│                                                                  │
│              ┌─────────────────────────┐                         │
│              │     注册中心 (Nacos)      │                         │
│              │  Provider 注册服务列表    │                         │
│              │  Consumer 订阅服务列表    │                         │
│              └─────────────────────────┘                         │
└─────────────────────────────────────────────────────────────────┘
```

Dubbo 的调用链路（简化）：

```java
// Consumer 端调用
UserService userService = dubboReference.get(); // 获取代理对象
User user = userService.findById(1L);            // 本地方法调用

// 实际执行链路:
// 1. Proxy.invoke()              → 拦截方法调用
// 2. ClusterInvoker.invoke()     → 选择具体 Invoker (负载均衡)
// 3. Filter.invoke()             → 执行过滤器链 (隐式参数、监控)
// 4. DubboInvoker.invoke()       → 发起远程调用
// 5. ExchangeClient.send()       → 编码 + 发送
// 6. Netty Channel.write()       → 网络传输

// Provider 端接收:
// 1. Netty Handler.channelRead() → 接收字节流
// 2. Decoder.decode()            → 解码请求
// 3. Filter.invoke()             → 执行过滤器链
// 4. JavassistProxy.invoke()     → 反射调用真实实现
// 5. Response.write()            → 编码 + 发送响应
```

### 8.5.3 gRPC 设计哲学

gRPC 采用"以 Protocol Buffers 为中心"的设计，强调跨语言和 HTTP/2 的能力：

```protobuf
// user.proto - 接口定义 (IDL)
syntax = "proto3";
package example;

service UserService {
    rpc GetUser (GetUserRequest) returns (User);
    rpc ListUsers (ListUsersRequest) returns (stream User);  // 服务端流
    rpc UploadAvatar (stream AvatarChunk) returns (Result);   // 客户端流
    rpc Chat (stream ChatMessage) returns (stream ChatMessage); // 双向流
}

message GetUserRequest {
    int64 id = 1;
}

message User {
    int64 id = 1;
    string name = 2;
    int32 age = 3;
}
```

```java
// 服务端实现 (自动生成的基类)
public class UserServiceImpl extends UserServiceGrpc.UserServiceImplBase {

    @Override
    public void getUser(GetUserRequest request,
                        StreamObserver<User> responseObserver) {
        User user = User.newBuilder()
                .setId(request.getId())
                .setName("张三")
                .setAge(30)
                .build();
        responseObserver.onNext(user);
        responseObserver.onCompleted();
    }
}

// 客户端调用 (自动生成的 Stub)
ManagedChannel channel = ManagedChannelBuilder
        .forAddress("localhost", 9090)
        .usePlaintext()
        .build();

UserServiceGrpc.UserServiceBlockingStub stub =
        UserServiceGrpc.newBlockingStub(channel);

GetUserRequest request = GetUserRequest.newBuilder()
        .setId(1L)
        .build();
User user = stub.getUser(request);
```

### 8.5.4 gRPC 四种通信模式

gRPC 基于 HTTP/2 的多路复用能力，支持四种通信模式，这是它相对于传统 HTTP REST 的核心优势：

```
1. Unary (一元调用) — 最常见，类似 HTTP 请求-响应
   Client ──── request ────▶ Server
   Client ◀──── response ──── Server

2. Server Streaming (服务端流) — 一次请求，多次响应
   Client ──── request ────▶ Server
   Client ◀──── stream ───── Server
   Client ◀──── stream ───── Server
   Client ◀──── stream ───── Server
   (适用: 实时数据推送、大文件下载)

3. Client Streaming (客户端流) — 多次请求，一次响应
   Client ──── stream ─────▶ Server
   Client ──── stream ─────▶ Server
   Client ──── stream ─────▶ Server
   Client ◀──── response ──── Server
   (适用: 文件上传、批量数据提交)

4. Bidirectional Streaming (双向流) — 多次请求，多次响应
   Client ──── stream ─────▶ Server
   Client ◀──── stream ───── Server
   Client ──── stream ─────▶ Server
   Client ◀──── stream ───── Server
   (适用: 实时聊天、协同编辑)
```

### 8.5.5 选型决策树

```
你的场景是什么?
│
├── Java 微服务 (内部)
│   ├── 需要完整服务治理 (路由/限流/熔断)? → Dubbo
│   └── 简单调用, 不需要治理? → gRPC
│
├── 跨语言服务
│   ├── 需要流式通信? → gRPC
│   └── 简单请求-响应? → gRPC 或 Thrift
│
├── 云原生环境 (Kubernetes)
│   └── 推荐 gRPC (与 Envoy/Istio 集成好)
│
└── 遗留系统集成
    └── HTTP REST (兼容性最好)
```

---

> **纵横联系**
>
> - **与第6章（HTTP 协议）的纵向联系**：gRPC 基于 HTTP/2 协议，利用了多路复用（Multiplexing）和头部压缩（HPACK）等特性。RPC 框架的自定义协议（如 Dubbo 协议）则可以看作是对 HTTP 协议的"简化替代"——去掉不需要的 HTTP 头，换取更小的包体和更快的解析。
> - **与第7章（Servlet/Spring MVC）的横向联系**：Spring MVC 处理南北向流量（外部 → 服务），RPC 处理东西向流量（服务 ↔ 服务）。两者共享相同的底层网络基础设施（Socket、线程池、序列化），但上层抽象不同。
> - **与第3章（序列化与编解码）的纵向联系**：本章的序列化机制是第3章原理的工程应用。Protobuf 的 Varint 编码、Hessian 的类型标记，都是在"编码效率"和"跨语言兼容"之间做取舍。
> - **与第9章（消息队列）的横向联系**：RPC 是同步调用（调用方等待响应），消息队列是异步通信（发送后不等待）。两者是微服务通信的两种互补模式：RPC 适合实时性要求高的场景，消息队列适合解耦和削峰。
