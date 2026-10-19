import type { NodeDeclaration } from "@lingfan-character/contracts";
import { applyEasing } from "@lingfan-character/primitives";
import { NODE_ID } from "../nodes";
import { SLOT } from "../shared";

/**
 * 口型驱动节点：场景注入的说话驱动值（0..1）到开口度的非线性响应。
 * 响应曲线用 smoothstep——轻驱动即有可感知微张、中段最敏感、满驱动闭合到位；
 * 无状态纯映射，语音的时间结构（音节/停顿）由场景侧包络承担，角色域不感知。
 */
export const mouthDriveNode: NodeDeclaration = {
  id: NODE_ID.mouthDrive,
  reads: [SLOT.mouthDrive],
  writes: [SLOT.openWave],
  step: (inputs) => ({
    values: {
      [SLOT.openWave]: applyEasing(
        "smoothstep",
        inputs.values[SLOT.mouthDrive] ?? 0,
      ),
    },
  }),
};
