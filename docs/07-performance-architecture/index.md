# 第七卷 性能与架构

> 回答"系统如何在高并发大规模场景下持续演进"。覆盖架构思想 → DDD → 高并发/高可用 → 分布式核心问题 → 数据架构 → 性能工程 → 综合案例。

## 章节

- [架构思想](chapter-01-architecture.md) — 分层/六边形/Clean Architecture
- [领域驱动设计](chapter-02-ddd.md) — Entity/VO/Aggregate/Bounded Context
- [高并发设计](chapter-03-high-concurrency.md) — 流量模型、水平扩展、经典架构
- [高可用设计](chapter-04-high-availability.md) — 冗余、隔离、降级
- [分布式系统](chapter-05-distributed.md) — CAP、2PC/TCC/Saga、分布式锁
- [数据架构](chapter-06-data-architecture.md) — 缓存一致性、穿透/击穿/雪崩、分库分表
- [消息驱动](chapter-07-messaging.md) — 事件驱动、Kafka、消息可靠性
- [性能工程](chapter-08-performance.md) — 指标体系、Profiling、JVM 诊断
- [架构案例](chapter-09-case-studies.md) — 秒杀、Feed 流、支付系统
