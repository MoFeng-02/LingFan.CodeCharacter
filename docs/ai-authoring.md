# AI 角色编排手册

面向用本仓契约生成角色配方的作者（人类或代码生成模型）。目标：读完即可写出
能通过门禁的配方声明，理解每一层错误在哪一步被拦截。

## 1. 核心范式：三步消费

角色对宿主只暴露一个纯函数接口——任意毫秒时刻 `t` 求值出状态向量，渲染端把
状态编译成指令流：

```ts
const runtime = createCharacterRuntime(pack);
const state = await runtime.computeAt(tMs, overrides); // 纯函数：同 t 两遍逐字节一致
const plan = buildDrawPlan(state, 512); // 纯数据指令流，可重组后交给渲染端
draw(ctx, plan);
```

不持有时间线：占用多少毫秒、采用多少 FPS 全由调用方决定。行为（说话、预设、
过渡）都是调用方在 `overrides` 里注入的参数函数，角色域零状态。

## 2. 配方（CharacterPack）声明骨架

```ts
export const myPack: CharacterPack = {
  declaration: { id: "mychar", version: "0.1.0", families: ["params", "appearance"] },
  slots: [/* 输入槽（带缺省与范围）与输出槽 */],
  nodes: [/* 参数节点、耦合节点、外观节点 */],
  edges: [], // 依赖边只做目标槽镜像复制；带衰减的联动用节点承担
  validations: [], // 对取样 state(t) 的静态断言
  substep: { kind: "fixed", count: 1 },
  basis: { bases: [/* 表情基声明，见第 3 节 */] },
};
```

节点是六层求值图的基本单元：`step(inputs, t, substream)` 纯函数，`reads` 声明
输入边、`writes` 声明输出边；内核按依赖图推导拓扑序（并列按节点标识字典序），
写冲突与悬空引用在编译期报错。

## 3. 表情基空间声明

基 = 输入槽 + 元数据声明。微表情 = 基系数向量，丰富度来自组合而非表情名列表。
基声明六要素：

| 要素       | 字段        | 说明                                        |
| ---------- | ----------- | ------------------------------------------- |
| 标识       | `name`      | 对应的输入槽名（点分三段式）                 |
| 区域       | `region`    | 器官或部位分组（brow / eye / lip / cheek…）  |
| 侧向与成对 | `side` `pair` | left/right 互相指名（双向一致）；center 不成对 |
| 范围与缺省 | 槽位声明内   | 0..1 或 ±1，`range` 与 `defaultValue` 在 slots 里 |
| 绑定       | `bindTargets` | 基系数驱动的节点（形变承接面）              |
| 耦合       | `couplings` | 可选联动声明（目标槽 × 增益），传导由节点实现 |

```ts
const humanoidBasis: BasisSpace = {
  bases: [
    {
      name: "humanoid.face.brow-raise-l",
      region: "brow",
      side: "left",
      group: "brow-raise",
      bindTargets: ["appearance.face"],
      pair: "humanoid.face.brow-raise-r",
    },
    // …右侧对称一条，其余 17 个基同理
  ],
};
```

## 4. 错误在哪一步被拦截

| 防线                    | 拦截内容                                           |
| ----------------------- | -------------------------------------------------- |
| `tsc` 编译期            | 类型错误：字段名拼错、范围类型不符、缺字段          |
| `validateBasisSpace`    | 基空间结构：悬空绑定、单向成对、重复声明、非法耦合目标 |
| `compile`（内核）       | 写冲突、环、悬空读写引用、命名违规、缺省超出范围     |
| 运行期                  | 越界值钳制并出具 `ConstraintReport`；确定性指纹两遍比对 |

## 5. 确定性约束（生成声明时必须遵守）

- 节点 `step` 纯函数：不读全局状态、不依赖求值历史；随机只经 `substream`
  （种子由「包标识 + 节点标识」派生）；噪声与曲线用契约原语。
- 数学运算只用 IEEE 双精度四则与整数比较：不用 `Math.exp / Math.cos` 等
  超越函数（跨引擎不逐字节一致）；需要振荡用契比雪夫多项式递推。
- 时间一律毫秒 `t`，不引入帧号；内部不设时间线。
