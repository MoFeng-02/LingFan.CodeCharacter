import type {
  CurveExpr,
  NodeDeclaration,
  NoiseExpr,
} from "@lingfan-character/contracts";
import { evaluateCurve, evaluateNoise } from "@lingfan-character/primitives";
import { NODE_ID } from "../nodes";
import { SLOT } from "../shared";

/**
 * 呼吸节律曲线：4.2 秒一个周期，前半程 smoothstep 升到吸气峰，
 * 后半程以反向 smoothstep 抵消回落（缓动段区间外取边界值，
 * 回落段必须用「0 → -1」才能让静息与周期边界归零），近似正弦波形。
 */
const RHYTHM_MS = 4200;
const rhythm: CurveExpr = {
  kind: "cycle",
  periodMs: RHYTHM_MS,
  base: {
    kind: "sum",
    parts: [
      {
        kind: "easing",
        fromMs: 0,
        toMs: RHYTHM_MS / 2,
        easing: "smoothstep",
        fromValue: 0,
        toValue: 1,
      },
      {
        kind: "easing",
        fromMs: RHYTHM_MS / 2,
        toMs: RHYTHM_MS,
        easing: "smoothstep",
        fromValue: 0,
        toValue: -1,
      },
    ],
  },
};

/** 呼吸的微观不均匀感：低频二倍频程平滑值噪声。 */
const drift: NoiseExpr = {
  octaves: 2,
  frequency: 0.003,
  lacunarity: 2,
  gain: 0.5,
};

/**
 * 呼吸参数节点：基调决定节律幅度（基调为 0 时近乎静止），
 * 叠加小幅噪声漂移后钳制在 0..1。
 */
export const breathNode: NodeDeclaration = {
  id: NODE_ID.breath,
  reads: [SLOT.breath],
  writes: [SLOT.breathWave],
  step: (inputs, tMs, substream) => {
    const base = inputs.values[SLOT.breath] ?? 0;
    const wave = base * (0.5 + 0.5 * evaluateCurve(rhythm, tMs));
    const jitter = (evaluateNoise(drift, tMs, substream) - 0.5) * 0.06;
    const value = Math.min(1, Math.max(0, wave + base * jitter));
    return { values: { [SLOT.breathWave]: value } };
  },
};
