import type {
  NodeDeclaration,
  RenderPrimitive,
} from "@lingfan-character/contracts";
import { chainOffsets, evaluateNoise } from "@lingfan-character/primitives";
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
 * 前发层节点：发帘、发梢与发顶高光，绘制序位于脸之上。
 * 发摆驱动整片发帘绕发根旋转并水平漂移，与后发的微转形成层间视差；
 * 发梢作为链条第二段以延迟与衰减跟随发帘，呈现扰动沿发丝传播的层次；
 * 风强参数经噪声原语给出持续漂移，与弹簧扰动正交叠加。
 */
export const hairFrontNode: NodeDeclaration = {
  id: NODE_ID.hairFront,
  reads: [
    SLOT.headTurn,
    SLOT.breathWave,
    SLOT.swingWave,
    SLOT.swingPulseAt,
    SLOT.swingPulseAmp,
    SLOT.swingPulseMs,
    SLOT.wind,
  ],
  writes: [],
  step: (inputs, tMs, substream) => {
    const turn = inputs.values[SLOT.headTurn] ?? 0;
    const breath = inputs.values[SLOT.breathWave] ?? 0;
    const swing = inputs.values[SLOT.swingWave] ?? 0;
    const pulseAt = inputs.values[SLOT.swingPulseAt] ?? -1;
    const pulseAmp = inputs.values[SLOT.swingPulseAmp] ?? 0;
    const pulseMs = inputs.values[SLOT.swingPulseMs] ?? 420;
    const wind = inputs.values[SLOT.wind] ?? 0;

    const base = multiply(
      headTransform(turn, breath),
      multiply(
        rotateAround(0.5, 0.3, swing * 0.03),
        translate(swing * 0.012, 0),
      ),
    );

    // 弹簧链：段 0 供发帘本体、段 1 供发梢（延迟 70ms、幅度乘 0.55）。
    let bangsOffset = 0;
    let tipOffset = 0;
    if (pulseAt >= 0) {
      const offsets = chainOffsets(
        {
          pulse: {
            t0: pulseAt,
            rest: 0,
            amplitude: pulseAmp,
            durationMs: pulseMs,
            cycles: 2,
          },
          segments: 2,
          delayMs: 70,
          decay: 0.55,
        },
        tMs,
      );
      bangsOffset = (offsets[0] ?? 0) * 0.02;
      tipOffset = (offsets[1] ?? 0) * 0.045;
    }

    // 风场：两条独立相位的平滑噪声给出持续漂移，幅度由风强缩放。
    const gust =
      (evaluateNoise(
        { octaves: 2, frequency: 0.0012, lacunarity: 2, gain: 0.5 },
        tMs,
        substream,
      ) -
        0.5) *
      2 *
      wind;
    const gustTip =
      (evaluateNoise(
        { octaves: 2, frequency: 0.0016, lacunarity: 2, gain: 0.5 },
        tMs + 7777,
        substream,
      ) -
        0.5) *
      2 *
      wind;

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
      multiply(base, translate(bangsOffset + gust * 0.008, 0)),
      PALETTE.hairDark,
    );

    // 发梢两撇：从发帘下缘谷点垂下，吃链条第二段偏移，动幅大于发帘。
    const tipTransform = multiply(
      base,
      translate(tipOffset + gustTip * 0.014, 0),
    );
    const leftStrand = fillPath(
      NODE_ID.hairFront,
      [
        { kind: "moveTo", point: pt(0.415, 0.348) },
        {
          kind: "bezierCurveTo",
          control1: pt(0.392, 0.405),
          control2: pt(0.402, 0.41),
          point: pt(0.412, 0.428),
        },
        {
          kind: "bezierCurveTo",
          control1: pt(0.422, 0.392),
          control2: pt(0.428, 0.378),
          point: pt(0.43, 0.352),
        },
        { kind: "closePath" },
      ],
      tipTransform,
      PALETTE.hairDark,
    );
    const rightStrand = fillPath(
      NODE_ID.hairFront,
      [
        { kind: "moveTo", point: pt(0.585, 0.348) },
        {
          kind: "bezierCurveTo",
          control1: pt(0.608, 0.405),
          control2: pt(0.598, 0.41),
          point: pt(0.588, 0.428),
        },
        {
          kind: "bezierCurveTo",
          control1: pt(0.578, 0.392),
          control2: pt(0.572, 0.378),
          point: pt(0.57, 0.352),
        },
        { kind: "closePath" },
      ],
      tipTransform,
      PALETTE.hairDark,
    );

    const primitives: RenderPrimitive[] = [
      bangs,
      leftStrand,
      rightStrand,
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
