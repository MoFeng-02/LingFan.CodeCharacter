import type {
  NodeDeclaration,
  RenderPrimitive,
} from "@lingfan-character/contracts";
import { NODE_ID } from "../nodes";
import { SLOT } from "../shared";
import { clamp, ellipse, fillPath, multiply, pt, translate } from "./geometry";
import { headTransform } from "./headMotion";
import { PALETTE } from "./palette";

/**
 * 脸部节点：脸基形、五官与腮红，全部程序生成。
 * 眨眼压扁眼裂并淡出瞳孔；微笑放大嘴角上挑并浮现腮红；
 * 颧升（耦合链产出）把腮红向上提；眼挤让双眼向鼻侧收拢。
 */
export const faceNode: NodeDeclaration = {
  id: NODE_ID.face,
  reads: [
    SLOT.headTurn,
    SLOT.breathWave,
    SLOT.smileWave,
    SLOT.blinkWave,
    SLOT.cheekLift,
    SLOT.eyeSqueeze,
  ],
  writes: [],
  step: (inputs) => {
    const turn = inputs.values[SLOT.headTurn] ?? 0;
    const breath = inputs.values[SLOT.breathWave] ?? 0;
    const smile = inputs.values[SLOT.smileWave] ?? 0;
    const blink = inputs.values[SLOT.blinkWave] ?? 0;
    const cheek = inputs.values[SLOT.cheekLift] ?? 0;
    const squeeze = inputs.values[SLOT.eyeSqueeze] ?? 0;
    const head = headTransform(turn, breath);

    const primitives: RenderPrimitive[] = [
      ellipse(NODE_ID.face, pt(0.5, 0.47), 0.19, 0.235, head, PALETTE.skin),
      ellipse(
        NODE_ID.face,
        pt(0.5, 0.525),
        0.009,
        0.014,
        head,
        PALETTE.skinShade,
        0.55,
      ),
    ];

    // 双眼：眼白随眨眼压扁，瞳孔随之淡出；眼挤产生向鼻侧的收拢。
    for (const side of [-1, 1] as const) {
      const eyeX = 0.5 + side * 0.065;
      const eyeShift = multiply(head, translate(-side * squeeze * 0.005, 0));
      const open = 1 - blink * 0.82;
      primitives.push(
        ellipse(
          NODE_ID.face,
          pt(eyeX, 0.452),
          0.034,
          0.02 * open,
          eyeShift,
          PALETTE.eyeWhite,
        ),
        ellipse(
          NODE_ID.face,
          pt(eyeX, 0.452),
          0.0125,
          0.0125 * open,
          eyeShift,
          PALETTE.iris,
          1 - blink * 0.9,
        ),
      );
      // 眉：细长横椭圆，微笑时轻微下沉。
      primitives.push(
        ellipse(
          NODE_ID.face,
          pt(eyeX, 0.404),
          0.03,
          0.005,
          multiply(head, translate(0, smile * 0.004)),
          PALETTE.brow,
        ),
      );
      // 腮红：微笑浮现，颧升上提。
      primitives.push(
        ellipse(
          NODE_ID.face,
          pt(0.5 + side * 0.095, 0.515),
          0.028,
          0.016,
          multiply(head, translate(0, -cheek * 0.015)),
          PALETTE.skinShade,
          clamp(smile * 0.4, 0, 1),
        ),
      );
    }

    // 嘴：月牙形，微笑加大宽度、上挑嘴角并加深下缘弧度。
    const lx = 0.465 - smile * 0.008;
    const rxp = 0.535 + smile * 0.008;
    const cornerY = 0.575 - smile * 0.012;
    const dip = 0.588 + smile * 0.01;
    primitives.push(
      fillPath(
        NODE_ID.face,
        [
          { kind: "moveTo", point: pt(lx, cornerY) },
          {
            kind: "bezierCurveTo",
            control1: pt(0.48, dip),
            control2: pt(0.52, dip),
            point: pt(rxp, cornerY),
          },
          {
            kind: "bezierCurveTo",
            control1: pt(0.52, 0.577 + smile * 0.004),
            control2: pt(0.48, 0.577 + smile * 0.004),
            point: pt(lx, cornerY),
          },
          { kind: "closePath" },
        ],
        head,
        PALETTE.mouth,
      ),
    );

    return { values: {}, primitives };
  },
};
