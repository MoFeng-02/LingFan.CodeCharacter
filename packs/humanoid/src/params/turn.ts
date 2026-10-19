import type { NodeDeclaration } from "@lingfan-character/contracts";
import { NODE_ID } from "../nodes";
import { SLOT } from "../shared";

/**
 * 转头参数节点：v0 将基调直接映射为头部刚体运动量。
 * 曲线修饰留给后续版本；层间视差由各外观节点自行取用。
 */
export const turnNode: NodeDeclaration = {
  id: NODE_ID.turn,
  reads: [SLOT.turn],
  writes: [SLOT.headTurn],
  step: (inputs) => ({
    values: { [SLOT.headTurn]: inputs.values[SLOT.turn] ?? 0 },
  }),
};
