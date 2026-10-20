/**
 * 状态验证与基空间校验。
 *
 * 是什么：validateState 对取样 state(t) 逐条执行域包验证断言；
 *         validateBasisSpace 对配方声明的基空间做静态可判定检查。
 * 为什么：验证三分法的静态一支——断言是域包对自身语义的承诺，
 *         内核只负责统一执行与汇总，不解释断言含义；基空间合法性
 *         则必须在求值前静态判明。
 * 怎么用：取样任意 t 后调用 validateState；编译求值前调用 validateBasisSpace。
 * 注意事项：断言必须纯（契约），内核不捕获断言内部异常之外的状态副作用；
 *          断言抛错属于断言实现缺陷，不在此吞掉。
 */

import type {
  CharacterPack,
  CharacterState,
  ValidationResult,
} from "@lingfan-character/contracts";

/** 执行全部验证断言，返回与声明同序的结果列表。 */
export const validateState = (
  pack: CharacterPack,
  state: CharacterState,
): readonly ValidationResult[] =>
  pack.validations.map((validation) => validation.assert(state));

/**
 * 基空间校验：对配方声明的基逐条做可判定检查，六要素齐备即合法。
 *
 * 是什么：validateBasisSpace(pack) → 单条汇总验证结果。
 * 为什么：基空间的合法性必须在求值前静态判明——绑定目标、成对指名、
 *         耦合目标都要落在本配方内，悬空引用与单向成对是配置错误。
 * 怎么用：编译求值前调用；ok=false 时 failures 逐条面向开发者。
 * 注意事项：只做结构检查；取值范围与缺省的合法性由编译期槽位检查覆盖；
 *          耦合声明描述联动意图，实际传导由节点实现。
 */
export const validateBasisSpace = (pack: CharacterPack): ValidationResult => {
  const failures: string[] = [];
  const space = pack.basis;
  if (!space) {
    return { ok: true, failures: [] };
  }

  const slotNames = new Set(pack.slots.map((slot) => slot.name));
  const inputSlots = new Set(
    pack.slots
      .filter((slot) => slot.direction === "input")
      .map((slot) => slot.name),
  );
  const nodeIds = new Set(pack.nodes.map((node) => node.id));
  const declared = new Set<string>();

  for (const base of space.bases) {
    if (declared.has(base.name)) {
      failures.push(`基 ${base.name} 重复声明`);
      continue;
    }
    declared.add(base.name);
    if (!inputSlots.has(base.name)) {
      failures.push(`基 ${base.name} 必须对应已声明的输入槽`);
    }
    if (base.region.length === 0) {
      failures.push(`基 ${base.name} 缺少区域声明`);
    }
    if (base.group.length === 0) {
      failures.push(`基 ${base.name} 缺少正交组声明`);
    }
    if (base.side !== "center" && base.pair === undefined) {
      failures.push(`基 ${base.name} 为左右侧基但未声明成对基`);
    }
    if (base.side === "center" && base.pair !== undefined) {
      failures.push(`基 ${base.name} 为中间基但声明了成对基`);
    }
    if (base.bindTargets.length === 0) {
      failures.push(`基 ${base.name} 未绑定任何绘制目标节点`);
    }
    for (const target of base.bindTargets) {
      if (!nodeIds.has(target)) {
        failures.push(`基 ${base.name} 绑定的节点 ${target} 不存在`);
      }
    }
    for (const coupling of base.couplings ?? []) {
      if (!slotNames.has(coupling.to)) {
        failures.push(
          `基 ${base.name} 的耦合目标 ${coupling.to} 不是已声明槽位`,
        );
      }
      if (!Number.isFinite(coupling.gain)) {
        failures.push(`基 ${base.name} 的耦合增益必须是有限数`);
      }
    }
  }

  for (const base of space.bases) {
    if (base.pair === undefined) {
      continue;
    }
    const mirror = space.bases.find((other) => other.name === base.pair);
    if (mirror === undefined) {
      failures.push(`基 ${base.name} 声明的成对基 ${base.pair} 不存在`);
    } else if (mirror.pair !== base.name) {
      failures.push(`基 ${base.name} 与 ${base.pair} 的成对指名不对称`);
    }
  }

  return { ok: failures.length === 0, failures };
};
