import type {
  NodeDeclaration,
  RenderPrimitive,
  SlotName,
} from "@lingfan-character/contracts";
import { browDeform, cheekDeform, eyeDeform } from "../basis";
import { NODE_ID } from "../nodes";
import { SLOT } from "../shared";
import {
  clamp,
  ellipse,
  multiply,
  pt,
  rotateAround,
  translate,
} from "./geometry";
import { headTransform } from "./headMotion";
import { PALETTE } from "./palette";

/**
 * 脸部节点：脸基形、眉、眼、鼻与腮红，全部程序生成；嘴部独立成节点。
 * 转头是朝向视差：特征向转向侧扫动且按深度分档（鼻 > 五官 > 脸缘），
 * 同组特征转向侧位移略大，脸基形可见宽度随朝向收窄；不做整头旋转。
 * 表情基空间：眉（挑/皱）、眼（睑开合/视线/瞳孔）、鼻翼、颊左右独立，
 * 形变量由 basis/ 纯函数计算，与本节点的宏观波形（转头/眨眼/微笑/
 * 颧升/眼挤）正交叠加；基元顺序即层叠顺序，眼睑必须晚于瞳孔。
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
    SLOT.browRaiseL,
    SLOT.browRaiseR,
    SLOT.browFurrowL,
    SLOT.browFurrowR,
    SLOT.eyeOpenL,
    SLOT.eyeOpenR,
    SLOT.gazeX,
    SLOT.gazeY,
    SLOT.pupilDilate,
    SLOT.noseFlareL,
    SLOT.noseFlareR,
    SLOT.cheekRaiseL,
    SLOT.cheekRaiseR,
  ],
  writes: [],
  step: (inputs) => {
    const read = (slot: SlotName): number => inputs.values[slot] ?? 0;
    const turn = read(SLOT.headTurn);
    const breath = read(SLOT.breathWave);
    const smile = read(SLOT.smileWave);
    const blink = read(SLOT.blinkWave);
    const cheek = read(SLOT.cheekLift);
    const squeeze = read(SLOT.eyeSqueeze);
    const gazeX = read(SLOT.gazeX);
    const gazeY = read(SLOT.gazeY);
    const dilate = read(SLOT.pupilDilate);
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
        0.009 *
          (1 + 0.4 * Math.max(read(SLOT.noseFlareL), read(SLOT.noseFlareR))),
        0.014,
        head,
        PALETTE.skinShade,
        0.55,
      ),
    ];

    // 双眼：眼白、虹膜、瞳孔三层，上眼睑停在眼裂上缘，眨眼时下移遮蔽；
    // 睁闭基微调眼睑基线，视线基平移虹膜瞳孔，瞳孔基缩放瞳孔；
    // 眼挤产生向鼻侧的收拢，转头按左右深度产生分档扫动。
    for (const side of [-1, 1] as const) {
      const eyeX = 0.5 + side * 0.065;
      const turnShift = turn * (0.024 + side * 0.007);
      const open = read(side === -1 ? SLOT.eyeOpenL : SLOT.eyeOpenR);
      const eye = eyeDeform(open, gazeX, gazeY, dilate);
      const eyeShift = multiply(
        head,
        translate(-side * squeeze * 0.005 + turnShift, 0),
      );
      const gazeShift = multiply(
        eyeShift,
        translate(turn * 0.008 + eye.irisDx, eye.irisDy),
      );
      const lidY = 0.411 + blink * 0.041 + eye.lidShift;
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
          0.005 * eye.pupilScale,
          0.005 * eye.pupilScale,
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
      // 眉：细长横椭圆，挑/皱基定纵向与内倾，微笑轻微下沉。
      const raise = read(side === -1 ? SLOT.browRaiseL : SLOT.browRaiseR);
      const furrow = read(side === -1 ? SLOT.browFurrowL : SLOT.browFurrowR);
      const brow = browDeform(raise, furrow, side);
      const browY = 0.404 + brow.dy;
      primitives.push(
        ellipse(
          NODE_ID.face,
          pt(eyeX, browY),
          0.03 * brow.widthScale,
          0.005,
          multiply(
            head,
            multiply(
              translate(turnShift, smile * 0.004),
              rotateAround(eyeX, browY, brow.tilt),
            ),
          ),
          PALETTE.brow,
        ),
      );
      // 腮红：微笑浮现，颧升波形与颊升基共同上提。
      const cheekDy =
        -cheek * 0.015 +
        cheekDeform(read(side === -1 ? SLOT.cheekRaiseL : SLOT.cheekRaiseR));
      primitives.push(
        ellipse(
          NODE_ID.face,
          pt(0.5 + side * 0.095, 0.515),
          0.028,
          0.016,
          multiply(
            head,
            translate(turn * 0.026 + side * turn * 0.007, cheekDy),
          ),
          PALETTE.skinShade,
          clamp(smile * 0.4, 0, 1),
        ),
      );
    }

    return { values: {}, primitives };
  },
};
