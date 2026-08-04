# 第二卷 JVM Runtime

> 回答"一行代码如何被 JVM 执行"。覆盖字节码与类加载、运行时数据区、对象布局、GC、JIT、线上排查。

## 章节

- [字节码与类加载](chapter-01-bytecode-classloading.md) — Class 文件结构、字节码指令、双亲委派、打破委派
- [JVM 运行时数据区](chapter-02-memory-model.md) — 堆/栈/方法区/Metaspace、栈帧、StringTable
- [对象模型](chapter-03-object-model.md) — 对象创建、内存布局、Mark Word、Monitor、TLAB、逃逸分析
- [垃圾回收](chapter-04-gc.md) — 可达性分析、四种引用、CMS/G1/ZGC
- [JIT 编译](chapter-05-jit.md) — 分层编译、方法内联、逃逸分析优化、去优化
- [线上排查与诊断](chapter-06-diagnostics.md) — CPU 100%、Heap Dump、Arthas、JFR、参数速查
