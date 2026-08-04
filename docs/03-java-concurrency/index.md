# 第三卷 Java 并发

> 回答"多线程如何正确高效地共享资源"。按 JMM → volatile → synchronized → AQS → CAS → 并发集合 → 线程池 → 异步编程组织。

## 章节

- [为什么需要并发](chapter-01-why-concurrency.md) — 三大驱动力、并发与并行、数据竞争
- [线程模型](chapter-02-thread-model.md) — 1:1 模型、创建方式演进、生命周期
- [Java 内存模型](chapter-03-jmm.md) — 可见性/有序性/原子性、happens-before
- [volatile](chapter-04-volatile.md) — 内存屏障、MESI、DCL
- [synchronized](chapter-05-synchronized.md) — Monitor、Mark Word 锁状态、锁升级
- [Lock 与 AQS](chapter-06-lock-aqs.md) — state + CLH 队列、ReentrantLock/Semaphore/CountDownLatch
- [原子类与 CAS](chapter-07-atomic-cas.md) — CAS 原理、ABA 问题、LongAdder
- [并发集合](chapter-08-concurrent-collections.md) — ConcurrentHashMap、CopyOnWrite、BlockingQueue
- [线程池](chapter-09-thread-pool.md) — ThreadPoolExecutor、execute() 源码、拒绝策略
- [异步编程](chapter-10-async-model.md) — CompletableFuture、响应式、Actor 模型
- [诊断与优化](chapter-11-diagnostics.md) — 死锁诊断、Thread Dump、锁竞争、优化策略
