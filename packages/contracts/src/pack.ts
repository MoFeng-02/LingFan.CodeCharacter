/**
 * 域包端口契约：内核看见什么、域包必须提供什么。
 *
 * 是什么：域包的自描述端口——包声明、槽位声明、节点与耦合边、验证断言、子步进策略。
 * 为什么：内核不枚举具体角色，只定义接入协议；域包可整体替换（换包只改组合根一行）。
 * 怎么用：域包实现 CharacterPack 并在组合根装配；内核按端口编译、求值与验证。
 * 注意事项：槽位名必须符合「包.节点族.槽位」点分规则；写冲突（两个节点写同一输出槽
 *          且无显式顺序）在编译期判为违规；内置缺省属于契约，跨实现必须一致。
 */

import type { DependencyEdge, NodeDeclaration } from "./node";
import type { CharacterState, SlotName } from "./state";
import type { SubstepPolicy } from "./sample";

/** 包声明：身份与提供的节点族。 */
export interface PackDeclaration {
  /** 包标识，同时是槽位名前缀与噪声种子派生的角色标识来源。 */
  readonly id: string;
  readonly version: string;
  readonly families: readonly string[];
}

/** 槽位约束范围：声明该槽的合法值域，求值超出即钳制并记录。 */
export interface SlotRange {
  readonly min: number;
  readonly max: number;
}

/** 槽位声明：方向、缺省与约束范围。 */
export interface SlotDeclaration {
  readonly name: SlotName;
  readonly direction: "input" | "output";
  /** 内置缺省值，仅输入槽可声明；缺省属于契约。 */
  readonly defaultValue?: number;
  /** 约束钳制范围；缺省表示该槽不设钳制。 */
  readonly range?: SlotRange;
}

/** 单条验证结果：断言名与失败描述。 */
export interface ValidationResult {
  readonly ok: boolean;
  readonly failures: readonly string[];
}

/**
 * 验证断言：对取样 state(t) 的直接断言（如「转头时某跟随槽在容差内」）。
 * 断言必须是纯函数——只读状态，不产生副作用。
 */
export interface PackValidation {
  readonly name: string;
  readonly assert: (state: CharacterState) => ValidationResult;
}

/**
 * 域包端口：域包对内核暴露的全部信息。
 * 域包之间互不知晓；包内实现细节内核不关心。
 */
export interface CharacterPack {
  readonly declaration: PackDeclaration;
  readonly slots: readonly SlotDeclaration[];
  readonly nodes: readonly NodeDeclaration[];
  readonly edges: readonly DependencyEdge[];
  readonly validations: readonly PackValidation[];
  /** 域内含动力学的节点所需的固定子步进策略；无动力学时声明固定 1 次亦可。 */
  readonly substep: SubstepPolicy;
}
