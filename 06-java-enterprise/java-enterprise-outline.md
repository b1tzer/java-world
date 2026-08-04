# 第六卷 Java 企业架构 —— 如何把底层能力组合成企业级系统

> 前五卷构建了语言、运行时、并发、网络、数据访问的完整底层认知。第六卷回答：如何利用 Spring 生态把这些能力**组合**成可设计、可启动、可组织、可扩展、可治理的企业级系统。本卷不是 Spring 框架教程，而是以 Spring 为媒介，讲清楚企业应用的运行模型。共 9 章。

---

## 1 企业开发演进与 Spring 核心思想

本章目标：合并原"企业演进"和"Spring IoC"两章。理解从单机到企业系统的变化驱动力，以及 IoC 如何解决对象管理的根本问题。

### 1.1 从单体到企业系统

变化的核心驱动力：用户量增长 → 数据量增长 → 业务复杂度增长 → 必须拆分与协作。

| 维度 | 单机程序 | 企业系统 |
|------|---------|---------|
| 对象管理 | 自己 `new` | 容器统一管理 |
| 事务 | 不涉及 | ACID、分布式事务 |
| 安全 | 无 | 认证、授权、加密 |
| 部署 | 单个 jar | 多实例、容器化 |

### 1.2 从 Java EE 到 Spring

EJB 时代：重量级、强侵入、难测试。Spring 的胜利：POJO + DI + 灵活扩展。Spring Boot：约定优于配置。Spring Cloud：微服务治理标准化。

### 1.3 为什么需要 IoC

```java
// 传统：强耦合，难测试，难替换
public class OrderService {
    private OrderRepository repo = new OrderRepositoryImpl();
}
```

IoC 的核心反转：对象的创建权从使用者转移到容器。

### 1.4 Bean 的本质与生命周期

Bean 不是普通 Java 对象，而是被 Spring 容器管理的对象。完整生命周期：

```
BeanDefinition 注册 → 实例化 → 属性赋值 → Aware 回调
→ BeanPostProcessor.before → @PostConstruct
→ BeanPostProcessor.after → Bean 就绪
→ @PreDestroy → 销毁
```

### 1.5 ApplicationContext vs BeanFactory

| | BeanFactory | ApplicationContext |
|---|---|---|
| 定位 | 底层 IoC 容器 | 高级容器（继承 BeanFactory） |
| 能力 | Bean 的创建与管理 | + AOP、事件、国际化 |
| 加载方式 | 延迟加载 | 预加载（默认） |

### 1.6 依赖注入方式

| 注入方式 | 推荐度 | 说明 |
|---------|--------|------|
| 构造器注入 | ⭐ 首选 | 强制依赖、不可变、利于测试 |
| Setter 注入 | 次选 | 可选依赖 |
| 字段注入 | ❌ 不推荐 | 不利于测试 |

---

## 2 Spring 容器机制与 AOP

本章目标：合并原"容器源码"和"AOP"两章。理解 Bean 如何被定义和创建，以及 AOP 如何用代理实现横切关注点的统一管理。

### 2.1 Spring 启动流程

```
ApplicationContext 启动
  → BeanDefinition 扫描与注册
  → BeanFactoryPostProcessor（${} 占位符替换等）
  → Bean 实例化（反射）
  → 依赖注入
  → 初始化（@PostConstruct → afterPropertiesSet → init-method）
```

### 2.2 BeanDefinition：Bean 的"身份证"

Spring 不直接保存对象，而是保存对象的**定义**：beanClassName、scope、lazyInit、dependsOn、propertyValues 等。

### 2.3 循环依赖与三级缓存

A 依赖 B，B 依赖 A：

```
A 创建中 → 提前暴露 A 的工厂到三级缓存
  → 发现依赖 B → 创建 B
  → B 发现依赖 A → 从三级缓存获取 A 的早期引用
  → B 完成 → A 完成
```

三级缓存：`singletonObjects`（完整 Bean）→ `earlySingletonObjects`（早期引用）→ `singletonFactories`（工厂）。

注意：构造器注入的循环依赖无法解决。

### 2.4 AOP 核心概念

| 概念 | 含义 |
|------|------|
| 切面（Aspect） | 横切关注点的模块化 |
| 切入点（Pointcut） | 匹配连接点的表达式 |
| 通知（Advice） | `@Before`、`@After`、`@Around` |
| 织入（Weaving） | 将切面应用到目标对象 |

### 2.5 动态代理：AOP 的底层实现

| | JDK 动态代理 | CGLIB |
|---|---|---|
| 代理方式 | 基于接口 | 基于继承（子类） |
| 要求 | 目标类必须实现接口 | 不能代理 `final` 类和方法 |
| Spring 默认 | 有接口时优先 | 无接口时使用（Boot 2.0+ 默认 CGLIB） |

### 2.6 AOP 的边界

- 自调用失效：类内部方法调用不走代理
- 非 public 方法无效：代理无法拦截
- 不是所有问题都适合 AOP：过度使用降低可读性

---

## 3 Spring MVC

本章目标：连接第四卷网络知识——一个 HTTP 请求如何从 Tomcat 进入 Spring MVC 的 DispatcherServlet，最终到达 Controller。

### 3.1 Servlet 到 Spring MVC

```
HTTP Request → Tomcat Connector → Servlet Container → Filter Chain
  → DispatcherServlet → Controller
```

Spring MVC 不替代 Servlet，而是建立在 Servlet 之上的抽象。

### 3.2 DispatcherServlet 核心流程

```
Request → DispatcherServlet
  → HandlerMapping（找 Controller）
  → HandlerAdapter（调用方法，参数解析）
  → Controller（业务处理）
  → ViewResolver / @ResponseBody（返回 JSON）
  → Response
```

### 3.3 参数解析与返回值处理

- `@RequestParam`、`@RequestBody`、`@PathVariable` 背后是 `HandlerMethodArgumentResolver`
- `@ResponseBody` 背后是 `HttpMessageConverter` 自动序列化为 JSON

### 3.4 异常处理

- `@ExceptionHandler`：Controller 级别
- `@ControllerAdvice`：全局异常处理
- 原理：`HandlerExceptionResolver` 在调用链中捕获异常

---

## 4 Spring Boot

本章目标：理解 Spring Boot 不是新框架，而是让 Spring 更好用的启动器。核心在于自动配置和 Starter 机制。

### 4.1 为什么需要 Spring Boot

| 传统 Spring | Spring Boot |
|------------|-------------|
| 大量 XML 配置 | 零 XML |
| 手动管理依赖版本 | Starter 一站式引入 |
| 手动配置 Tomcat | 内嵌 Tomcat，`java -jar` 直接运行 |

### 4.2 自动配置原理

1. `spring-boot-autoconfigure.jar` 的 `AutoConfiguration.imports` 注册所有配置类
2. `@ConditionalOnClass`：classpath 有对应类才生效
3. `@ConditionalOnMissingBean`：用户自定义了 Bean 则退让
4. `@EnableConfigurationProperties`：将 `application.yml` 映射到 Java 对象

### 4.3 Starter 机制

一个 Starter = 依赖集合 + 自动配置类：

- `spring-boot-starter-web` = Spring MVC + 内嵌 Tomcat + Jackson
- `mybatis-spring-boot-starter` = MyBatis + 自动配置

### 4.4 配置体系

- `application.yml`：环境特定配置
- `@ConfigurationProperties`：类型安全的配置绑定
- Profile：dev / test / prod 环境切换

---

## 5 Spring 整合数据访问

本章目标：连接第五卷——第五卷讲清了 MyBatis/Hibernate 本身。本章的独特视角是：**Spring 如何把这些框架"装配"进 IoC 容器**。

### 5.1 核心问题

| 问题 | 独立 MyBatis | Spring 整合后 |
|------|-------------|--------------|
| Mapper 谁创建？ | 手动 `getMapper()` | IoC 容器自动注入 |
| SqlSession 谁管理？ | 手动 `open/close` | Spring 管理生命周期 |
| 事务谁协调？ | 自管 `commit/rollback` | 与 `@Transactional` 联动 |

### 5.2 @MapperScan 原理

```
@MapperScan → ClassPathMapperScanner → 为每个 Mapper 生成 MapperFactoryBean 的 BeanDefinition
  → Spring 初始化时调用 MapperFactoryBean.getObject() → 返回 JDK 动态代理
```

利用了 Spring 的 `ImportBeanDefinitionRegistrar` 扩展点。

### 5.3 SqlSessionTemplate：线程安全 + 事务联动

| | DefaultSqlSession | SqlSessionTemplate |
|---|---|---|
| 线程安全 | ❌ | ✅（ThreadLocal + 动态代理） |
| 事务感知 | ❌ | ✅（自动加入当前 Spring 事务） |
| 生命周期 | 手动 open/close | Spring 管理 |

### 5.4 一级缓存"失效"的真相

- 有事务时：同一事务内复用 SqlSession → 一级缓存生效
- 无事务时：每次查询创建新 SqlSession → 一级缓存"看起来失效"

不是 bug，是 Spring 的设计选择：以方法为边界管理 SqlSession 生命周期。

---

## 6 微服务架构

本章目标：微服务不是"拆得越细越好"，而是按业务边界将单体拆分为可独立部署的服务。

### 6.1 为什么需要微服务

| 问题 | 表现 |
|------|------|
| 部署耦合 | 改一行代码要重新部署整个应用 |
| 扩展困难 | 只能整体扩展，无法只扩展瓶颈模块 |
| 团队协作冲突 | 多个团队改同一代码库 |

### 6.2 服务注册与发现

```
Provider 注册 → Service Registry（Nacos / Eureka）
Consumer 订阅 → 获取地址列表 → 负载均衡 → 调用
```

### 6.3 API Gateway

路由转发、统一鉴权、请求限流、日志收集、跨域处理。

### 6.4 服务调用

| 方案 | 协议 | 适用场景 |
|------|------|---------|
| OpenFeign | HTTP + JSON | RESTful，易调试 |
| Dubbo | 自定义 RPC | Java 生态微服务，高性能 |
| gRPC | HTTP/2 + Protobuf | 跨语言、高性能 |

---

## 7 分布式系统治理

本章目标：微服务拆开了，必须能"管得住"。

### 7.1 配置中心

配置集中管理 + 动态刷新。Nacos Config + `@RefreshScope` 热更新。

### 7.2 服务容错

| 策略 | 含义 |
|------|------|
| 超时 | 避免无限等待 |
| 重试 | 应对临时故障，需保证幂等 |
| 熔断 | 错误率达阈值时快速失败 |

### 7.3 限流与降级

Sentinel：流量控制、熔断降级、热点参数限流、系统自适应保护。

### 7.4 分布式链路追踪

```
Request → Service A (TraceID) → Service B (Span) → Service C (Span)
```

SkyWalking：通过 Java Agent 字节码增强实现无侵入追踪。

---

## 8 企业系统安全与部署

本章目标：合并原"安全"和"部署"两章。

### 8.1 身份认证

| 方案 | 原理 | 适用场景 |
|------|------|---------|
| Session-Cookie | 服务端存 Session | 传统 Web |
| JWT | 无状态令牌 | 微服务、移动端 |
| OAuth 2.0 | 第三方授权 | 社交登录、开放平台 |

### 8.2 Spring Security 核心

```
Filter Chain → AuthenticationFilter → AuthenticationManager
  → SecurityContextHolder（ThreadLocal）→ AuthorizationFilter
```

### 8.3 权限模型

RBAC（基于角色）：用户 → 角色（admin/editor）→ 权限。

### 8.4 数据安全

传输加密（HTTPS）、存储加密、日志脱敏、操作审计。

### 8.5 Docker 容器化

```dockerfile
FROM openjdk:17-jdk-slim
COPY target/app.jar app.jar
ENTRYPOINT ["java", "-jar", "/app.jar"]
```

价值：环境一致、快速部署、资源隔离。

### 8.6 Kubernetes 基础

| 概念 | 职责 |
|------|------|
| Pod | 最小调度单元 |
| Deployment | 声明副本数、滚动更新 |
| Service | 稳定访问入口 + 负载均衡 |
| ConfigMap / Secret | 配置与代码分离 |

### 8.7 多环境配置

```
dev → test → staging → prod
```

通过 `spring.profiles.active` 切换，每个环境独立的数据库、Redis、日志级别配置。

---

## 9 可观测性

本章目标：建立"出了问题能快速定位"的系统能力。日志、指标、链路追踪构成可观测性的完整拼图。

### 9.1 日志体系

```
Logback / Log4j2 → Filebeat → Elasticsearch → Kibana
```

关键实践：每个请求带 TraceID，日志中打印，实现日志与链路的关联。

### 9.2 指标监控

```
Micrometer（采集）→ Prometheus（存储）→ Grafana（可视化）
```

### 9.3 链路追踪

```
OpenTelemetry → Collector → Jaeger / SkyWalking
```

自动埋点 + 手动埋点，覆盖关键业务逻辑。

### 9.4 线上问题定位方法论

| 场景 | 路径 |
|------|------|
| 接口变慢 | Metrics 发现 RT 增长 → Tracing 定位慢在哪个服务 → Logging 看具体错误 |
| 偶发 500 | Tracing 按状态码过滤 → 找到错误 Span → Logging 关联 TraceID |
| 内存泄漏 | Metrics 监控 JVM Heap → 超出阈值触发 Dump → MAT 分析（连接第二卷） |

---

> 第六卷从原来的 12 章压缩为 9 章。合并了企业演进+IoC思想、容器源码+AOP、安全+部署，保持了从底层到治理到工程实践的完整覆盖。
>
> **与全书其他卷的纵横联系：**
>
> | 依赖方向 | 依赖内容 |
> |---------|---------|
> | ← 第二卷 | 反射是 AOP 和 IoC 的基础；字节码操作是 CGLIB 的基础 |
> | ← 第三卷 | `@Async` 线程池、Spring Security 的 ThreadLocal 上下文传递 |
> | ← 第四卷 | Spring MVC 建立在 Servlet 网络模型之上 |
> | ← 第五卷 | `@Transactional` 的 AOP 实现、MyBatis 整合 |
> | → 第七卷 | 微服务架构是 DDD 和高可用设计的落地载体 |
