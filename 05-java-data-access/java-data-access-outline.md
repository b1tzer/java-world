# 第五卷 Java 数据访问与持久化 —— 数据如何可靠、高效地存储与读取

> 前四卷解决了语言、运行时、并发和网络通信。第五卷回答：Java 对象如何持久化？如何保证数据的可靠性和一致性？如何在高并发下高效访问数据？核心链路是：**Java 对象 → ORM → SQL → 事务 → 数据库 → 缓存**。本卷从 JDBC 这一底层抽象出发，沿持久化映射 → ORM 框架 → 数据库原理 → 事务管理 → 缓存体系的路径，逐步展开 Java 数据访问的完整视图。重点不是框架 API，而是理解数据访问每一层的设计动机和它们之间的协作关系。

---

## 1 持久化思想：Java 对象如何保存

本章目标：连接第一卷对象模型——JVM 退出后对象就消失了，数据需要一种机制"活过"进程生命周期。理解对象模型与关系模型之间的根本差异，以及 ORM 产生的必然性。

### 1.1 内存对象的困境

Java 对象存在于 Heap，JVM 退出即消失。但业务数据必须持久——用户信息、订单记录、交易流水，必须跨越进程生命周期。

### 1.2 两种模型的碰撞

| | 对象模型（Java） | 关系模型（数据库） |
|---|---|---|
| 存储单元 | 对象（Object） | 行（Row） |
| 关联方式 | 对象引用 | 外键（Foreign Key） |
| 类型体系 | 继承、多态 | 无继承概念 |
| 生命周期 | GC 管理 | 显式 CRUD |

核心问题：对象-关系阻抗失配（Object-Relational Impedance Mismatch）。ORM 的使命就是在这两种模型之间建立映射。

### 1.3 持久化的三种层次

| 层次 | 方式 | 代表 |
|------|------|------|
| 文件存储 | 序列化到文件 | `ObjectOutputStream` |
| 直接 SQL | 手动拼 SQL，映射结果集 | JDBC |
| ORM | 框架自动映射 | MyBatis、Hibernate/JPA |

本卷的展开逻辑：从最底层的手动 SQL 开始，逐步往上，理解每一层解决了上一层的什么问题。

---

## 2 JDBC：Java 数据访问的底层抽象

本章目标：理解 JDBC 不是框架，而是 Java 与数据库之间的标准接口。所有 ORM 框架最终都建立在 JDBC 之上。掌握 Connection、Statement、ResultSet 的生命周期和正确用法。

### 2.1 JDBC 为什么存在

没有 JDBC 的时代：每个数据库有自己的一套 C API，Java 程序要连 MySQL 用一种方式，连 Oracle 用另一种。JDBC 的价值：**一套 API，操作所有关系数据库**。

### 2.2 JDBC 架构

```
Java Application
      ↓
JDBC API（java.sql 包）
      ↓
Driver（数据库驱动实现）
      ↓
Database
```

### 2.3 核心接口

| 接口 | 职责 | 生命周期 |
|------|------|---------|
| `DriverManager` / `DataSource` | 管理驱动，创建连接 | 应用级 |
| `Connection` | 代表一个数据库连接 | 一次会话 |
| `PreparedStatement` / `Statement` | 执行 SQL | 一次查询 |
| `ResultSet` | 查询结果集 | 一次查询结果 |

### 2.4 PreparedStatement 与 SQL 注入

```java
// 危险：SQL 注入
stmt.executeQuery("SELECT * FROM users WHERE name = '" + userInput + "'");

// 安全：参数化查询
PreparedStatement ps = conn.prepareStatement("SELECT * FROM users WHERE name = ?");
ps.setString(1, userInput);
```

PreparedStatement 同时解决两个问题：**防注入**（参数与 SQL 分离）+ **性能**（预编译，数据库可缓存执行计划）。

### 2.5 JDBC 的性能瓶颈

| 问题 | 根因 | 解决方向 |
|------|------|---------|
| 连接创建慢 | TCP 握手 + 数据库认证 | 连接池（HikariCP） |
| 逐条插入慢 | 每次网络往返 | 批量操作（Batch） |
| 模板代码多 | 重复的 try-catch-finally | ORM 框架封装 |

这正是后续章节的展开动力：连接池 → ORM → 缓存。

---

## 3 MyBatis：Java 世界里的 SQL 映射框架

本章目标：理解 MyBatis 的设计哲学——不是替开发者写 SQL，而是让开发者写的 SQL 能方便地与 Java 对象互相映射。对比 JDBC，理解 MyBatis 解决了什么、保留了什么。

### 3.1 为什么需要 MyBatis

JDBC 的核心痛点：

- 大量模板代码：获取连接 → 创建 Statement → 遍历 ResultSet → 关闭资源
- SQL 与 Java 代码混在一起，难以维护
- 结果集到对象的映射需要手写

MyBatis 的定位：**SQL 由你写，映射由我做**。

### 3.2 MyBatis 核心流程

```
Mapper Interface（@Mapper / @Select）
      ↓
JDK 动态代理（MapperProxy）
      ↓
SqlSession（数据库会话）
      ↓
Executor（Simple / Reuse / Batch）
      ↓
StatementHandler → ResultSetHandler
      ↓
JDBC
```

### 3.3 Mapper 动态代理

为什么 `UserMapper.getById(1)` 能自动执行 SQL？——MyBatis 为每个 Mapper 接口生成 JDK 动态代理，方法调用被拦截，根据方法名找到对应的 SQL，通过 SqlSession 执行。连接第二卷反射和第六卷 AOP 知识。

### 3.4 MyBatis 缓存机制

| | 一级缓存 | 二级缓存 |
|---|---|---|
| 作用范围 | SqlSession 内 | Mapper 级别（跨 SqlSession） |
| 默认开启 | ✅ | ❌ |
| 失效条件 | `update` / `delete` / `commit` / `close` | 写操作会使整个缓存失效 |

关键理解：Spring 整合后默认每次查询创建新 SqlSession，一级缓存实际不共享。二级缓存需显式开启，且要注意缓存一致性问题。

### 3.5 MyBatis 插件机制

基于责任链模式的 Interceptor：

```
Executor → ParameterHandler → StatementHandler → ResultSetHandler
   ↑            ↑                  ↑                  ↑
   └── Interceptor 可以在任意环节插入逻辑（分页、加密、慢SQL监控）
```

连接第六卷 AOP 思想——插件本质是 MyBatis 层面的"AOP"。

---

## 4 ORM 深入：对象与关系如何转换

本章目标：对比 MyBatis（SQL 中心）和 Hibernate/JPA（对象中心）两种不同的 ORM 哲学。理解 Hibernate 的 Entity 生命周期、延迟加载、脏检查机制以及典型陷阱。

### 4.1 MyBatis vs Hibernate/JPA 的设计哲学

| | MyBatis | Hibernate / JPA |
|---|---|---|
| 设计中心 | SQL | 对象 |
| SQL 控制 | 开发者手写 | 框架自动生成 |
| 学习成本 | 低（SQL + 映射） | 高（生命周期、状态、缓存） |
| 调试难度 | 低（SQL 可见） | 高（生成的 SQL 不直观） |
| 适用场景 | 复杂查询、报表 | 标准 CRUD 频繁变动的业务 |
| 缓存 | 两级缓存，需手动管理 | 一级缓存内置 + 二级缓存可选 |

### 4.2 Entity 生命周期

Hibernate 管理的对象有三种状态：

| 状态 | 含义 | 被 Session 管理 |
|------|------|:---:|
| Transient（瞬态） | 刚 `new` 的对象，未与 DB 关联 | ❌ |
| Persistent（持久态） | 被 Session 管理，变更自动同步 | ✅ |
| Detached（游离态） | Session 关闭后，对象仍对应 DB 记录 | ❌ |

### 4.3 Lazy Loading（延迟加载）

Hibernate 对关联对象默认懒加载：查询 `User` 时不会立即查 `User.orders`，只有访问 `getOrders()` 时才发 SQL。好处是性能，代价是可能的 `LazyInitializationException`（Session 已关闭后才访问懒加载属性）。

### 4.4 N+1 查询问题

```
SELECT * FROM users;               -- 1 次查询，获取 N 个用户
SELECT * FROM orders WHERE user_id = ?;  -- 每个用户一次，共 N 次
```

解决思路：

| 框架 | 方案 |
|------|------|
| MyBatis | `collection` 的联合查询 / 嵌套查询 + 批量加载 |
| Hibernate | `JOIN FETCH` / `@Fetch(FetchMode.SUBSELECT)` / `@BatchSize` |

---

## 5 数据库核心原理（Java 开发者视角）

本章目标：数据库不需要学成 DBA，但每个 Java 开发者必须理解 SQL 执行过程、索引原理和慢 SQL 分析。这些知识直接决定能否写出高性能的查询。

### 5.1 SQL 执行流程

```
SQL 文本
  ↓
Parser（语法分析 → AST）
  ↓
Optimizer（优化器 → 选择索引、决定 JOIN 顺序）
  ↓
Executor（执行器 → 调用存储引擎）
  ↓
返回结果
```

### 5.2 索引为什么有效

B+Tree 是关系数据库默认索引结构的核心原因：

- 叶子节点形成有序链表，范围查询极快
- 非叶子节点只存索引键，高度低，磁盘 I/O 少
- 聚簇索引 vs 非聚簇索引（二级索引的回表问题）

### 5.3 慢 SQL 分析

`EXPLAIN` 的核心字段：

| 字段 | 关注点 |
|------|--------|
| `type` | 访问类型：`ALL`（全表扫描）最差，目标是 `ref` 或 `const` |
| `key` | 实际使用的索引，`NULL` 说明没走索引 |
| `rows` | 预估扫描行数，越小越好 |
| `Extra` | `Using filesort`、`Using temporary` 需要优化 |

### 5.4 数据库锁

| 锁类型 | 粒度 | 场景 |
|--------|------|------|
| 行锁 | 行级 | InnoDB 默认，`SELECT ... FOR UPDATE` |
| 乐观锁 | 应用层（版本号） | 读多写少，冲突概率低 |
| 悲观锁 | 数据库层 | 冲突概率高，需要强一致性 |

### 5.5 事务隔离级别

| 隔离级别 | 脏读 | 不可重复读 | 幻读 | 实现原理 |
|---------|:---:|:--------:|:---:|---------|
| READ UNCOMMITTED | ✅ | ✅ | ✅ | 无锁 |
| READ COMMITTED | ❌ | ✅ | ✅ | 行锁 + MVCC |
| REPEATABLE READ（MySQL 默认）| ❌ | ❌ | ✅ | MVCC（快照读） |
| SERIALIZABLE | ❌ | ❌ | ❌ | 表锁，串行执行 |

---

## 6 Spring 事务管理：声明式事务的 Java 实现

本章目标：在第 5 章理解了数据库的事务能力之后，本章回答"Spring 如何帮 Java 开发者管理事务"。核心是 AOP 代理 + `@Transactional`，重点放在事务传播行为和高频失效场景。

### 6.1 为什么 Java 需要事务抽象

业务逻辑"转账"需要 A 减钱、B 加钱——要么都成功，要么都失败。数据库提供了事务能力，但 Java 需要一套**统一的编程抽象**来管理事务的开启、提交、回滚。

### 6.2 Spring @Transactional 原理

```
业务方法调用
      ↓
AOP Proxy 拦截
      ↓
开启事务（Connection.setAutoCommit(false)）
      ↓
执行业务方法
      ↓
成功 → commit / 异常 → rollback
```

核心：`@Transactional` 通过 AOP 代理织入事务管理，实现"声明式事务"——开发者只需标记注解，框架负责事务边界。

### 6.3 事务传播机制

| 传播行为 | 含义 | 典型场景 |
|---------|------|---------|
| `REQUIRED`（默认） | 有事务则加入，无则新建 | 大多数业务方法 |
| `REQUIRES_NEW` | 始终新建事务，挂起当前 | 日志写入（不受主事务回滚影响） |
| `NESTED` | 嵌套事务，可独立回滚 | 子操作失败不影响主流程 |

### 6.4 事务失效的五大场景

| 场景 | 原因 | 解决 |
|------|------|------|
| 同类方法调用 | 不走代理 | 注入自己 / 拆分到不同类 |
| 非 public 方法 | 代理无法拦截 | 改为 public |
| 异常被 catch | 默认只回滚 RuntimeException 和 Error | `rollbackFor = Exception.class` |
| 数据库引擎不支持 | MyISAM 不支持事务 | 使用 InnoDB |
| 多线程调用 | 事务与线程绑定 | 分布式事务方案（见第七卷） |

---

## 7 Redis 与 Java 缓存体系

本章目标：理解 Redis 不是"另一个数据库"，而是在数据访问链路中解决性能问题的核心组件。**重点放在 Java 应用如何使用缓存**，而非 Redis 集群架构。覆盖客户端演进、Spring Cache 抽象、缓存一致性和三大经典问题。

### 7.1 为什么 Java 应用需要缓存

数据库是系统最慢的一层，减少数据库访问是性能优化的最高效手段：

- 热点数据反复查询（80/20 原则）
- 高并发下的数据库保护
- 会话共享等工程需求

### 7.2 Java 访问 Redis 的客户端演进

| 客户端 | 特点 |
|--------|------|
| Jedis | 同步、简单，早期主流 |
| Lettuce | 异步、线程安全，Spring Boot 2.x 默认 |
| Redisson | 分布式对象、锁、集合，高级抽象 |

### 7.3 Spring Cache 抽象

`@Cacheable` / `@CacheEvict` / `@CachePut` 提供声明式缓存管理，底层可切换 Caffeine（本地）或 Redis（分布式）。

### 7.4 缓存一致性问题

缓存与数据库之间的三种经典策略：

| 策略 | 写操作 | 风险 |
|------|--------|------|
| Cache Aside | 更新 DB → 删除缓存 | 可能出现短暂不一致 |
| Read/Write Through | 缓存层代理 DB 读写 | 缓存与 DB 强耦合 |
| 延迟双删 | 删缓存 → 更新 DB → 延迟再删 | 降低但不根除不一致概率 |

### 7.5 缓存的三大经典问题

| 问题 | 现象 | 解决 |
|------|------|------|
| **穿透** | 查不到的数据反复穿透到 DB | 布隆过滤器 / 缓存空值 |
| **击穿** | 热点 key 过期瞬间，大量请求打 DB | 互斥锁 / 逻辑过期 |
| **雪崩** | 大量 key 同时过期 | 过期时间加随机值 / 多级缓存 |

### 7.6 Redis 在 Java 中的分布式能力

| 能力 | 实现方式 | 场景 |
|------|---------|------|
| 分布式锁 | `SET NX EX` + Lua 释放 | 防止重复执行 |
| 分布式计数器 | `INCR` / `INCRBY` | 点赞数、限流计数 |

---

## 8 数据访问性能优化

本章目标：将前七章的知识落在工程实践上。覆盖连接池、批量操作、数据访问链路分析和常见问题排查。

### 8.1 连接池：HikariCP

数据库连接创建成本高，连接池复用连接是基础优化。

| 参数 | 含义 | 建议 |
|------|------|------|
| `maximumPoolSize` | 最大连接数 | 公式：`核心数 × 2 + 磁盘数` |
| `minimumIdle` | 最小空闲连接 | 等于 `maximumPoolSize`（避免冷启动） |
| `connectionTimeout` | 获取连接超时 | 30s |
| `leakDetectionThreshold` | 连接泄漏检测 | 线上建议开启（如 60s） |

### 8.2 批处理

逐条 insert：每次网络往返 + 每次事务提交。批量 insert 合并为一次网络传输，吞吐量提升 10~100 倍。

### 8.3 数据访问链路分析

```
Controller（接收请求）
      ↓
Service（业务逻辑）
      ↓
DAO / Repository（数据访问层）
      ↓
Database / Redis
```

每一层都可能成为瓶颈。需要监控每层的 RT、慢查询、连接池状态。

### 8.4 常见问题排查

| 问题 | 可能原因 | 排查方向 |
|------|---------|---------|
| 慢查询 | 未走索引 / SQL 复杂度高 | `EXPLAIN` → 加索引 / 改写 SQL |
| 连接耗尽 | 连接池太小 / 连接泄漏 | HikariCP 监控 + `leakDetectionThreshold` |
| 数据库雪崩 | 无缓存 + 高并发 | 缓存 + 限流（见第七卷） |
| 死锁 | 两个事务以不同顺序加锁 | 统一加锁顺序 + 缩短事务时间 |

---

> 第五卷到此结束。核心链路 **Java 对象 → ORM → SQL → 事务 → 数据库 → 缓存** 全部覆盖。读者已经从 JDBC 底层出发，经过 MyBatis/Hibernate 映射层、数据库原理、Spring 事务管理，最终到达 Redis 缓存体系和性能优化，建立起 Java 数据访问的完整能力。
>
> **与全书其他卷的纵横联系：**
>
> | 依赖方向 | 依赖内容 |
> |---------|---------|
> | ← 第一卷 | 对象模型是 ORM 的"源"；注解驱动 MyBatis/JPA 的声明式编程 |
> | ← 第二卷 | 反射是 MyBatis Mapper 代理的基础；连接池 = 有限资源的复用管理 |
> | ← 第三卷 | 连接池的并发安全、分布式锁（Redis）、缓存的互斥锁 |
> | ← 第四卷 | 数据库连接本质是 TCP Socket；Redis 通信也是网络 I/O |
> | → 第六卷 | Spring `@Transactional` 的 AOP 实现、JdbcTemplate、Spring Data JPA、Spring Cache |
> | → 第七卷 | 分库分表、缓存架构、分布式事务（TCC/Saga）、消息队列（MQ 归属第七卷） |
>
> **边界说明：**
> - MQ（Kafka/RocketMQ）：核心问题是**服务间通信**，归属第七卷「系统设计」；本卷仅在第 6.4 节提及多线程调用时事务失效场景
> - Elasticsearch：全文搜索和日志分析，与持久化链路的核心链路不同，如需保留可在第七卷或作为附录
