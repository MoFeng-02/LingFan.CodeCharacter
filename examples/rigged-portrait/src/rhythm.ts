/**
 * 节律：与时间相关的确定值都从这里取。
 *
 * 是什么：呼吸周期曲线——4.2 秒一个来回，上升段从 0 到 1、反向抵消段
 *         从 0 到 −1，两段叠加后是「无静息偏移的脉冲」。
 * 为什么：相位必须是 t 的纯函数。任何用 Math.sin 或累积计时的写法都会
 *         让两遍求值不一致，也会让跨引擎结果漂移；曲线表达式只有四则
 *         与白名单缓动，天然满足确定性。
 * 怎么用：外观节点每帧调 breathPhase(tMs) 取 −1..1 的相位，
 *         乘上呼吸幅度即为实际起伏。
 * 注意事项：周期与分段边界必须对齐（两段各占半个周期），
 *          否则脉冲在周期接缝处会跳变。
 */

import type { CurveExpr } from "@lingfan-character/contracts";
import { evaluateCurve } from "@lingfan-character/primitives";
import { BREATH_PERIOD_MS } from "./shared";

/** 呼吸曲线：半个周期上升、半个周期回落，整体均值为零。 */
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

/** 呼吸相位：返回 −1..1，负值为呼气回落段。 */
export function breathPhase(tMs: number): number {
  return evaluateCurve(BREATH_CYCLE, tMs);
}
