# 第一章 企业开发演进与 Spring 核心思想

> 理解从单机到企业系统的变化驱动力，以及 IoC 如何解决对象管理的根本问题。

---

## 1.1 从单体到企业系统

企业系统不同于单机程序的核心区别：

| 维度 | 单机程序 | 企业系统 |
|------|---------|---------|
| 对象管理 | 自己 `new` | 容器统一管理 |
| 事务 | 不涉及 | ACID、分布式事务 |
| 安全 | 无 | 认证、授权、加密 |
| 部署 | 单个 jar | 多实例、容器化 |

变化驱动力：用户量增长 → 数据量增长 → 业务复杂度增长 → 必须拆分与协作。

## 1.2 从 Java EE 到 Spring

**EJB 时代**：重量级、强侵入、难测试、难部署。一个简单的 Hello World 需要实现一堆接口、写一堆 XML。

**Spring 的胜利**：
- POJO —— 不依赖特定框架 API
- DI —— 让对象管理从"硬编码"变成"可配置"
- 灵活扩展 —— 组件化，按需使用

Spring Boot 进一步简化：约定优于配置，`java -jar` 直接运行。Spring Cloud 将微服务治理能力标准化。

## 1.3 为什么需要 IoC

```java
// 传统代码：强耦合
public class OrderService {
    private OrderRepository repo = new OrderRepositoryImpl(); // 直接 new
}
```

问题：
- **强耦合**：OrderService 必须知道 OrderRepositoryImpl 的存在
- **难测试**：无法 Mock 依赖
- **难替换**：换实现就要改代码

IoC（控制反转）的核心：对象的创建权从使用者转移到容器。

| | 传统 | IoC |
|---|---|---|
| 谁创建 | 我 `new` | 容器创建 |
| 谁管理 | 我持有引用 | 容器管理生命周期 |
| 谁组装 | 我手动设置 | 容器自动注入 |

## 1.4 Bean 的本质与生命周期

Bean 不是普通 Java 对象，而是**被 Spring 容器管理的对象**。

完整生命周期：

```
BeanDefinition 注册
  → 实例化（反射调用构造方法）
  → 属性赋值（依赖注入）
  → Aware 接口回调（BeanNameAware → BeanFactoryAware → ApplicationContextAware）
  → BeanPostProcessor.postProcessBeforeInitialization()
  → @PostConstruct / InitializingBean.afterPropertiesSet()
  → BeanPostProcessor.postProcessAfterInitialization()
  → Bean 就绪
  → @PreDestroy / DisposableBean.destroy()
  → 销毁
```

`BeanPostProcessor` 是 Spring 最重要的扩展机制——AOP 代理、`@Autowired` 注入、`@Transactional` 处理都是通过它实现的。

## 1.5 依赖注入方式

| 注入方式 | 推荐度 | 说明 |
|---------|--------|------|
| 构造器注入 | ⭐ 首选 | 强制依赖、不可变、利于测试 |
| Setter 注入 | 次选 | 可选依赖 |
| 字段注入 | ❌ | `@Autowired` 直接标注字段，不利于测试 |

```java
// ✅ 构造器注入（推荐）
@Service
public class OrderService {
    private final OrderRepository repository;

    public OrderService(OrderRepository repository) {
        this.repository = repository;  // 不可变，必须注入
    }
}
```

---

# 第二章 Spring 容器机制与 AOP

> 理解 Bean 如何被定义和创建，以及 AOP 如何用代理实现横切关注点的统一管理。

---

## 2.1 Spring 启动流程

```
ApplicationContext 启动
  → BeanDefinition 扫描与注册（扫描 @Component/@Service 等）
  → BeanFactoryPostProcessor（${} 占位符替换等）
  → Bean 实例化（反射）
  → 依赖注入（@Autowired、@Value）
  → 初始化（@PostConstruct → afterPropertiesSet → init-method）
```

## 2.2 BeanDefinition

Spring 不直接保存对象，而是保存对象的**定义**：beanClassName、scope（singleton/prototype）、lazyInit、dependsOn、propertyValues 等。

为什么要这样？因为同一个类可能需要创建多个不同配置的 Bean（不同参数、不同作用域）。BeanDefinition 是"模板"，Bean 是"实例"。

## 2.3 循环依赖与三级缓存

A 依赖 B，B 依赖 A：

```
A 创建中 → 提前暴露 A 的工厂到三级缓存
  → 发现依赖 B → 创建 B
  → B 发现依赖 A → 从三级缓存获取 A 的早期引用
  → B 完成 → A 完成
```

三级缓存：

| 缓存 | 内容 |
|------|------|
| 一级 `singletonObjects` | 完全初始化好的 Bean |
| 二级 `earlySingletonObjects` | 提前暴露的 Bean（未完全初始化） |
| 三级 `singletonFactories` | Bean 的工厂 |

注意：**构造器注入的循环依赖无法解决**——构造器执行时连三级缓存都来不及暴露。

## 2.4 AOP 核心概念

| 概念 | 含义 |
|------|------|
| 切面（Aspect） | 横切关注点的模块化（如事务管理） |
| 切入点（Pointcut） | 匹配连接点的表达式 |
| 通知（Advice） | @Before、@After、@Around |
| 织入（Weaving） | 将切面应用到目标对象 |

## 2.5 动态代理

| | JDK 动态代理 | CGLIB |
|---|---|---|
| 代理方式 | 基于接口 | 基于继承 |
| 要求 | 目标类必须实现接口 | 不能代理 final 类 |
| Spring 默认 | 有接口时优先 | Boot 2.0+ 默认 CGLIB |

AOP 的实现流程：

```
原始 Bean → BeanPostProcessor 检查是否有切面匹配
  → 有？创建代理（JDK Proxy 或 CGLIB）
  → 调用时：Proxy → Interceptor Chain → Target Method
```

## 2.6 AOP 的边界

- **自调用失效**：`this.method()` 不走代理，切面不生效
- **非 public 方法无效**：代理无法拦截
- 不是所有问题都适合 AOP：过度使用降低可读性

---

# 第三章 Spring MVC

> 一个 HTTP 请求如何从 Tomcat 进入 Spring MVC 的 DispatcherServlet，最终到达 Controller。

---

## 3.1 Servlet 到 Spring MVC

```
HTTP Request → Tomcat Connector → Servlet Container → Filter Chain
  → DispatcherServlet → Controller
```

Spring MVC 不替代 Servlet，而是建立在 Servlet 之上的抽象。

## 3.2 DispatcherServlet 核心流程

```
Request → DispatcherServlet
  → HandlerMapping（根据 URL 找 Controller 方法）
  → HandlerAdapter（调用方法，参数解析）
  → Controller（业务处理）
  → HttpMessageConverter（@ResponseBody → JSON 序列化）
  → Response
```

## 3.3 参数解析

`@RequestParam`、`@RequestBody`、`@PathVariable` 背后是 `HandlerMethodArgumentResolver`：

```java
@GetMapping("/users/{id}")
public User getUser(@PathVariable Long id,      // PathVariableMethodArgumentResolver
                    @RequestParam String type) { // RequestParamMethodArgumentResolver
    return userService.findById(id);
}

@PostMapping("/users")
public User createUser(@RequestBody UserDTO dto) { // RequestResponseBodyMethodProcessor
    return userService.create(dto);
}
```

## 3.4 异常处理

```java
// Controller 级别
@ExceptionHandler(UserNotFoundException.class)
public ResponseEntity<String> handleNotFound(UserNotFoundException e) {
    return ResponseEntity.notFound().build();
}

// 全局级别
@ControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Error> handleAll(Exception e) {
        return ResponseEntity.status(500).body(new Error(e.getMessage()));
    }
}
```

---

# 第四章 Spring Boot

> Spring Boot 不是新框架，而是让 Spring 更好用的启动器。核心在于自动配置和 Starter 机制。

---

## 4.1 自动配置原理

```java
@SpringBootApplication  // = @SpringBootConfiguration + @EnableAutoConfiguration + @ComponentScan
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

`@EnableAutoConfiguration` 的工作流程：

1. 读取 `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`
2. 对每个配置类检查条件注解：
   - `@ConditionalOnClass`：classpath 有对应类才生效
   - `@ConditionalOnMissingBean`：用户自定义了 Bean 则退让
3. 生效的配置类注册 BeanDefinition

## 4.2 Starter 机制

一个 Starter = 依赖集合 + 自动配置类：

- `spring-boot-starter-web` = Spring MVC + 内嵌 Tomcat + Jackson
- `mybatis-spring-boot-starter` = MyBatis + SqlSessionFactory + 自动扫描 Mapper

开发者只需引入 Starter，零配置即可使用。

## 4.3 配置体系

```yaml
# application.yml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/mydb
    username: root
  profiles:
    active: dev
```

- `@ConfigurationProperties`：类型安全的配置绑定
- Profile：`application-dev.yml` / `application-prod.yml` 环境切换

---

# 第五章 Spring 整合数据访问

> 第五卷讲清了 MyBatis 本身。本章视角：Spring 如何把 MyBatis "装配"进 IoC 容器。

---

## 5.1 核心问题

| 问题 | 独立 MyBatis | Spring 整合后 |
|------|-------------|--------------|
| Mapper 谁创建？ | 手动 `getMapper()` | IoC 容器自动注入 |
| SqlSession 谁管理？ | 手动 open/close | Spring 管理 |
| 事务谁协调？ | 自管 commit/rollback | @Transactional 联动 |

## 5.2 @MapperScan 原理

```
@MapperScan("com.example.mapper")
  → ClassPathMapperScanner
  → 为每个 Mapper 接口生成 MapperFactoryBean 的 BeanDefinition
  → Spring 初始化时调用 MapperFactoryBean.getObject()
  → 返回 JDK 动态代理（MapperProxy）
```

## 5.3 SqlSessionTemplate

Spring 不用原始的 `DefaultSqlSession`，而是用 `SqlSessionTemplate`：

- **线程安全**：内部用动态代理，每次调用检查当前事务
- **事务感知**：有活跃事务时复用同一 SqlSession，无事务时方法结束即关闭

## 5.4 一级缓存"失效"的真相

- **有事务时**：同一事务内复用 SqlSession → 一级缓存生效
- **无事务时**：每次查询创建新 SqlSession → 一级缓存"看起来失效"

不是 bug，是 Spring 的设计选择：以方法为边界管理 SqlSession 生命周期，保证线程安全。

---

# 第六章 微服务架构

> 微服务不是"拆得越细越好"，而是按业务边界将单体拆分为可独立部署的服务。

---

## 6.1 为什么需要微服务

| 问题 | 表现 |
|------|------|
| 部署耦合 | 改一行代码要重新部署整个应用 |
| 扩展困难 | 只能整体扩展，无法只扩展瓶颈模块 |
| 团队协作冲突 | 多个团队改同一代码库 |

## 6.2 服务注册与发现

```
Provider 注册 → Nacos / Eureka
Consumer 订阅 → 获取地址列表 → 负载均衡 → 调用
```

## 6.3 API Gateway

路由转发、统一鉴权、请求限流、日志收集、跨域处理。

## 6.4 服务调用

| 方案 | 协议 | 适用场景 |
|------|------|---------|
| OpenFeign | HTTP + JSON | RESTful，易调试 |
| Dubbo | 自定义 RPC | Java 生态，高性能 |
| gRPC | HTTP/2 + Protobuf | 跨语言，高性能 |

---

# 第七章 分布式系统治理

> 微服务拆开了，必须能"管得住"。

---

## 7.1 配置中心

Nacos Config + `@RefreshScope`：配置变更后自动通知应用，热更新。

## 7.2 服务容错

| 策略 | 含义 |
|------|------|
| 超时 | 避免无限等待 |
| 重试 | 应对临时故障（需保证幂等） |
| 熔断 | 错误率达阈值时快速失败 |

## 7.3 限流与降级

Sentinel：流量控制、熔断降级、热点参数限流。

## 7.4 分布式链路追踪

```
Request → Service A (TraceID: abc) → Service B (Span) → Service C (Span)
```

SkyWalking 通过 Java Agent 字节码增强实现无侵入追踪。

---

# 第八章 企业系统安全与部署

---

## 8.1 身份认证

| 方案 | 适用场景 |
|------|---------|
| Session-Cookie | 传统 Web |
| JWT | 微服务、移动端 |
| OAuth 2.0 | 社交登录、开放平台 |

## 8.2 Spring Security 核心

```
Filter Chain → AuthenticationFilter → AuthenticationManager
  → SecurityContextHolder（ThreadLocal）→ AuthorizationFilter
```

## 8.3 Docker 容器化

```dockerfile
FROM openjdk:17-jdk-slim
COPY target/app.jar app.jar
ENTRYPOINT ["java", "-jar", "/app.jar"]
```

## 8.4 Kubernetes 基础

Pod（最小部署单元）、Deployment（副本管理）、Service（负载均衡）、ConfigMap（配置管理）。

---

# 第九章 可观测性

---

## 9.1 日志体系

Logback → Filebeat → Elasticsearch → Kibana。关键：每个请求带 TraceID。

## 9.2 指标监控

Micrometer → Prometheus → Grafana。

## 9.3 链路追踪

OpenTelemetry → Collector → Jaeger / SkyWalking。

## 9.4 线上问题定位

| 场景 | 路径 |
|------|------|
| 接口变慢 | Metrics → Tracing → Logging |
| 偶发 500 | Tracing 按状态码过滤 → Logging 关联 TraceID |
| 内存泄漏 | Metrics 监控 Heap → Dump → MAT 分析 |

---

> 第六卷到此结束。从 IoC/AOP/MVC/Boot → ORM 整合 → 微服务 → 治理 → 安全 → 部署 → 可观测性，读者已建立起将底层能力组合为企业级系统的完整认知。
