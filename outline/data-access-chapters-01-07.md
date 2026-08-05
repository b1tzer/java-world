# 第一章 持久化思想：Java 对象如何保存

> JVM 退出后对象就消失了，但业务数据必须持久。本章连接第一卷对象模型，理解对象-关系阻抗失配，以及 ORM 产生的必然性。

---

## 1.1 内存对象的困境

Java 对象存在于 Heap，由 GC 管理生命周期。JVM 退出，所有对象消失。

但业务数据——用户信息、订单记录、交易流水——必须跨越进程生命周期。用户下次打开应用，数据还在。

这就需要一种机制，将内存中的对象**持久化**到外部存储。

## 1.2 两种模型的碰撞

Java 使用**对象模型**，关系数据库使用**关系模型**。两者有根本差异：

| | 对象模型（Java） | 关系模型（数据库） |
|---|---|---|
| 存储单元 | 对象（Object） | 行（Row） |
| 关联方式 | 对象引用（指针） | 外键（Foreign Key） |
| 类型体系 | 继承、多态 | 无继承概念 |
| 生命周期 | GC 管理 | 显式 CRUD |
| 数据访问 | `user.getOrders()` | `SELECT * FROM orders WHERE user_id = ?` |

核心问题：**对象-关系阻抗失配（Object-Relational Impedance Mismatch）**。对象有继承、多态、引用图，数据库有表、行、外键。两种模型之间没有天然的映射关系。

## 1.3 持久化的三种层次

| 层次 | 方式 | 优点 | 缺点 |
|------|------|------|------|
| 文件存储 | 序列化到文件 | 简单 | 无法查询、无法并发、格式不兼容 |
| 直接 SQL | 手动写 SQL，映射结果集 | 灵活 | 大量模板代码、SQL 与 Java 混杂 |
| ORM | 框架自动映射 | 开发效率高 | 学习成本、生成的 SQL 可能不优 |

本卷的展开逻辑：从最底层的 JDBC 开始，逐步往上，理解每一层解决了上一层的什么问题。

---

# 第二章 JDBC：Java 数据访问的底层抽象

> JDBC 不是框架，而是 Java 与数据库之间的标准接口。所有 ORM 框架最终都建立在 JDBC 之上。

---

## 2.1 JDBC 为什么存在

每个数据库有自己的 C API。Java 程序要连 MySQL 用一种方式，连 Oracle 用另一种——代码无法复用。

JDBC 的价值：**一套 API，操作所有关系数据库**。开发者写 JDBC 代码，底层通过不同的驱动（Driver）连接不同的数据库。

```
Java Application → JDBC API → MySQL Driver → MySQL
                               Oracle Driver → Oracle
                               PostgreSQL Driver → PostgreSQL
```

## 2.2 核心接口

| 接口 | 职责 | 生命周期 |
|------|------|---------|
| `DataSource` | 管理驱动，创建连接 | 应用级（通常单例） |
| `Connection` | 代表一个数据库连接 | 一次会话 |
| `PreparedStatement` | 执行 SQL | 一次查询 |
| `ResultSet` | 查询结果集 | 一次查询结果 |

典型使用流程：

```java
// 获取连接
Connection conn = dataSource.getConnection();

// 准备 SQL
PreparedStatement ps = conn.prepareStatement(
    "SELECT id, name, age FROM users WHERE age > ?");
ps.setInt(1, 18);

// 执行查询
ResultSet rs = ps.executeQuery();

// 遍历结果
while (rs.next()) {
    long id = rs.getLong("id");
    String name = rs.getString("name");
    int age = rs.getInt("age");
}

// 关闭资源（必须！）
rs.close();
ps.close();
conn.close();
```

## 2.3 PreparedStatement 与 SQL 注入

```java
// ❌ 危险：SQL 注入
String sql = "SELECT * FROM users WHERE name = '" + userInput + "'";
stmt.executeQuery(sql);
// 如果 userInput 是 "' OR '1'='1"，SQL 变成：
// SELECT * FROM users WHERE name = '' OR '1'='1' —— 返回所有用户！

// ✅ 安全：参数化查询
PreparedStatement ps = conn.prepareStatement(
    "SELECT * FROM users WHERE name = ?");
ps.setString(1, userInput);
```

PreparedStatement 两个价值：
1. **防注入**：参数与 SQL 分离，数据库驱动负责转义
2. **性能**：预编译后数据库可以缓存执行计划

## 2.4 JDBC 的性能瓶颈

| 问题 | 根因 | 解决方向 |
|------|------|---------|
| 连接创建慢 | TCP 握手 + 数据库认证 | 连接池（HikariCP） |
| 逐条插入慢 | 每次网络往返 + 事务提交 | 批量操作（Batch） |
| 模板代码多 | 重复的 try-catch-finally | ORM 框架封装 |

---

# 第三章 MyBatis：SQL 映射框架

> MyBatis 的设计哲学：SQL 由你写，映射由我做。

---

## 3.1 为什么需要 MyBatis

JDBC 的核心痛点：

```java
// JDBC 的模板代码：每次查询都要写这些
Connection conn = null;
PreparedStatement ps = null;
ResultSet rs = null;
try {
    conn = dataSource.getConnection();
    ps = conn.prepareStatement("SELECT * FROM users WHERE id = ?");
    ps.setLong(1, id);
    rs = ps.executeQuery();
    if (rs.next()) {
        User user = new User();
        user.setId(rs.getLong("id"));
        user.setName(rs.getString("name"));
        user.setAge(rs.getInt("age"));
        return user;
    }
    return null;
} finally {
    if (rs != null) rs.close();
    if (ps != null) ps.close();
    if (conn != null) conn.close();
}
```

MyBatis 的方式：

```java
// Mapper 接口
@Mapper
public interface UserMapper {
    @Select("SELECT * FROM users WHERE id = #{id}")
    User getById(Long id);
}

// 使用
User user = userMapper.getById(1L);  // 一行搞定
```

## 3.2 核心流程

```
Mapper Interface
      ↓ JDK 动态代理（MapperProxy）
SqlSession
      ↓
Executor（Simple / Reuse / Batch）
      ↓
StatementHandler → ResultSetHandler
      ↓
JDBC
```

## 3.3 Mapper 动态代理

为什么 `userMapper.getById(1L)` 能自动执行 SQL？

MyBatis 在启动时为每个 `@Mapper` 接口生成 **JDK 动态代理**。当调用 `getById(1L)` 时：

1. 代理拦截方法调用
2. 根据接口全限定名 + 方法名找到对应的 MappedStatement（SQL 定义）
3. 通过 SqlSession 执行 SQL
4. ResultSetHandler 将结果集映射为 Java 对象

这与第一卷泛型和第二卷反射直接相关——代理利用反射获取方法上的注解和泛型信息。

## 3.4 缓存机制

| | 一级缓存 | 二级缓存 |
|---|---|---|
| 作用范围 | SqlSession 内 | Mapper 级别（跨 SqlSession） |
| 默认开启 | ✅ | ❌ |
| 失效条件 | update/delete/commit/close | 写操作使整个缓存失效 |

注意：Spring 整合后默认每次查询创建新 SqlSession，一级缓存实际不共享。第六卷会详细解释原因。

## 3.5 插件机制

基于责任链模式的 Interceptor，可在四个环节插入逻辑：

```
Executor → ParameterHandler → StatementHandler → ResultSetHandler
```

典型应用：分页插件（PageHelper）、慢 SQL 监控、数据加密。本质是 MyBatis 层面的"AOP"——连接第六卷 AOP 思想。

---

# 第四章 ORM 深入：对象与关系如何转换

> 对比 MyBatis（SQL 中心）和 Hibernate/JPA（对象中心）两种 ORM 哲学。

---

## 4.1 MyBatis vs Hibernate/JPA

| | MyBatis | Hibernate / JPA |
|---|---|---|
| 设计中心 | SQL | 对象 |
| SQL 控制 | 开发者手写 | 框架自动生成 |
| 学习成本 | 低（SQL + 映射） | 高（生命周期、状态、缓存） |
| 调试难度 | 低（SQL 可见） | 高（生成的 SQL 不直观） |
| 适用场景 | 复杂查询、报表 | 标准 CRUD 频繁变动的业务 |

## 4.2 Entity 生命周期

Hibernate 管理的对象有三种状态：

| 状态 | 含义 | 被 Session 管理 |
|------|------|:---:|
| Transient（瞬态） | 刚 `new`，未与 DB 关联 | ❌ |
| Persistent（持久态） | 被 Session 管理，变更自动同步 | ✅ |
| Detached（游离态） | Session 关闭后仍对应 DB 记录 | ❌ |

```java
User user = new User("Tom");           // Transient
session.save(user);                     // → Persistent
session.close();                        // → Detached
user.setName("Jerry");                  // Detached 状态，修改不会自动同步到 DB
session.update(user);                   // → 重新 Persistent
```

## 4.3 Lazy Loading（延迟加载）

查询 `User` 时不会立即查关联的 `User.orders`，只有访问 `getOrders()` 时才发 SQL：

```java
User user = session.get(User.class, 1L);  // 只查 users 表
List<Order> orders = user.getOrders();     // 此时才查 orders 表
```

好处：避免不必要的查询。代价：`LazyInitializationException`——Session 已关闭后才访问懒加载属性。

## 4.4 N+1 查询问题

```java
List<User> users = userMapper.findAll();  // 1 次查询
for (User user : users) {
    List<Order> orders = orderMapper.findByUserId(user.getId()); // N 次查询
}
// 总共 1 + N 次查询
```

解决思路：
- MyBatis：联合查询（一次 JOIN 搞定）或批量加载
- Hibernate：`JOIN FETCH`、`@BatchSize`、`@Fetch(FetchMode.SUBSELECT)`

---

# 第五章 数据库核心原理（Java 开发者视角）

> 不需要学成 DBA，但必须理解 SQL 执行过程、索引原理和慢 SQL 分析。

---

## 5.1 SQL 执行流程

```
SQL 文本
  ↓ Parser（语法分析 → AST）
  ↓ Optimizer（优化器 → 选择索引、决定 JOIN 顺序）
  ↓ Executor（执行器 → 调用存储引擎）
  ↓ 返回结果
```

优化器会根据表的统计信息、索引情况、数据分布来选择最优的执行计划。理解这一点，才能理解为什么同一个 SQL 在不同数据量下性能差异巨大。

## 5.2 索引为什么有效

B+Tree 是关系数据库默认索引结构：

```
        [10 | 20 | 30]           ← 非叶子节点（只存索引键）
       /     |      |     \
   [1,5]  [12,15] [22,25] [31,35] ← 叶子节点（存数据，形成有序链表）
```

- 非叶子节点只存索引键，高度低（通常 3-4 层），磁盘 I/O 少
- 叶子节点形成有序链表，范围查询极快
- **聚簇索引**：叶子节点存完整数据行（InnoDB 的主键索引）
- **非聚簇索引（二级索引）**：叶子节点存主键值，需要**回表**查完整数据

## 5.3 慢 SQL 分析

`EXPLAIN` 核心字段：

| 字段 | 关注点 |
|------|--------|
| `type` | `ALL`（全表扫描）最差，目标是 `ref` 或 `const` |
| `key` | 实际使用的索引，`NULL` 说明没走索引 |
| `rows` | 预估扫描行数，越小越好 |
| `Extra` | `Using filesort`、`Using temporary` 需要优化 |

```sql
EXPLAIN SELECT * FROM users WHERE age > 18;
-- type: ALL, rows: 100000 → 全表扫描，需要加索引
-- type: ref, key: idx_age, rows: 5000 → 走索引，OK
```

## 5.4 数据库锁

| 锁类型 | 粒度 | 场景 |
|--------|------|------|
| 行锁 | 行级 | InnoDB 默认，`SELECT ... FOR UPDATE` |
| 乐观锁 | 应用层（版本号） | 读多写少，冲突概率低 |
| 悲观锁 | 数据库层 | 冲突概率高，需要强一致性 |

乐观锁实现：

```sql
-- 读取时获取版本号
SELECT version FROM orders WHERE id = 1;  -- version = 5

-- 更新时检查版本号
UPDATE orders SET status = 'paid', version = version + 1
WHERE id = 1 AND version = 5;
-- 如果 affected rows = 0，说明被其他事务修改过，需要重试
```

## 5.5 事务隔离级别

| 隔离级别 | 脏读 | 不可重复读 | 幻读 | 实现原理 |
|---------|:---:|:--------:|:---:|---------|
| READ UNCOMMITTED | ✅ | ✅ | ✅ | 无锁 |
| READ COMMITTED | ❌ | ✅ | ✅ | 行锁 + MVCC |
| REPEATABLE READ（MySQL 默认）| ❌ | ❌ | ✅ | MVCC（快照读） |
| SERIALIZABLE | ❌ | ❌ | ❌ | 表锁，串行执行 |

**MVCC（多版本并发控制）**：每次修改创建新版本，读操作读取旧版本快照，不需要加锁。这是 InnoDB 在 REPEATABLE READ 下实现高并发的关键。

---

# 第六章 Spring 事务管理

> 数据库提供了事务能力，Spring 如何帮 Java 开发者管理事务？核心是 AOP 代理 + @Transactional。

---

## 6.1 @Transactional 原理

```java
@Transactional
public void transfer(Long fromId, Long toId, BigDecimal amount) {
    accountService.debit(fromId, amount);
    accountService.credit(toId, amount);
}
```

背后发生了什么：

```
1. 调用 transfer() → AOP 代理拦截
2. 获取数据库连接，设置 autoCommit = false
3. 执行 debit() 和 credit()
4. 没有异常 → commit()
5. 有异常 → rollback()
```

开发者只需标记注解，框架负责事务边界。

## 6.2 事务传播机制

| 传播行为 | 含义 | 典型场景 |
|---------|------|---------|
| `REQUIRED`（默认） | 有事务则加入，无则新建 | 大多数业务方法 |
| `REQUIRES_NEW` | 始终新建，挂起当前事务 | 日志写入（不受主事务回滚影响） |
| `NESTED` | 嵌套事务，可独立回滚 | 子操作失败不影响主流程 |

```java
@Transactional
public void createOrder(Order order) {
    orderDao.save(order);              // 在当前事务中
    logService.recordLog(order);       // REQUIRES_NEW：独立事务，不受主事务回滚影响
}
```

## 6.3 事务失效的五大场景

| 场景 | 原因 | 解决 |
|------|------|------|
| 同类方法调用 | `this.method()` 不走代理 | 注入自己 / 拆分到不同 Bean |
| 非 public 方法 | CGLIB 代理无法拦截 | 改为 public |
| 异常被 catch | 默认只回滚 RuntimeException | `@Transactional(rollbackFor = Exception.class)` |
| 数据库引擎不支持 | MyISAM 不支持事务 | 使用 InnoDB |
| 多线程调用 | 事务与线程绑定，子线程不在事务中 | 分布式事务方案（第七卷） |

第一个场景最容易犯错：

```java
@Service
public class OrderService {
    @Transactional
    public void createOrder(Order order) { ... }

    public void process(Order order) {
        // ❌ 自调用，不走代理，事务不生效！
        this.createOrder(order);
    }
}
```

---

# 第七章 数据访问性能优化

> 将前六章知识落在工程实践上。

---

## 7.1 连接池：HikariCP

数据库连接创建成本高（TCP 握手 + 认证）。连接池复用连接，是基础优化。

| 参数 | 含义 | 建议 |
|------|------|------|
| `maximumPoolSize` | 最大连接数 | `核心数 × 2 + 磁盘数` |
| `minimumIdle` | 最小空闲连接 | 等于 maximumPoolSize |
| `connectionTimeout` | 获取连接超时 | 30s |
| `leakDetectionThreshold` | 连接泄漏检测 | 线上建议开启（60s） |

连接泄漏是最常见的数据库问题之一——获取了连接但没有归还（异常路径没有 close），连接池逐渐耗尽。

## 7.2 批处理

```java
// ❌ 逐条插入：1000 条 = 1000 次网络往返 + 1000 次事务提交
for (User user : users) {
    userDao.insert(user);
}

// ✅ 批量插入：合并为一次网络传输
userDao.batchInsert(users);  // 吞吐量提升 10~100 倍
```

JDBC 批处理：

```java
PreparedStatement ps = conn.prepareStatement("INSERT INTO users (name, age) VALUES (?, ?)");
for (User user : users) {
    ps.setString(1, user.getName());
    ps.setInt(2, user.getAge());
    ps.addBatch();
}
ps.executeBatch();
```

## 7.3 数据访问链路分析

```
Controller → Service → DAO → Database
```

每一层都可能成为瓶颈：

- **Controller**：参数校验、序列化
- **Service**：业务逻辑、事务边界
- **DAO**：SQL 效率、连接池状态
- **Database**：索引、锁、慢查询

需要监控每层的 RT（响应时间），快速定位瓶颈在哪一层。

## 7.4 常见问题排查

| 问题 | 可能原因 | 排查方向 |
|------|---------|---------|
| 慢查询 | 未走索引 / SQL 复杂度高 | `EXPLAIN` → 加索引 / 改写 SQL |
| 连接耗尽 | 连接池太小 / 连接泄漏 | HikariCP 监控 + leakDetectionThreshold |
| 死锁 | 两个事务以不同顺序加锁 | 统一加锁顺序 + 缩短事务时间 |
| 主从延迟 | 从库跟不上主库 | 监控延迟、关键读走主库 |

---

> 第五卷到此结束。核心链路 **Java 对象 → ORM → SQL → 事务 → 数据库** 全部覆盖。缓存和 MQ 不在本卷范围——Redis 缓存体系归属第七卷第 6 章，消息队列归属第七卷第 7 章。
