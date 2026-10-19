import type {
  NodeDeclaration,
  RenderPrimitive,
} from "@lingfan-character/contracts";
import { NODE_ID } from "../nodes";
import { SLOT } from "../shared";
import { fillPath, pt } from "./geometry";
import { headTransform } from "./headMotion";
import { PALETTE } from "./palette";

/**
 * 饰品层节点：两侧发卡，绘制序的最上层。
 */
export const accessoryNode: NodeDeclaration = {
  id: NODE_ID.accessory,
  reads: [SLOT.headTurn, SLOT.breathWave],
  writes: [],
  step: (inputs) => {
    const turn = inputs.values[SLOT.headTurn] ?? 0;
    const breath = inputs.values[SLOT.breathWave] ?? 0;
    const head = headTransform(turn, breath);

    const primitives: RenderPrimitive[] = [];
    // 发卡：左右各一枚菱形贴片。
    for (const side of [-1, 1] as const) {
      const x = 0.5 + side * 0.2;
      primitives.push(
        fillPath(
          NODE_ID.accessory,
          [
            { kind: "moveTo", point: pt(x, 0.3) },
            { kind: "lineTo", point: pt(x + side * 0.025, 0.33) },
            { kind: "lineTo", point: pt(x, 0.36) },
            { kind: "lineTo", point: pt(x - side * 0.025, 0.33) },
            { kind: "closePath" },
          ],
          head,
          PALETTE.pin,
        ),
      );
    }

    return { values: {}, primitives };
  },
};
