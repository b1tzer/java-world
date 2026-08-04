# 第7章 Java Web 通信模型：Servlet 到 Spring MVC

> 当你在浏览器中输入一个 URL 并按下回车，到服务器返回一个 JSON 响应，这中间究竟发生了什么？一个 HTTP 请求如何穿越操作系统的 Socket、Tomcat 的线程池、Spring 的 DispatcherServlet，最终抵达你用 `@GetMapping` 标注的那一行代码？本章将从最底层的 Servlet 规范出发，逐层拆解 Java Web 通信的完整链路。

## 7.1 Servlet 网络模型

Servlet 是 Java Web 世界的基石。在理解 Spring Boot 之前，必须先理解 Servlet 规范定义的请求处理模型。

### 7.1.1 请求处理的完整链路

一个 HTTP 请求从网络到达 Java 应用，需要经过以下路径：

```
┌─────────────────────────────────────────────────────────────────┐
│                        客户端 (Browser/App)                      │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP Request
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  OS: Socket 接收 → TCP 三次握手 → 读取字节流                      │
└──────────────────────────────┬───────────────────────────────────┘
                               │ 原始字节流
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  Connector (Tomcat 连接器)                                       │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │ Endpoint  │→│ Protocol      │→│ CoyoteAdapter             │   │
│  │ (Socket)  │  │ Handler(HTTP) │  │ (适配器: 封装Request)     │   │
│  └──────────┘  └──────────────┘  └──────────────────────────┘   │
└──────────────────────────────┬───────────────────────────────────┘
                               │ org.apache.coyote.Request
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  Container (Tomcat 容器)                                         │
│  Engine → Host → Context → Wrapper                               │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Servlet.service(HttpServletRequest, HttpServletResponse) │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬───────────────────────────────────┘
                               │ Response 字节流
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  Connector: 将 Response 写回 Socket → OS → 网络                  │
└──────────────────────────────────────────────────────────────────┘
```

### 7.1.2 Servlet 的生命周期

Servlet 规范定义了明确的生命周期，理解它是理解 Web 容器行为的前提：

```java
public interface Servlet {
    void init(ServletConfig config) throws ServletException;  // 初始化一次
    void service(ServletRequest req, ServletResponse res)     // 每次请求调用
        throws ServletException, IOException;
    void destroy();                                            // 销毁时调用
}
```

| 阶段 | 触发时机 | 线程模型 | 典型操作 |
|------|---------|---------|---------|
| `init()` | 容器启动或首次请求 | 容器主线程 | 加载配置、初始化资源 |
| `service()` | 每次 HTTP 请求 | 容器工作线程 | 业务逻辑处理 |
| `destroy()` | 容器关闭 | 容器主线程 | 释放资源、关闭连接 |

**关键点**：`service()` 方法是线程不安全的——多个线程会并发调用同一个 Servlet 实例的 `service()` 方法。这就是为什么 Servlet 中不应使用实例变量存储请求状态。

### 7.1.3 HttpServlet 的分发机制

`HttpServlet` 对 `service()` 做了进一步分发，根据 HTTP 方法路由到不同的处理方法：

```java
public abstract class HttpServlet extends GenericServlet {

    @Override
    protected void service(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {

        String method = req.getMethod();

        switch (method) {
            case "GET":    doGet(req, resp);    break;
            case "POST":   doPost(req, resp);   break;
            case "PUT":    doPut(req, resp);    break;
            case "DELETE": doDelete(req, resp); break;
            // ... 其他 HTTP 方法
        }
    }
}
```

这个分发机制看似简单，却是后来所有 Web 框架 `@GetMapping`、`@PostMapping` 注解的原型。

## 7.2 Tomcat 网络架构

Tomcat 不仅仅是一个 Servlet 容器，它首先是一个网络服务器。理解 Tomcat 的架构，就是理解 HTTP 请求如何从操作系统进入 Java 世界。

### 7.2.1 两大核心模块

Tomcat 的架构可以简化为两个核心模块的协作：

```
┌─────────────────────────────────────────────────────────────┐
│                      Tomcat                                  │
│                                                              │
│  ┌─────────────────────┐    ┌────────────────────────────┐  │
│  │     Connector        │    │       Container             │  │
│  │                      │    │                              │  │
│  │  职责:               │    │  职责:                       │  │
│  │  - 监听端口          │───▶│  - 管理 Servlet 生命周期     │  │
│  │  - 解析 HTTP 协议     │    │  - 路由请求到对应 Servlet    │  │
│  │  - 管理连接          │    │  - 管理 Filter 链            │  │
│  │  - 线程调度          │    │  - 管理 Session              │  │
│  └─────────────────────┘    └────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Connector 负责"通信"**，**Container 负责"业务"**——这种关注点分离是 Tomcat 架构的核心智慧。

### 7.2.2 容器层级

Tomcat 的容器采用四层嵌套结构，每一层都有特定职责：

```
Server (整个 Tomcat 实例)
 └── Service (连接器 + 容器的组合)
      ├── Connector (HTTP/1.1, AJP)
      └── Engine (请求路由引擎)
           └── Host (虚拟主机, 如 localhost)
                └── Context (Web 应用, 如 /myapp)
                     └── Wrapper (单个 Servlet 的包装)
```

| 层级 | 对应概念 | 核心职责 |
|------|---------|---------|
| Server | Tomcat 进程 | 管理全局生命周期 |
| Service | 逻辑分组 | 将 Connector 与 Engine 绑定 |
| Engine | 请求路由 | 根据 Host 头分发到虚拟主机 |
| Host | 虚拟主机 | 根据 URL 路径分发到 Web 应用 |
| Context | Web 应用 | 管理 Filter 链和 Servlet 映射 |
| Wrapper | Servlet 实例 | 管理单个 Servlet 的生命周期 |

请求在容器中的流转过程：

```java
// 简化的容器调用链
engine.invoke(request, response)
  → host.invoke(request, response)
    → context.invoke(request, response)
      → wrapper.invoke(request, response)
        → servlet.service(request, response)
```

### 7.2.3 Connector 的组成

一个 Connector 由三个核心组件构成：

```
┌────────────────────────────────────────────────────────┐
│                   Connector                             │
│                                                         │
│  ┌──────────────┐                                      │
│  │  Endpoint     │  负责监听端口、接受连接                │
│  │  (Socket层)   │  实现: NioEndpoint, Nio2Endpoint      │
│  └──────┬───────┘                                      │
│         │                                              │
│  ┌──────▼───────┐                                      │
│  │  Protocol     │  负责解析应用层协议                    │
│  │  Handler      │  实现: Http11Protocol, AjpProtocol    │
│  └──────┬───────┘                                      │
│         │                                              │
│  ┌──────▼───────┐                                      │
│  │  Adapter      │  将 Coyote Request 转换为             │
│  │               │  ServletRequest (HttpServletRequest)  │
│  └──────────────┘                                      │
└────────────────────────────────────────────────────────┘
```

## 7.3 Tomcat NIO 模型

Tomcat 从 8.5 开始默认使用 NIO（非阻塞 I/O），这是理解高性能 Java Web 服务器的关键。

### 7.3.1 BIO vs NIO 对比

在 Tomcat 7 及之前版本中，默认使用 BIO（阻塞 I/O）模型。两者的本质区别在于线程与连接的关系：

| 特性 | BIO (阻塞 I/O) | NIO (非阻塞 I/O) |
|------|----------------|-------------------|
| 线程/连接 | 1:1 | 1:N (通过 Selector 多路复用) |
| 读写阻塞 | 线程阻塞等待数据 | 线程只在数据就绪时处理 |
| 空闲连接 | 占用线程 | 不占用工作线程 |
| 最大并发 | 受限于线程数 (~几百) | 轻松支撑数千连接 |
| 实现复杂度 | 低 | 高 |

### 7.3.2 NioEndpoint 的三线程模型

Tomcat 的 NIO 实现核心是 `NioEndpoint`，它使用三个线程角色协作处理请求：

```
                         ┌──────────────────────┐
                         │   ServerSocketChannel │
                         │   (监听 8080 端口)     │
                         └──────────┬───────────┘
                                    │
                    ┌───────────────▼───────────────┐
                    │         Acceptor 线程           │
                    │  职责: 调用 accept() 接受新连接   │
                    │  将 SocketChannel 注册到 Poller  │
                    └───────────────┬───────────────┘
                                    │ 注册 OP_READ 事件
                    ┌───────────────▼───────────────┐
                    │         Poller 线程 (NIO核心)    │
                    │  职责: Selector.select() 轮询    │
                    │  检测就绪事件, 封装为 SocketProcessor│
                    └───────────────┬───────────────┘
                                    │ 提交到线程池
                    ┌───────────────▼───────────────┐
                    │      Worker 线程池 (Executor)    │
                    │  职责: 读取请求数据               │
                    │  调用 Handler 处理 HTTP 协议      │
                    │  执行 Servlet.service()         │
                    │  写回响应数据                     │
                    └───────────────────────────────┘
```

核心源码结构（简化）：

```java
public class NioEndpoint {

    // 1. Acceptor 线程: 接受连接
    public class Acceptor extends AbstractEndpoint.Acceptor {
        @Override
        public void run() {
            while (running) {
                SocketChannel socket = serverSock.accept();  // 阻塞等待连接
                socket.configureBlocking(false);             // 设置非阻塞
                getPoller().register(socket);                // 注册到 Poller
            }
        }
    }

    // 2. Poller 线程: 事件轮询
    public class Poller implements Runnable {
        private Selector selector;

        @Override
        public void run() {
            while (running) {
                int keyCount = selector.select(1000);  // 阻塞等待事件
                Iterator<SelectionKey> it = selector.selectedKeys().iterator();
                while (it.hasNext()) {
                    SelectionKey key = it.next();
                    if (key.isReadable()) {
                        // 数据就绪, 提交给 Worker 线程池处理
                        executor.execute(new SocketProcessor(key));
                    }
                }
            }
        }
    }

    // 3. Worker 线程: 实际处理请求
    public class SocketProcessor implements Runnable {
        @Override
        public void run() {
            // 从 Channel 读取数据
            // 解析 HTTP 请求
            // 调用 Servlet.service()
            // 将响应写回 Channel
        }
    }
}
```

### 7.3.3 线程池配置

Tomcat 的线程池是影响并发能力的关键参数：

```xml
<!-- server.xml 中的 Executor 配置 -->
<Executor name="tomcatThreadPool"
          namePrefix="catalina-exec-"
          maxThreads="200"          <!-- 最大工作线程数 -->
          minSpareThreads="10"      <!-- 最小空闲线程数 -->
          maxQueueSize="100"        <!-- 等待队列大小 -->
          prestartminSpareThreads="true" />

<Connector executor="tomcatThreadPool"
           port="8080"
           protocol="org.apache.coyote.http11.Http11NioProtocol"
           connectionTimeout="20000"
           maxConnections="10000"   <!-- NIO 最大连接数 -->
           acceptCount="100" />     <!-- accept 队列大小 -->
```

| 参数 | 含义 | 调优建议 |
|------|------|---------|
| `maxThreads` | 最大工作线程数 | CPU 密集型: CPU核数+1；IO密集型: CPU核数*2 |
| `maxConnections` | 最大同时处理连接数 | NIO 默认 10000，根据内存调整 |
| `acceptCount` | accept 队列满后的排队长度 | 通常设为 100，超出则拒绝连接 |
| `connectionTimeout` | 连接超时时间 | 根据业务场景，通常 20000-60000ms |

## 7.4 Spring MVC 请求流程

Spring MVC 在 Servlet 规范之上构建了一套灵活的请求处理框架。理解它的关键在于 `DispatcherServlet`——它是一个"前端控制器"，将所有请求集中分发。

### 7.4.1 DispatcherServlet 的本质

`DispatcherServlet` 本质上就是一个 `HttpServlet`：

```
                    ┌─────────────────────────────────┐
                    │      DispatcherServlet           │
                    │  (extends FrameworkServlet        │
                    │   extends HttpServletBean         │
                    │   extends HttpServlet)            │
                    │                                   │
                    │  web.xml 或 Servlet 注册:          │
                    │  url-pattern = "/"                │
                    └──────────────┬──────────────────┘
                                   │
                          拦截所有 HTTP 请求
                                   │
              ┌────────────────────▼────────────────────┐
              │          doDispatch(request, response)   │
              │                                          │
              │  1. 找到 Handler (哪个 Controller 方法)   │
              │  2. 找到 HandlerAdapter (如何调用)         │
              │  3. 执行拦截器 preHandle                  │
              │  4. 调用 Controller 方法                  │
              │  5. 处理返回值 (View/JSON/...)            │
              │  6. 执行拦截器 postHandle                 │
              │  7. 渲染视图 / 写响应                     │
              └─────────────────────────────────────────┘
```

### 7.4.2 完整请求处理流程

以下是一个请求从进入 `DispatcherServlet` 到返回响应的完整流程：

```
HTTP Request (GET /api/users/1)
│
▼
DispatcherServlet.doDispatch()
│
├─ 1. HandlerMapping 查找
│     ├── RequestMappingHandlerMapping
│     │     匹配: @GetMapping("/api/users/{id}")
│     │     返回: HandlerMethod(UserController.getUser)
│     └── BeanNameUrlHandlerMapping (旧式, 很少用)
│
├─ 2. HandlerInterceptor.preHandle()
│     ├── CorsInterceptor (跨域处理)
│     ├── AuthInterceptor (权限校验)
│     └── 自定义拦截器
│
├─ 3. HandlerAdapter 选择
│     └── RequestMappingHandlerAdapter
│           (支持 @RequestMapping 注解的方法)
│
├─ 4. HandlerAdapter.handle() → 调用 Controller 方法
│     ├── 参数解析 (HandlerMethodArgumentResolver)
│     │     ├── @PathVariable → id = 1
│     │     ├── @RequestParam → 从 Query String 提取
│     │     ├── @RequestBody → JSON 反序列化
│     │     └── HttpServletRequest → 原始请求对象
│     │
│     └── 执行: UserController.getUser(1)
│           → return User(id=1, name="张三")
│
├─ 5. 返回值处理 (HandlerMethodReturnValueHandler)
│     ├── @ResponseBody → HttpMessageConverter
│     │     └── MappingJackson2HttpMessageConverter
│     │           → 将 User 对象序列化为 JSON
│     │           → 写入 HttpServletResponse
│     └── 返回 ModelAndView → ViewResolver 渲染
│
├─ 6. HandlerInterceptor.postHandle()
│
└─ 7. 返回 HTTP Response
      HTTP/1.1 200 OK
      Content-Type: application/json
      {"id":1,"name":"张三"}
```

### 7.4.3 核心组件详解

Spring MVC 的所有组件都是可插拔的，理解每个组件的职责是掌握框架的关键：

```java
// DispatcherServlet 的核心调度逻辑 (简化)
protected void doDispatch(HttpServletRequest request,
                          HttpServletResponse response) throws Exception {

    // 1. 通过 HandlerMapping 找到对应的 Handler
    HandlerExecutionChain mappedHandler = getHandler(request);

    // 2. 找到能执行该 Handler 的 Adapter
    HandlerAdapter ha = getHandlerAdapter(mappedHandler.getHandler());

    // 3. 执行拦截器 preHandle (如果任一返回 false, 中断)
    if (!mappedHandler.applyPreHandle(request, response)) {
        return;
    }

    // 4. 通过 Adapter 执行真正的 Controller 方法
    ModelAndView mv = ha.handle(request, response,
                                mappedHandler.getHandler());

    // 5. 执行拦截器 postHandle
    mappedHandler.applyPostHandle(request, response, mv);

    // 6. 处理结果 (渲染视图或写响应)
    processDispatchResult(request, response, mappedHandler, mv);
}
```

| 组件 | 接口 | 职责 |
|------|------|------|
| HandlerMapping | `HandlerMapping` | URL → Handler 的映射关系 |
| HandlerAdapter | `HandlerAdapter` | 执行 Handler 并返回 ModelAndView |
| HandlerInterceptor | `HandlerInterceptor` | 请求前后的拦截处理 |
| ViewResolver | `ViewResolver` | 逻辑视图名 → View 对象 |
| MessageConverter | `HttpMessageConverter` | 请求/响应体的序列化与反序列化 |
| ArgumentResolver | `HandlerMethodArgumentResolver` | Controller 方法参数解析 |
| ReturnValueHandler | `HandlerMethodReturnValueHandler` | Controller 返回值处理 |

## 7.5 Web 框架如何隐藏网络复杂度

当你写下以下代码时，底层到底发生了什么？

```java
@RestController
@RequestMapping("/api/users")
public class UserController {

    @GetMapping("/{id}")
    public User getUser(@PathVariable Long id) {
        return userService.findById(id);
    }
}
```

### 7.5.1 从注解到网络的完整链路

这短短几行代码，背后隐藏着从 Socket 到 HTTP 的完整协议栈：

```
开发者视角:  @GetMapping("/{id}")  →  return user
                │
                │ (框架透明处理)
                ▼
┌─────────────────────────────────────────────────────────┐
│  层级 1: Socket 层                                       │
│  ├── TCP 连接管理 (三次握手/四次挥手)                      │
│  ├── 粘包/拆包处理 (HTTP 分隔符解析)                       │
│  ├── 连接池 (Keep-Alive 复用)                             │
│  └── SSL/TLS 握手 (HTTPS 场景)                           │
│                                                          │
│  层级 2: HTTP 协议层                                      │
│  ├── 请求行解析 (GET /api/users/1 HTTP/1.1)              │
│  ├── 请求头解析 (Content-Type, Accept, Cookie, ...)      │
│  ├── 请求体解析 (POST/PUT 的 Body)                        │
│  ├── Chunked Transfer 编码处理                            │
│  └── 响应状态码与头组装                                    │
│                                                          │
│  层级 3: Servlet 容器层                                   │
│  ├── URL → Servlet 映射                                  │
│  ├── Session 管理 (Cookie → JSESSIONID)                  │
│  ├── Filter 链执行 (CORS, 编码, 安全)                     │
│  └── HttpServletRequest/Response 封装                     │
│                                                          │
│  层级 4: Spring MVC 框架层                                │
│  ├── DispatcherServlet 请求分发                           │
│  ├── HandlerMapping 路由匹配                              │
│  ├── 参数解析 (@PathVariable, @RequestBody, ...)          │
│  ├── 参数校验 (@Valid)                                    │
│  ├── 业务逻辑执行 (Controller → Service → DAO)            │
│  ├── 返回值序列化 (Java Object → JSON)                    │
│  └── 响应写入 (HttpServletResponse.getOutputStream())     │
│                                                          │
│  层级 5: 序列化层                                         │
│  ├── Jackson JSON 序列化                                  │
│  ├── 日期格式化 (LocalDateTime → ISO-8601)                │
│  ├── 空值处理 (@JsonInclude)                              │
│  └── 自定义序列化器 (JsonSerializer)                       │
└─────────────────────────────────────────────────────────┘
                │
                │ (最终输出)
                ▼
HTTP/1.1 200 OK
Content-Type: application/json

{"id":1,"name":"张三","email":"zhangsan@example.com"}
```

### 7.5.2 连接管理的隐藏细节

HTTP Keep-Alive 是 Web 性能优化的基础，但开发者通常不需要关心：

```java
// 开发者只需要写:
@GetMapping("/{id}")
public User getUser(@PathVariable Long id) {
    return userService.findById(id);
}

// 框架在底层自动处理:
// 1. 检查 Connection: keep-alive 头
// 2. 复用已有的 TCP 连接 (避免三次握手开销)
// 3. 设置超时 (connectionTimeout=20000)
// 4. 限制最大请求数 (maxKeepAliveRequests=100)
// 5. 超时或达到上限后关闭连接 (四次挥手)
```

### 7.5.3 Spring Boot 自动配置的魔法

Spring Boot 通过自动配置，将 Tomcat 的初始化完全隐藏：

```java
// 你只需要一个注解
@SpringBootApplication
public class MyApplication {
    public static void main(String[] args) {
        SpringApplication.run(MyApplication.class, args);
    }
}

// Spring Boot 自动完成:
// 1. 创建 EmbeddedTomcat 实例
// 2. 配置 NioEndpoint (默认)
// 3. 注册 DispatcherServlet 到 Tomcat
// 4. 配置 HandlerMapping (扫描 @RequestMapping)
// 5. 配置 HandlerAdapter (支持注解方法)
// 6. 配置 MessageConverter (Jackson JSON)
// 7. 启动 Tomcat, 监听 8080 端口
```

### 7.5.4 抽象的价值与代价

| 维度 | 直接使用 Servlet | 使用 Spring MVC |
|------|-----------------|----------------|
| 代码量 | 手动解析参数、手动序列化 | 注解驱动，几行代码 |
| 灵活性 | 完全控制 | 受框架约定约束 |
| 学习成本 | 需理解 HTTP 协议细节 | 需理解框架机制 |
| 性能 | 可极致优化 | 有一定框架开销 |
| 可维护性 | 低 (代码分散) | 高 (约定统一) |

抽象的价值在于：**开发者专注于业务逻辑，框架负责网络通信**。但当出现性能问题或诡异 Bug 时，只有理解底层机制的人才能快速定位。

---

> **纵横联系**
>
> - **与第5章（I/O 模型）的纵向联系**：本章的 NioEndpoint 正是第5章 Java NIO Selector 的实际应用。Poller 线程中的 `selector.select()` 就是 I/O 多路复用的直接体现。
> - **与第6章（HTTP 协议）的纵向联系**：Connector 中的 ProtocolHandler 负责解析 HTTP 协议报文，这正是第6章 HTTP 协议规范在 Java 中的工程实现。
> - **与第8章（RPC 与微服务）的横向联系**：Spring MVC 处理的是外部 HTTP 请求（南北向流量），而 RPC 框架处理的是服务间调用（东西向流量）。两者底层都依赖 Socket 和序列化，但上层抽象截然不同。
> - **与第9章（WebSocket）的纵向联系**：Servlet 3.1 规范引入的非阻塞 I/O 和 WebSocket 支持，打破了本章描述的"请求-响应"模型，实现了服务端主动推送。
