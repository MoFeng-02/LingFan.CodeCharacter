import type {
  NodeDeclaration,
  RenderPrimitive,
} from "@lingfan-character/contracts";
import { NODE_ID } from "../nodes";
import { SLOT } from "../shared";
import { ellipse, fillPath, pt } from "./geometry";
import { headTransform } from "./headMotion";
import { PALETTE } from "./palette";

/**
 * 饰品层节点：圆框眼镜与两侧发卡，绘制序的最上层。
 * 眼镜框以深色椭圆叠半透明镜片构成环感；发卡为菱形贴片。
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
    // 眼镜：左右框（深色底 + 浅色镜片叠出环感）、鼻梁与两侧镜腿。
    for (const side of [-1, 1] as const) {
      const x = 0.5 + side * 0.065;
      primitives.push(
        ellipse(
          NODE_ID.accessory,
          pt(x, 0.452),
          0.042,
          0.03,
          head,
          PALETTE.glassFrame,
        ),
        ellipse(
          NODE_ID.accessory,
          pt(x, 0.452),
          0.034,
          0.023,
          head,
          PALETTE.lens,
        ),
        ellipse(
          NODE_ID.accessory,
          pt(0.5 + side * 0.14, 0.443),
          0.048,
          0.0035,
          head,
          PALETTE.glassFrame,
        ),
      );
    }
    primitives.push(
      ellipse(
        NODE_ID.accessory,
        pt(0.5, 0.448),
        0.02,
        0.004,
        head,
        PALETTE.glassFrame,
      ),
    );

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
