import type { NodeDeclaration } from "@lingfan-character/contracts";
import { NODE_ID } from "../nodes";
import { SLOT } from "../shared";
import { ellipse, multiply, pt, rotateAround } from "./geometry";
import { headTransform } from "./headMotion";
import { PALETTE } from "./palette";

/**
 * 后发层节点：头后的大块发型与两侧垂发，是绘制序的最底层外观。
 * 随头部刚体运动，并带极小的发摆延迟感（绕发根的小角度旋转）。
 */
export const hairBackNode: NodeDeclaration = {
  id: NODE_ID.hairBack,
  reads: [SLOT.headTurn, SLOT.breathWave, SLOT.swingWave],
  writes: [],
  step: (inputs) => {
    const turn = inputs.values[SLOT.headTurn] ?? 0;
    const breath = inputs.values[SLOT.breathWave] ?? 0;
    const swing = inputs.values[SLOT.swingWave] ?? 0;
    const base = multiply(
      headTransform(turn, breath),
      rotateAround(0.5, 0.35, swing * 0.008),
    );
    return {
      values: {},
      primitives: [
        ellipse(
          NODE_ID.hairBack,
          pt(0.5, 0.465),
          0.225,
          0.275,
          base,
          PALETTE.hairDark,
        ),
        ellipse(
          NODE_ID.hairBack,
          pt(0.298, 0.52),
          0.038,
          0.105,
          base,
          PALETTE.hairDark,
        ),
        ellipse(
          NODE_ID.hairBack,
          pt(0.702, 0.52),
          0.038,
          0.105,
          base,
          PALETTE.hairDark,
        ),
      ],
    };
  },
};
