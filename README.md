# LingFan.CodeCharacter

契约先行的程序化角色系统（2D/2.5D）：角色的构成、耦合、边界与外观参数全部是确定性程序算出来的，不是关键帧调出来的。

## 核心主张

- 动作 = 曲线、噪声、约束的组合与求值；风格 = 算法选型与参数配方，内核没有「风格」概念。
- 对外唯一接口是 `state(t)`——t 时刻的纯数据状态向量，任何渲染器与编排者只消费它。
- fps 是采样密度不是语义：一切跟着毫秒 t 走，没有「第 n 帧」概念。
- CPU 2D 合成跨设备逐字节可复现。

## 分层结构

```
packages/contracts   契约层：全部类型与语义承诺，零实现依赖
packages/primitives 契约算法参考实现：曲线、噪声与随机子流
packages/kernel      内核：只依赖 contracts 与 primitives 的求值运行时
examples/*           示例配方：一类角色的适配器范例（humanoid 首实例），
                     不背 API 稳定性承诺；packs/ 预留给正式域包
renderers/*          渲染适配器：state(t) 到像素，可整体替换
tests/               全仓测试（根目录集中，不与源码同置）
```

## 工程命令

| 场景               | 命令              |
| ------------------ | ----------------- |
| 安装依赖           | `pnpm install`    |
| 新增依赖           | `pnpm add <包名>` |
| 类型检查           | `pnpm typecheck`  |
| 门禁（lint）       | `pnpm lint`       |
| 单元测试           | `pnpm test:unit`  |
| 格式化             | `pnpm format`     |

包管理器只用 pnpm；提交前必须通过 `pnpm lint`。

## 嵌入调用

本仓不持有时间线：占用多少毫秒、采用多少 FPS 全由调用方驱动。把角色嵌进任何
「时间 × 采样」的宿主（视频引擎、游戏循环、编排器）只需三步：

```ts
import { createCharacterRuntime } from "@lingfan-character/kernel";
import { humanoidPack } from "@lingfan-character/example-humanoid";
import { buildDrawPlan, draw } from "@lingfan-character/renderer-canvas2d";

const runtime = createCharacterRuntime(humanoidPack);

// 宿主在任意时刻 t（毫秒）与任意采样密度下调用：
const state = await runtime.computeAt(tMs); // 纯函数，同 t 两遍逐字节一致
const plan = buildDrawPlan(state, 512); // 纯数据指令流，可重组后再执行
draw(ctx, plan); // 或交给任何能执行该指令流的渲染端
```

完整跨引擎实例见 LingFan.CodeVideo 仓的 `examples/character-layer/`：
角色作为场景里的一层由视频引擎的时间线驱动，角色域零改动。
