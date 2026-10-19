/**
 * 节点求值契约：节点是六层求值图的基本单元，纯函数、确定性。
 *
 * 是什么：节点求值签名（inputs, t, substream → outputs）、节点声明与耦合边声明、拓扑序语义。
 * 为什么：帧内按拓扑序求值是求值语义契约的核心——同输入永远同序，跨实现重合的前提。
 * 怎么用：域包在节点声明中提供 step 实现；内核编译时校验依赖图无环并推导拓扑序。
 * 注意事项：step 必须是纯函数——不得读取全局状态、不得依赖求值历史；
 *          需要历史的动力学效果以显式子步进与显式状态声明表达（见采样条款契约）。
 */

import type {
  AffineTransform,
  NodeId,
  RenderPrimitive,
  SlotName,
  TimeMs,
} from "./state";

/**
 * 确定性随机子流：每个节点独立一份，同种子同序列。
 * seed 由内核按「角色标识 + 节点标识」派生；噪声类原语以 seed 为格点哈希来源，
 * next() 供需要序列随机的效果使用。实现由内核提供。
 */
export interface RandomSubstream {
  /** 本节点子流的整数种子。 */
  readonly seed: number;
  /** 返回 0..1 区间内的下一个确定性随机值。 */
  next(): number;
}

/** 节点求值输入：依赖槽位的当前值，含参数与曲线求值结果。 */
export interface NodeStepInputs {
  readonly values: Readonly<Record<SlotName, number>>;
}

/** 节点求值输出：写入的槽位值、可选形变与可选可渲染基元。 */
export interface NodeStepOutputs {
  readonly values: Readonly<Record<SlotName, number>>;
  /** 节点产出的形变；缺省为单位矩阵。 */
  readonly transform?: AffineTransform;
  /** 外观节点产出的可渲染基元；缺省为空。 */
  readonly primitives?: readonly RenderPrimitive[];
}

/**
 * 节点求值签名：纯函数。
 * substream 由内核按「角色标识 + 节点标识」派生，同一节点在同一 t 的多次求值拿到相同序列起点。
 */
export type NodeStep = (
  inputs: NodeStepInputs,
  tMs: TimeMs,
  substream: RandomSubstream,
) => NodeStepOutputs;

/** 节点声明：身份、读写集合与求值实现。 */
export interface NodeDeclaration {
  readonly id: NodeId;
  /** 读取的槽位名集合（输入边）。 */
  readonly reads: readonly SlotName[];
  /** 写入的槽位名集合（输出边）。 */
  readonly writes: readonly SlotName[];
  readonly step: NodeStep;
}

/** 耦合边声明：参数到形变器的传播规则，是数据依赖边。 */
export interface DependencyEdge {
  readonly from: SlotName;
  readonly to: SlotName;
}

/**
 * 拓扑序：内核对依赖图推导的求值顺序。
 * 图必须无环；同一图同一输入的拓扑序必须恒定（并列节点按节点标识字典序打破平局）。
 */
export type TopologicalOrder = readonly NodeId[];
