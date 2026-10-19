import type {
  NodeDeclaration,
  RenderPrimitive,
} from "@lingfan-character/contracts";
import { NODE_ID } from "../nodes";
import { SLOT } from "../shared";
import { clamp, ellipse, multiply, pt, translate } from "./geometry";
import { headTransform } from "./headMotion";
import { PALETTE } from "./palette";

/**
 * 脸部节点：脸基形、眉眼与腮红，全部程序生成；嘴部独立成节点。
 * 转头是朝向视差：特征向转向侧扫动且按深度分档（鼻 > 五官 > 脸缘），
 * 同组特征转向侧位移略大，脸基形可见宽度随朝向收窄；不做整头旋转。
 * 眼睛由眼白、虹膜、瞳孔与上眼睑构成，眨眼是眼睑下移的物理遮挡，
 * 虹膜与瞳孔随朝向额外偏移表达视线跟随；微笑放大嘴角上挑并浮现腮红，
 * 颧升（耦合链产出）把腮红向上提，眼挤让双眼向鼻侧收拢。
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

    // 脸基形：随朝向轻微偏移并收窄可见宽度（2.5D 侧转的体感来源）。
    const primitives: RenderPrimitive[] = [
      ellipse(
        NODE_ID.face,
        pt(0.5 + turn * 0.014, 0.47),
        0.19 * (1 - Math.abs(turn) * 0.1),
        0.235,
        head,
        PALETTE.skin,
      ),
      ellipse(
        NODE_ID.face,
        pt(0.5 + turn * 0.03, 0.525),
        0.009,
        0.014,
        head,
        PALETTE.skinShade,
        0.55,
      ),
    ];

    // 双眼：眼白、虹膜、瞳孔三层，上眼睑停在眼裂上缘，眨眼时下移遮蔽；
    // 眼挤产生向鼻侧的收拢，转头按左右深度产生分档扫动，虹膜瞳孔
    // 再叠加视线跟随。基元顺序即层叠顺序，眼睑必须晚于瞳孔。
    for (const side of [-1, 1] as const) {
      const eyeX = 0.5 + side * 0.065;
      const turnShift = turn * (0.024 + side * 0.007);
      const eyeShift = multiply(
        head,
        translate(-side * squeeze * 0.005 + turnShift, 0),
      );
      const gazeShift = multiply(eyeShift, translate(turn * 0.008, 0));
      const lidY = 0.411 + blink * 0.041;
      primitives.push(
        ellipse(
          NODE_ID.face,
          pt(eyeX, 0.452),
          0.036,
          0.023,
          eyeShift,
          PALETTE.eyeWhite,
        ),
        ellipse(
          NODE_ID.face,
          pt(eyeX, 0.452),
          0.01,
          0.014,
          gazeShift,
          PALETTE.iris,
        ),
        ellipse(
          NODE_ID.face,
          pt(eyeX, 0.452),
          0.005,
          0.005,
          gazeShift,
          PALETTE.pupil,
        ),
        ellipse(
          NODE_ID.face,
          pt(eyeX, lidY),
          0.042,
          0.03,
          eyeShift,
          PALETTE.skin,
        ),
      );
      // 眉：细长横椭圆，随朝向扫动，微笑时轻微下沉。
      primitives.push(
        ellipse(
          NODE_ID.face,
          pt(eyeX, 0.404),
          0.03,
          0.005,
          multiply(head, translate(turnShift, smile * 0.004)),
          PALETTE.brow,
        ),
      );
      // 腮红：微笑浮现，随朝向扫动，颧升上提。
      primitives.push(
        ellipse(
          NODE_ID.face,
          pt(0.5 + side * 0.095, 0.515),
          0.028,
          0.016,
          multiply(
            head,
            translate(turn * 0.026 + side * turn * 0.007, -cheek * 0.015),
          ),
          PALETTE.skinShade,
          clamp(smile * 0.4, 0, 1),
        ),
      );
    }

    return { values: {}, primitives };
  },
};
