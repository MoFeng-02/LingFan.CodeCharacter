import type { NodeDeclaration, NoiseExpr } from "@lingfan-character/contracts";
import { evaluateNoise } from "@lingfan-character/primitives";
import { NODE_ID } from "../nodes";
import { SLOT } from "../shared";

/** 发摆噪声：三倍频程，频率略高以呈现发丝的细碎颤动。 */
const flutter: NoiseExpr = {
  octaves: 3,
  frequency: 0.0016,
  lacunarity: 2,
  gain: 0.5,
};

/**
 * 发摆参数节点：外部基调为主，叠加呼吸波的少量联动（躯干起伏
 * 带动发梢）与噪声颤动；输出钳制在 -1..1。
 */
export const swingNode: NodeDeclaration = {
  id: NODE_ID.swing,
  reads: [SLOT.swing, SLOT.breathWave],
  writes: [SLOT.swingWave],
  step: (inputs, tMs, substream) => {
    const base = inputs.values[SLOT.swing] ?? 0;
    const breath = inputs.values[SLOT.breathWave] ?? 0;
    const value =
      base * 0.8 +
      (breath - 0.5) * 0.1 +
      (evaluateNoise(flutter, tMs, substream) - 0.5) * 0.25;
    return { values: { [SLOT.swingWave]: Math.min(1, Math.max(-1, value)) } };
  },
};
