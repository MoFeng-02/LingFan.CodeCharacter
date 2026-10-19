import type {
  NodeDeclaration,
  RenderPrimitive,
} from "@lingfan-character/contracts";
import { NODE_ID } from "../nodes";
import { SLOT } from "../shared";
import {
  ellipse,
  fillPath,
  multiply,
  pt,
  rotateAround,
  translate,
} from "./geometry";
import { headTransform } from "./headMotion";
import { PALETTE } from "./palette";

/**
 * 前发层节点：发帘与发顶高光，绘制序位于脸之上。
 * 发摆驱动整片发帘绕发根旋转并水平漂移，与后发的微转形成层间视差。
 */
export const hairFrontNode: NodeDeclaration = {
  id: NODE_ID.hairFront,
  reads: [SLOT.headTurn, SLOT.breathWave, SLOT.swingWave],
  writes: [],
  step: (inputs) => {
    const turn = inputs.values[SLOT.headTurn] ?? 0;
    const breath = inputs.values[SLOT.breathWave] ?? 0;
    const swing = inputs.values[SLOT.swingWave] ?? 0;
    const base = multiply(
      headTransform(turn, breath),
      multiply(
        rotateAround(0.5, 0.3, swing * 0.03),
        translate(swing * 0.012, 0),
      ),
    );

    // 发帘：上缘一条大拱，下缘三段内弧形成刘海瓣。
    const bangs = fillPath(
      NODE_ID.hairFront,
      [
        { kind: "moveTo", point: pt(0.295, 0.45) },
        {
          kind: "bezierCurveTo",
          control1: pt(0.31, 0.225),
          control2: pt(0.69, 0.225),
          point: pt(0.705, 0.45),
        },
        {
          kind: "bezierCurveTo",
          control1: pt(0.66, 0.4),
          control2: pt(0.635, 0.4),
          point: pt(0.615, 0.345),
        },
        {
          kind: "bezierCurveTo",
          control1: pt(0.575, 0.4),
          control2: pt(0.545, 0.4),
          point: pt(0.52, 0.345),
        },
        {
          kind: "bezierCurveTo",
          control1: pt(0.48, 0.4),
          control2: pt(0.45, 0.4),
          point: pt(0.425, 0.345),
        },
        {
          kind: "bezierCurveTo",
          control1: pt(0.395, 0.4),
          control2: pt(0.36, 0.41),
          point: pt(0.295, 0.45),
        },
        { kind: "closePath" },
      ],
      base,
      PALETTE.hairDark,
    );

    const primitives: RenderPrimitive[] = [
      bangs,
      ellipse(
        NODE_ID.hairFront,
        pt(0.45, 0.285),
        0.06,
        0.018,
        base,
        PALETTE.hairLight,
        0.5,
      ),
    ];
    return { values: {}, primitives };
  },
};
