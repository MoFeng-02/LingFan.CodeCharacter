/**
 * 基空间契约：基是配方声明的正交形变通道，微表情与体态的统一承载。
 *
 * 是什么：基声明（区域、侧向、成对、绑定、耦合）与基空间容器；
 *         基本身就是输入槽——本文件只补元数据与校验语义，不引入新的求值形态。
 * 为什么：把配方私有的基约定升格为可校验契约，任意角色的基空间可被
 *         生成与组合；声明六要素齐备即合法，校验只做可判定检查。
 * 怎么用：配方在 CharacterPack.basis 声明基空间，内核在编译前调用
 *         validateBasisSpace 校验；基槽的取值范围与缺省仍在槽位声明里。
 * 注意事项：基声明是元数据，不改变求值顺序；耦合声明描述联动意图，
 *          实际传导由节点实现，二者不一致时以节点为准。
 */

import type { NodeId, SlotName } from "./state";

/** 基的侧向：左右成对支持不对称表情；center 表示不可分侧。 */
export type BasisSide = "left" | "right" | "center";

/**
 * 声明式联动：源基激活时向目标槽传导。
 * 增益与传导的实际执行由配方节点承担，本声明让联动关系可校验、
 * 可被编排工具读取；不声明即无自动联动。
 */
export interface BasisCoupling {
  /** 联动目标槽位（基槽或波形输出槽）。 */
  readonly to: SlotName;
  /** 传导增益：目标增量 = 源值 × gain，符号决定同向或反向。 */
  readonly gain: number;
}

/**
 * 基声明六要素：区域、侧向与成对、范围与缺省（在槽位声明中）、
 * 绘制目标绑定、耦合关系。
 */
export interface BasisDeclaration {
  /** 基标识 = 对应输入槽名（基就是输入槽，标识沿用点分规则）。 */
  readonly name: SlotName;
  /** 区域：器官或部位分组（如 brow / eye / lip / cheek）。 */
  readonly region: string;
  readonly side: BasisSide;
  /** 正交组：同组基在语义上互斥叠加，分组供校验与编排工具引用。 */
  readonly group: string;
  /** 成对基互相指名（left ↔ right 双向一致）；side 为 center 时不得声明。 */
  readonly pair?: SlotName;
  /** 绘制目标绑定：基系数驱动的节点（形变的承接面）。 */
  readonly bindTargets: readonly NodeId[];
  /** 声明式联动（可选）。 */
  readonly couplings?: readonly BasisCoupling[];
}

/** 基空间：配方对自己全部基的完整声明。 */
export interface BasisSpace {
  readonly bases: readonly BasisDeclaration[];
}
