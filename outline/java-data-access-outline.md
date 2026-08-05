# 第五卷 Java 数据访问与持久化 —— 数据如何可靠、高效地存储与读取

> 前四卷解决了语言、运行时、并发和网络通信。第五卷回答：Java 对象如何持久化？核心链路是：**Java 对象 → ORM → SQL → 事务 → 数据库**。本卷只覆盖持久化，缓存（Redis）和消息队列（MQ）不在本卷范围——缓存归属第七卷"数据架构"，MQ 归属第七卷"消息驱动架构"。共 7 章。

---

## 1 持久化思想：Java 对象如何保存

本章目标：连接第一卷对象模型——JVM 退出后对象就消失了，数据需要一种机制"活过"进程生命周期。

### 1.1 内存对象的困境

Java 对象存在于 Heap，JVM 退出即消失。但业务数据必须持久——用户信息、订单记录、交易流水，必须跨越进程生命周期。

### 1.2 两种模型的碰撞

| | 对象模型（Java） | 关系模型（数据库） |
|---|---|---|
| 存储单元 | 对象（Object） | 行（Row） |
| 关联方式 | 对象引用 | 外键（Foreign Key） |
| 类型体系 | 继承、多态 | 无继承概念 |
| 生命周期 | GC 管理 | 显式 CRUD |

核心问题：对象-关系阻抗失配（Object-Relational Impedance Mismatch）。

### 1.3 持久化的三种层次

| 层次 | 方式 | 代表 |
|------|------|------|
| 文件存储 | 序列化到文件 | `ObjectOutputStream` |
| 直接 SQL | 手动拼 SQL，映射结果集 | JDBC |
| ORM | 框架自动映射 | MyBatis、Hibernate/JPA |

---

## 2 JDBC：Java 数据访问的底层抽象

本章目标：理解 JDBC 不是框架，而是 Java 与数据库之间的标准接口。所有 ORM 框架最终都建立在 JDBC 之上。

### 2.1 JDBC 为什么存在

没有 JDBC 的时代：每个数据库有自己的 C API，连 MySQL 用一种方式，连 Oracle 用另一种。JDBC 的价值：**一套 API，操作所有关系数据库**。

### 2.2 核心接口

| 接口 | 职责 | 生命周期 |
|------|------|---------|
| `DataSource` | 管理驱动，创建连接 | 应用级 |
| `Connection` | 代表一个数据库连接 | 一次会话 |
| `PreparedStatement` | 执行 SQL | 一次查询 |
| `ResultSet` | 查询结果集 | 一次查询结果 |

### 2.3 PreparedStatement 与 SQL 注入

```java
// 危险：SQL 注入
stmt.executeQuery("SELECT * FROM users WHERE name = '" + userInput + "'");

// 安全：参数化查询
PreparedStatement ps = conn.prepareStatement("SELECT * FROM users WHERE name = ?");
ps.setString(1, userInput);
```

两个价值：**防注入**（参数与 SQL 分离）+ **性能**（预编译，数据库可缓存执行计划）。

### 2.4 JDBC 的性能瓶颈

| 问题 | 根因 | 解决方向 |
|------|------|---------|
| 连接创建慢 | TCP 握手 + 数据库认证 | 连接池（HikariCP） |
| 逐条插入慢 | 每次网络往返 | 批量操作（Batch） |
| 模板代码多 | 重复的 try-catch-finally | ORM 框架封装 |

---

## 3 MyBatis：SQL 映射框架

本章目标：理解 MyBatis 的设计哲学——不是替开发者写 SQL，而是让开发者写的 SQL 能方便地与 Java 对象互相映射。

### 3.1 为什么需要 MyBatis

JDBC 核心痛点：大量模板代码、SQL 与 Java 代码混在一起、结果集到对象映射需手写。

MyBatis 定位：**SQL 由你写，映射由我做**。

### 3.2 核心流程

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

为什么 `UserMapper.getById(1)` 能自动执行 SQL？MyBatis 为每个 Mapper 接口生成 JDK 动态代理，方法调用被拦截，根据方法名找到对应 SQL，通过 SqlSession 执行。连接第二卷反射和第六卷 AOP。

### 3.4 缓存机制

| | 一级缓存 | 二级缓存 |
|---|---|---|
| 作用范围 | SqlSession 内 | Mapper 级别（跨 SqlSession） |
| 默认开启 | ✅ | ❌ |
| 失效条件 | `update` / `delete` / `commit` / `close` | 写操作使整个缓存失效 |

注意：Spring 整合后默认每次查询创建新 SqlSession，一级缓存实际不共享（第六卷展开）。

### 3.5 插件机制

基于责任链模式的 Interceptor，可在 Executor、ParameterHandler、StatementHandler、ResultSetHandler 四个环节插入逻辑（分页、加密、慢 SQL 监控）。连接第六卷 AOP 思想。

---

## 4 ORM 深入：对象与关系如何转换

本章目标：对比 MyBatis（SQL 中心）和 Hibernate/JPA（对象中心）两种 ORM 哲学。

### 4.1 MyBatis vs Hibernate/JPA

| | MyBatis | Hibernate / JPA |
|---|---|---|
| 设计中心 | SQL | 对象 |
| SQL 控制 | 开发者手写 | 框架自动生成 |
| 学习成本 | 低 | 高（生命周期、状态、缓存） |
| 适用场景 | 复杂查询、报表 | 标准 CRUD 频繁变动的业务 |

### 4.2 Entity 生命周期

| 状态 | 含义 | 被 Session 管理 |
|------|------|:---:|
| Transient（瞬态） | 刚 `new`，未与 DB 关联 | ❌ |
| Persistent（持久态） | 被 Session 管理，变更自动同步 | ✅ |
| Detached（游离态） | Session 关闭后仍对应 DB 记录 | ❌ |

### 4.3 Lazy Loading（延迟加载）

查询 `User` 时不会立即查 `User.orders`，访问 `getOrders()` 时才发 SQL。代价：`LazyInitializationException`（Session 已关闭后才访问懒加载属性）。

### 4.4 N+1 查询问题

```
SELECT * FROM users;                    -- 1 次
SELECT * FROM orders WHERE user_id = ?; -- 每个用户一次，共 N 次
```

解决：MyBatis 用联合查询 / 批量加载；Hibernate 用 `JOIN FETCH` / `@BatchSize`。

---

## 5 数据库核心原理（Java 开发者视角）

本章目标：不需要学成 DBA，但必须理解 SQL 执行过程、索引原理和慢 SQL 分析。

### 5.1 SQL 执行流程

```
SQL 文本 → Parser（语法分析）→ Optimizer（优化器）→ Executor（执行器）→ 返回结果
```

### 5.2 索引为什么有效

B+Tree 是关系数据库默认索引结构：

- 叶子节点形成有序链表，范围查询极快
- 非叶子节点只存索引键，高度低，磁盘 I/O 少
- 聚簇索引 vs 非聚簇索引（二级索引的回表问题）

### 5.3 慢 SQL 分析

`EXPLAIN` 核心字段：

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

## 6 Spring 事务管理

本章目标：数据库提供了事务能力，Spring 如何帮 Java 开发者管理事务？核心是 AOP 代理 + `@Transactional`。

### 6.1 @Transactional 原理

```
业务方法调用 → AOP Proxy 拦截 → 开启事务 → 执行业务 → 成功 commit / 异常 rollback
```

开发者只需标记注解，框架负责事务边界。

### 6.2 事务传播机制

| 传播行为 | 含义 | 典型场景 |
|---------|------|---------|
| `REQUIRED`（默认） | 有事务则加入，无则新建 | 大多数业务方法 |
| `REQUIRES_NEW` | 始终新建，挂起当前 | 日志写入（不受主事务回滚影响） |
| `NESTED` | 嵌套事务，可独立回滚 | 子操作失败不影响主流程 |

### 6.3 事务失效的五大场景

| 场景 | 原因 | 解决 |
|------|------|------|
| 同类方法调用 | 不走代理 | 注入自己 / 拆分到不同类 |
| 非 public 方法 | 代理无法拦截 | 改为 public |
| 异常被 catch | 默认只回滚 RuntimeException | `rollbackFor = Exception.class` |
| 数据库引擎不支持 | MyISAM 不支持事务 | 使用 InnoDB |
| 多线程调用 | 事务与线程绑定 | 分布式事务方案（第七卷） |

---

## 7 数据访问性能优化

本章目标：将前六章知识落在工程实践上。

### 7.1 连接池：HikariCP

| 参数 | 含义 | 建议 |
|------|------|------|
| `maximumPoolSize` | 最大连接数 | `核心数 × 2 + 磁盘数` |
| `minimumIdle` | 最小空闲连接 | 等于 `maximumPoolSize` |
| `connectionTimeout` | 获取连接超时 | 30s |
| `leakDetectionThreshold` | 连接泄漏检测 | 线上建议开启（如 60s） |

### 7.2 批处理

逐条 insert：每次网络往返 + 每次事务提交。批量 insert 合并为一次网络传输，吞吐量提升 10~100 倍。

### 7.3 数据访问链路分析

```
Controller → Service → DAO / Repository → Database
```

每一层都可能成为瓶颈。需要监控每层的 RT、慢查询、连接池状态。

### 7.4 常见问题排查

| 问题 | 可能原因 | 排查方向 |
|------|---------|---------|
| 慢查询 | 未走索引 / SQL 复杂度高 | `EXPLAIN` → 加索引 / 改写 SQL |
| 连接耗尽 | 连接池太小 / 连接泄漏 | HikariCP 监控 + `leakDetectionThreshold` |
| 死锁 | 两个事务以不同顺序加锁 | 统一加锁顺序 + 缩短事务时间 |

---

> 第五卷到此结束。核心链路 **Java 对象 → ORM → SQL → 事务 → 数据库** 全部覆盖。缓存和 MQ 不在本卷范围——Redis 缓存体系归属第七卷第 6 章"数据架构"，消息队列归属第七卷第 7 章"消息驱动架构"。
>
> **与全书其他卷的纵横联系：**
>
> | 依赖方向 | 依赖内容 |
> |---------|---------|
> | ← 第一卷 | 对象模型是 ORM 的"源"；注解驱动 MyBatis/JPA 的声明式编程 |
> | ← 第二卷 | 反射是 MyBatis Mapper 代理的基础；连接池 = 有限资源的复用管理 |
> | ← 第三卷 | 连接池的并发安全 |
> | ← 第四卷 | 数据库连接本质是 TCP Socket |
> | → 第六卷 | Spring `@Transactional` 的 AOP 实现、Spring 整合 MyBatis |
> | → 第七卷 | 缓存体系、分库分表、分布式事务 |
