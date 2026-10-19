/**
 * 状态验证：对取样 state(t) 逐条执行域包验证断言。
 *
 * 是什么：validateState(pack, state) → 各断言的结果列表。
 * 为什么：验证三分法的静态一支——断言是域包对自身语义的承诺，
 *         内核只负责统一执行与汇总，不解释断言含义。
 * 怎么用：取样任意 t 后调用；失败断言的 failures 直接面向开发者。
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
