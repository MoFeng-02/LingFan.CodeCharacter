/**
 * 形变场参数节点：把配方输入换算成各层共享的位移参数。
 *
 * 是什么：唯一一处把「呼吸/眨眼/视线/朝向/微笑/张口/风/扰动」换算成
 *         位移标量的节点，写出一组 field 槽位供各层读取。
 * 为什么：参数换算集中在此，层节点只做「读参数 + 套场」——同一参数在
 *         十二层里必然得到同一结果，不会因为各层各自换算而漂移；
 *         噪声与受控链条同属算法原语，在此调用一次即全局一致。
 * 怎么用：内核按拓扑序先求本节点，再求各层外观节点。
 * 注意事项：本节点不产基元（primitives 缺省空）；呼吸曲线用周期脉冲
 *          （上升段 + 反向抵消段），保证无静息偏移；扰动锚点缺省为
 *          过去时刻，故缺省时刻恒处于「已平息」状态。
 */

import type { CurveExpr, NodeStep } from "@lingfan-character/contracts";
import {
  chainOffsets,
  evaluateCurve,
  evaluateNoise,
} from "@lingfan-character/primitives";
import {
  BREATH_GAIN,
  BREATH_PERIOD_MS,
  BROW_OPEN_GAIN,
  BROW_SMILE_GAIN,
  FIELD_NODE_ID,
  FIELD_SLOT,
  GAZE_X_GAIN,
  GAZE_Y_GAIN,
  LID_TRAVEL,
  MOUTH_OPEN_GAIN,
  SLOT,
  SWING_GAIN,
  TURN_SHIFT_GAIN,
  WIND_GAIN,
  WIND_NOISE,
} from "./shared";

/** 呼吸节律：4.2 秒周期，上升段与反向抵消段构成无静息偏移的脉冲。 */
const BREATH_CYCLE: CurveExpr = {
  kind: "sum",
  parts: [
    {
      kind: "cycle",
      periodMs: BREATH_PERIOD_MS,
      base: {
        kind: "easing",
        easing: "smoothstep",
        fromMs: 0,
        toMs: BREATH_PERIOD_MS / 2,
        fromValue: 0,
        toValue: 1,
      },
    },
    {
      kind: "cycle",
      periodMs: BREATH_PERIOD_MS,
      base: {
        kind: "easing",
        easing: "smoothstep",
        fromMs: BREATH_PERIOD_MS / 2,
        toMs: BREATH_PERIOD_MS,
        fromValue: 0,
        toValue: -1,
      },
    },
  ],
};

/** 发层抖动：两段延迟跟随，第二段幅度衰减到六成。 */
const SWING_SEGMENTS = 2;
const SWING_DELAY_MS = 70;
const SWING_DECAY = 0.55;

/** 参数节点读取的输入槽位。 */
export const fieldReads = [
  SLOT.breathe,
  SLOT.blink,
  SLOT.gazeX,
  SLOT.gazeY,
  SLOT.headTurn,
  SLOT.smile,
  SLOT.mouthOpen,
  SLOT.wind,
  SLOT.swingAt,
  SLOT.swingAmp,
  SLOT.swingMs,
] as const;

/** 参数节点写出的场槽位：全部为输出槽，供各层读取。 */
export const fieldWrites = [
  FIELD_SLOT.breathScale,
  FIELD_SLOT.turnShift,
  FIELD_SLOT.swingOffset,
  FIELD_SLOT.lidTravel,
  FIELD_SLOT.gazeShiftX,
  FIELD_SLOT.gazeShiftY,
  FIELD_SLOT.browLift,
  FIELD_SLOT.mouthShape,
  FIELD_SLOT.windShiftX,
  FIELD_SLOT.windShiftY,
] as const;

/** 场参数求值：输入 → 十个位移标量，全部为标量四则运算。 */
export const fieldStep: NodeStep = (inputs, tMs, substream) => {
  const read = (slot: string): number => inputs.values[slot] ?? 0;
  const breathe = read(SLOT.breathe);
  const headTurn = read(SLOT.headTurn);
  const smile = read(SLOT.smile);
  const mouthOpen = read(SLOT.mouthOpen);
  const wind = read(SLOT.wind);

  const breathPhase = evaluateCurve(BREATH_CYCLE, tMs);
  const windPhase = evaluateNoise(WIND_NOISE, tMs, substream) * 2 - 1;

  // 扰动锚点：幅度为 0 或不曾触发时链条恒输出零，故缺省状态无需特判。
  const swing = chainOffsets(
    {
      pulse: {
        t0: read(SLOT.swingAt),
        rest: 0,
        amplitude: read(SLOT.swingAmp),
        durationMs: Math.max(1, read(SLOT.swingMs)),
        cycles: 1,
      },
      segments: SWING_SEGMENTS,
      delayMs: SWING_DELAY_MS,
      decay: SWING_DECAY,
    },
    tMs,
  );
  const swingOffset = (swing[0] ?? 0) * SWING_GAIN;

  // 抖动幅度随风强度增长，方向由噪声相位决定；纵向量取四成避免横向拉扯。
  const windMagnitude = wind * (0.4 + 0.6 * Math.abs(windPhase)) * WIND_GAIN;

  return {
    values: {
      [FIELD_SLOT.breathScale]: 1 + BREATH_GAIN * breathPhase * breathe,
      [FIELD_SLOT.turnShift]: headTurn * TURN_SHIFT_GAIN,
      [FIELD_SLOT.swingOffset]: swingOffset,
      [FIELD_SLOT.lidTravel]: read(SLOT.blink) * LID_TRAVEL,
      [FIELD_SLOT.gazeShiftX]: read(SLOT.gazeX) * GAZE_X_GAIN,
      [FIELD_SLOT.gazeShiftY]: read(SLOT.gazeY) * GAZE_Y_GAIN,
      [FIELD_SLOT.browLift]: -(
        smile * BROW_SMILE_GAIN +
        mouthOpen * BROW_OPEN_GAIN
      ),
      [FIELD_SLOT.mouthShape]: mouthOpen * MOUTH_OPEN_GAIN,
      [FIELD_SLOT.windShiftX]: windMagnitude * (windPhase >= 0 ? 1 : -1),
      [FIELD_SLOT.windShiftY]: windMagnitude * 0.4,
    },
  };
};

/** 参数节点声明：无基元、只写场槽位。 */
export const fieldParamsNode = {
  id: FIELD_NODE_ID,
  reads: fieldReads,
  writes: fieldWrites,
  step: fieldStep,
} as const;
