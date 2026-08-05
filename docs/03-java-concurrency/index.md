# 第三卷 Java 并发

> 回答"多线程如何正确高效地共享资源"。按 JMM → volatile → synchronized → AQS → CAS → 并发集合 → 线程池 → 异步编程组织。

## 章节

- [为什么需要并发](/03-java-concurrency/chapter-01-why-concurrency) — 三大驱动力、并发与并行、数据竞争
- [线程模型](/03-java-concurrency/chapter-02-thread-model) — 1:1 模型、创建方式演进、生命周期
- [Java 内存模型](/03-java-concurrency/chapter-03-jmm) — 可见性/有序性/原子性、happens-before
- [volatile](/03-java-concurrency/chapter-04-volatile) — 内存屏障、MESI、DCL
- [synchronized](/03-java-concurrency/chapter-05-synchronized) — Monitor、Mark Word 锁状态、锁升级
- [Lock 与 AQS](/03-java-concurrency/chapter-06-lock-aqs) — state + CLH 队列、ReentrantLock/Semaphore/CountDownLatch
- [原子类与 CAS](/03-java-concurrency/chapter-07-atomic-cas) — CAS 原理、ABA 问题、LongAdder
- [并发集合](/03-java-concurrency/chapter-08-concurrent-collections) — ConcurrentHashMap、CopyOnWrite、BlockingQueue
- [线程池](/03-java-concurrency/chapter-09-thread-pool) — ThreadPoolExecutor、execute() 源码、拒绝策略
- [异步编程](/03-java-concurrency/chapter-10-async-model) — CompletableFuture、响应式、Actor 模型
- [诊断与优化](/03-java-concurrency/chapter-11-diagnostics) — 死锁诊断、Thread Dump、锁竞争、优化策略
