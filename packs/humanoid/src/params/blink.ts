import type { CurveExpr, NodeDeclaration } from "@lingfan-character/contracts";
import { evaluateCurve } from "@lingfan-character/primitives";
import { NODE_ID } from "../nodes";
import { SLOT } from "../shared";

/**
 * 眨眼节律曲线：3.7 秒一个周期，周期内 55%~60% 处以 easeInCubic
 * 快速闭合、60%~63% 以反向 easeOutCubic 抵消回落（前快后慢地睁开），
 * 其余时间两段边界值相加为 0，保持睁开。缓动段在区间外取边界值，
 * 因此回落段用「0 → -1」与闭合段的 1 相抵，而不是「1 → 0」。
 */
const RHYTHM_MS = 3700;
const rhythm: CurveExpr = {
  kind: "cycle",
  periodMs: RHYTHM_MS,
  base: {
    kind: "sum",
    parts: [
      {
        kind: "easing",
        fromMs: RHYTHM_MS * 0.55,
        toMs: RHYTHM_MS * 0.6,
        easing: "easeInCubic",
        fromValue: 0,
        toValue: 1,
      },
      {
        kind: "easing",
        fromMs: RHYTHM_MS * 0.6,
        toMs: RHYTHM_MS * 0.63,
        easing: "easeOutCubic",
        fromValue: 0,
        toValue: -1,
      },
    ],
  },
};

/**
 * 眨眼参数节点：外部基调与自动节律取较大者——外部随时可以主动
 * 闭眼，节律负责无人驱动时的自然眨眼。输出恒在 0..1。
 */
export const blinkNode: NodeDeclaration = {
  id: NODE_ID.blink,
  reads: [SLOT.blink],
  writes: [SLOT.blinkWave],
  step: (inputs, tMs) => {
    const external = inputs.values[SLOT.blink] ?? 0;
    const wave = Math.max(external, evaluateCurve(rhythm, tMs));
    return { values: { [SLOT.blinkWave]: Math.min(1, Math.max(0, wave)) } };
  },
};
