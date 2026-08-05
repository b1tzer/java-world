# 第一卷 Java 语言 —— Java 为什么这样设计

> 第一卷回答"Java 为什么这样设计"——不教语法，而是沿着类型系统 → 面向对象 → 泛型 → 注解与 Lambda 的路线，逐层拆解 Java 语言的设计思想，为后续 Runtime 和框架原理打下基础。共 4 章。

---

## 1 Java 基础与类型系统

本章目标：建立 Java 世界观，同时回答"Java 到底如何表示一个对象"。将原"设计哲学"与"类型系统"合并——设计目标不需要独立成章，穿插在类型讲解中自然引出即可。

### 1.1 Java 的设计目标

不讲语言发展史，直接回答 Java 想解决什么问题：

- Write Once, Run Anywhere（跨平台——为什么需要 JVM）
- 自动内存管理（为什么需要 GC）
- 强类型系统（编译期发现错误）
- 安全沙箱（字节码验证）

核心结论：Java 不是为了追求最快，而是为了可移植性、安全性、稳定性和开发效率。后续所有内容都围绕这些目标展开。

### 1.2 基本类型与引用类型

Java 类型世界分两大类：

```
Type
 ├── Primitive：int / long / double / boolean / char / byte / short / float
 └── Reference：Class / Interface / Array / Enum / Record
```

重点不是罗列八种基本类型，而是回答：**为什么 Java 有基本类型？**——性能。如果所有东西都是对象（`Integer i = new Integer(10)`），会产生对象分配、GC 压力、内存浪费。引出自动装箱和未来 Value Class 方向。

### 1.3 对象模型：引用 vs 对象

很多开发者误解 `User user = new User()` 中"变量就是对象"。需要讲清楚：

```
栈（Stack）              堆（Heap）
┌─────────┐            ┌──────────────┐
│  user  ─┼───────────→│  User Object │
└─────────┘            └──────────────┘
```

- 引用是什么？变量保存什么？对象在哪里？
- `User a = new User(); User b = a;` 为什么 `b` 修改后 `a` 也变了？

### 1.4 equals / hashCode / identity

对象相等性的三个层次：

| 概念 | 含义 | 运算符/方法 |
|------|------|------------|
| identity | 是否同一个对象（内存地址） | `==` |
| equality | 逻辑上是否相等 | `equals()` |
| hash | 对象的哈希指纹 | `hashCode()` |

核心规则：重写 `equals` 必须重写 `hashCode`，否则 `HashMap` 行为异常。连接后续集合框架和并发集合。

### 1.5 String 与不可变对象

`String` 为什么是 `final` 的？为什么不可变？

- 安全性：字符串常量池共享，可变会导致互相污染
- 线程安全：不可变对象天然线程安全（连接第三卷）
- 哈希缓存：`hashCode` 只需计算一次

引出 `StringBuilder` / `StringBuffer` 的存在理由，以及 `String.intern()` 与常量池（连接第二卷 StringTable）。

### 1.6 类型转换与编译期检查

- 基本类型：自动扩大（`byte → short → int → long → float → double`）vs 强制缩小
- 引用类型：向上转型（安全）vs 向下转型（运行期 `checkcast` 验证）
- 编译器如何利用类型提前发现错误（为泛型章节铺垫）

---

## 2 面向对象

本章目标：不是复述继承、封装、多态的概念，而是追问它们为什么出现。面向对象不是语法，而是软件建模方法。

### 2.1 为什么需要面向对象

过程式编程的问题：数据和行为分离，全局状态泛滥，修改一个功能牵动大量代码。面向对象的核心思想：把数据和操作数据的方法组合成对象，让对象负责自己的状态和行为。

### 2.2 封装：控制状态与行为边界

不是 `private + getter/setter`，而是回答：**为什么需要封装？**

```java
// ❌ 任何地方直接修改状态
account.balance = -100;

// ✅ 对象自己保证规则
account.withdraw(100);  // 内部校验余额、记录流水、触发事件
```

封装真正的含义：控制对象状态变化的入口。

### 2.3 继承：代码复用还是类型关系？

继承真正表达的不是"拥有相同代码"，而是 **is-a relationship**。继承的问题：强耦合、父类变化影响子类、层次结构僵化。Java 的限制：单继承、`Object` 根类、`final` 禁止继承。

### 2.4 多态：面向对象扩展性的核心

```java
// 没有多态
if (type == "wechat") { ... }
else if (type == "alipay") { ... }

// 有多态
payment.pay();
```

多态的核心价值：消除条件分支。连接 JVM 的 `invokevirtual` 和方法表（第二卷展开）。

### 2.5 接口 vs 抽象类

| | 接口 | 抽象类 |
|---|---|---|
| 本质 | 能力契约（can-do） | 类型抽象（is-a） |
| 多继承 | ✅ | ❌ |
| 状态 | 不能有实例字段 | 可以有 |
| 典型用途 | `Comparable`、`Runnable`、`Serializable` | 模板方法模式 |

Java 接口演进：Java 8 的 `default` method、Java 9 的 `private` method。

### 2.6 SOLID 原则

| 原则 | 含义 | 核心价值 |
|------|------|---------|
| **S**RP | 单一职责 | 一个类只有一个要改的原因 |
| **O**CP | 开闭原则 | 对扩展开放，对修改关闭 |
| **L**SP | 里氏替换 | 子类必须能替代父类 |
| **I**SP | 接口隔离 | 不依赖不需要的接口 |
| **D**IP | 依赖倒置 | 依赖抽象，不依赖具体 |

重点不是背定义，而是理解这些原则为什么产生——它们解决的是大型系统的可维护性问题。

### 2.7 组合优于继承

继承导致强耦合。组合通过接口解耦：

```java
// 继承：Dog is-a Animal（强耦合）
// 组合：Dog has-a Behavior（可替换）
class Dog {
    private Behavior behavior;  // 运行时可切换
}
```

---

## 3 泛型

本章目标：泛型不是小语法特性，而是 Java 类型系统发展到一定阶段后，为解决类型安全、代码复用、抽象能力产生的一套机制。很多人第一次真正理解编译器，就从这里开始。

### 3.1 为什么需要泛型：从 Object 到类型安全

Java 5 之前的问题：

```java
List list = new ArrayList();
list.add("hello");
list.add(123);           // 可以混入任何类型
String s = (String) list.get(1);  // ClassCastException！
```

泛型解决的问题：将类型约束从运行期提前到编译期。

### 3.2 泛型与类型系统：为什么 `List<String>` 不是 `List<Object>`

如果允许赋值：

```java
List<String> list = new ArrayList<>();
List<Object> obj = list;   // 假设允许
obj.add(100);              // String 集合中混入 Integer！
```

引出三个核心概念：

- **Invariant（不变性）**：`List<String>` 和 `List<Object>` 无关
- **Covariance（协变）**：`? extends` 实现
- **Contravariance（逆变）**：`? super` 实现

### 3.3 通配符与 PECS 原则

**Producer Extends, Consumer Super.**

- 读取（Producer）：`List<? extends Number>` —— 可以安全读取 Number
- 写入（Consumer）：`List<? super Integer>` —— 可以安全写入 Integer

### 3.4 类型擦除：Java 泛型的核心设计

```java
// 编译前
List<String> list = new ArrayList<>();

// 编译后（擦除）
List list = new ArrayList();   // <String> 消失了
```

为什么选择编译期泛型而非运行时泛型？**向后兼容**。Java 5 引入泛型时必须兼容 Java 4 的字节码——JVM 不需要改变。

### 3.5 擦除之后：桥接方法、类型转换与字节码

- 编译器自动插入 `checkcast` 指令
- 桥接方法保证泛型继承时的多态正确性
- Class 文件中的 `Signature` 属性保留泛型信息（供反射使用，连接第二卷）

### 3.6 泛型的限制与未来

当前限制：不能用基本类型（`List<int>` ❌）、不能 `new T()`、运行期类型缺失。

未来方向（Project Valhalla）：Specialized Generics 让泛型支持基本类型，Value Types 消除装箱开销。

### 3.7 泛型在框架中的应用

| 框架 / 场景 | 泛型用法 |
|-------------|----------|
| 集合框架 | `List<T>`、`Map<K,V>` |
| Spring | `ApplicationContext.getBean(Class<T>)` |
| MyBatis | `Mapper<T>` |
| CompletableFuture | `CompletableFuture<T>` |
| JSON 序列化 | `TypeReference<T>`（Jackson） |

---

## 4 注解与 Lambda

本章目标：将注解和 Lambda 合并为一章——它们分别是 Java 元数据驱动编程和行为抽象两个方向的能力，放在一起形成语言层的完整闭环。

### 4.1 为什么需要注解：从配置驱动到元数据驱动

早期 Java 大量依赖 XML 配置，代码与配置分离导致修改困难、IDE 无法感知。注解的思想：把描述信息放回代码附近。

```java
@Service
public class UserService { }
```

代码本身携带"我是一个 Service"的语义。注解不是执行逻辑，而是描述代码的信息。

### 4.2 注解的生命周期：SOURCE / CLASS / RUNTIME

| 阶段 | 说明 | 典型例子 |
|------|------|----------|
| SOURCE | 只存在源码中，编译后消失 | `@Override` |
| CLASS | 进入 class 文件，但 JVM 不加载 | 字节码工具使用 |
| RUNTIME | 保留到运行时，可通过反射读取 | `@Component`（Spring） |

注解存储在 Class 文件的 `RuntimeVisibleAnnotations` 属性中（连接第二卷）。

### 4.3 编译期注解处理（APT）

运行时注解（如 Spring）之外，大量代码生成在编译期完成：

```
Java Source → Annotation Processor → Generate Code → Compile
```

典型工具：Lombok、MapStruct、Dagger。

### 4.4 注解驱动框架

分析 `@Component`、`@Autowired`、`@Transactional` 的背后流程：

```
启动 Spring → 扫描 Class → 读取 Annotation → 创建 BeanDefinition → 实例化 → 依赖注入
```

关键理解：注解只是入口，真正执行的是框架。注解过度使用会隐藏行为，调试困难。

### 4.5 为什么需要函数式编程

传统面向对象中，行为属于对象（`order.pay()`）。但很多场景真正想传递的是一段逻辑：

```java
// 早期：匿名内部类包装行为
Collections.sort(list, new Comparator<User>() {
    public int compare(User a, User b) {
        return a.getAge() - b.getAge();
    }
});

// Lambda：行为成为一等公民
Collections.sort(list, (a, b) -> a.getAge() - b.getAge());
```

### 4.6 函数式接口与 Lambda 的类型基础

Lambda 本身没有类型，它依赖 `@FunctionalInterface` 定义的目标类型：

| 接口 | 签名 | 用途 |
|------|------|------|
| `Function<T,R>` | `R apply(T t)` | 转换 |
| `Consumer<T>` | `void accept(T t)` | 消费 |
| `Supplier<T>` | `T get()` | 提供 |
| `Predicate<T>` | `boolean test(T t)` | 判断 |

### 4.7 Lambda vs 匿名内部类

| 维度 | 匿名内部类 | Lambda |
|------|-----------|--------|
| `this` 绑定 | 指向匿名类自身 | 指向外部类 |
| class 文件 | 生成独立 `.class` | 无独立文件（`invokedynamic`） |
| 调用机制 | `invokevirtual` | `invokedynamic` → `LambdaMetafactory` |

### 4.8 Lambda 背后的编译机制：invokedynamic

`x -> x + 1` 编译后不是生成 `Lambda$1.class`，而是：

```
invokedynamic 指令 → Bootstrap Method → LambdaMetafactory → 运行时生成实现类
```

为什么选择 `invokedynamic`？延迟绑定、JVM 可跨 Lambda 优化、保持语言演进空间。连接第二卷字节码。

### 4.9 Stream API：声明式数据处理

```java
// 命令式
for (User user : list) {
    if (user.getAge() > 18) {
        result.add(user);
    }
}

// 声明式
users.stream()
     .filter(user -> user.getAge() > 18)
     .collect(toList());
```

核心思想：惰性计算、管道模型、内部迭代。并行 Stream 存在但需谨慎使用（线程池共享、不适合 IO 密集）。

### 4.10 Optional：用类型表达空值语义

```java
Optional<User> user = findById(id);
user.map(User::getName)
    .orElse("Unknown");
```

解决 NPE 问题。但 Optional 不能滥用——不适合做字段、不适合做方法参数。

### 4.11 Java 不是纯函数式语言

Java 以面向对象为核心，同时吸收函数式思想。函数式特性是增强而非替代——在适合的场景用 Stream，在适合的场景用传统 OOP，这才是 Java 之道。

---

> 这样第一卷从原来的 6 章压缩为 4 章，形成清晰递进：类型系统（Java 如何描述世界）→ 面向对象（Java 如何组织复杂世界）→ 泛型（Java 如何让类型参与抽象）→ 注解与 Lambda（Java 如何附加语义和传递行为）。到这里，读者理解了 Java 语言提供的全部表达能力，为第二卷 JVM Runtime 打下基础。
