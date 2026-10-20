import type {
  NodeDeclaration,
  RenderPrimitive,
} from "@lingfan-character/contracts";
import { chainOffsets, evaluateNoise } from "@lingfan-character/primitives";
import { NODE_ID } from "../nodes";
import { SLOT } from "../shared";
import { ellipse, fillPath, pt } from "./geometry";
import { headTransform } from "./headMotion";
import { PALETTE } from "./palette";

/**
 * 饰品层节点：两侧发卡与双段链条耳坠，绘制序的最上层。
 * 耳坠是受控链条的可视化：耳钉为挂点，坠体作为链条末段以延迟与衰减
 * 跟随扰动；转头时坠体反向滞后，风场经噪声原语给出持续微摆。
 */
export const accessoryNode: NodeDeclaration = {
  id: NODE_ID.accessory,
  reads: [
    SLOT.headTurn,
    SLOT.breathWave,
    SLOT.swingPulseAt,
    SLOT.swingPulseAmp,
    SLOT.swingPulseMs,
    SLOT.wind,
  ],
  writes: [],
  step: (inputs, tMs, substream) => {
    const turn = inputs.values[SLOT.headTurn] ?? 0;
    const breath = inputs.values[SLOT.breathWave] ?? 0;
    const pulseAt = inputs.values[SLOT.swingPulseAt] ?? -1;
    const pulseAmp = inputs.values[SLOT.swingPulseAmp] ?? 0;
    const pulseMs = inputs.values[SLOT.swingPulseMs] ?? 420;
    const wind = inputs.values[SLOT.wind] ?? 0;
    const head = headTransform(turn, breath);

    const primitives: RenderPrimitive[] = [];
    // 发卡：左右各一枚菱形贴片。
    for (const side of [-1, 1] as const) {
      const x = 0.5 + side * 0.2;
      primitives.push(
        fillPath(
          NODE_ID.accessory,
          [
            { kind: "moveTo", point: pt(x, 0.3) },
            { kind: "lineTo", point: pt(x + side * 0.025, 0.33) },
            { kind: "lineTo", point: pt(x, 0.36) },
            { kind: "lineTo", point: pt(x - side * 0.025, 0.33) },
            { kind: "closePath" },
          ],
          head,
          PALETTE.pin,
        ),
      );
    }

    // 耳坠链条：与发帘共享同一扰动锚点，段 1（末段）驱动坠体。
    let dangleOffset = 0;
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
          delayMs: 90,
          decay: 0.6,
        },
        tMs,
      );
      dangleOffset = (offsets[1] ?? 0) * 0.04;
    }
    // 风：独立相位的平滑噪声；转头滞后：坠体向转头反方向甩。
    const gust =
      (evaluateNoise(
        { octaves: 2, frequency: 0.001, lacunarity: 2, gain: 0.5 },
        tMs + 3333,
        substream,
      ) -
        0.5) *
      2 *
      wind;
    const lag = -turn * 0.012;

    for (const side of [-1, 1] as const) {
      const earX = 0.5 + side * 0.183;
      const earY = 0.505;
      // 耳钉：链条挂点，不吃偏移。
      primitives.push(
        ellipse(
          NODE_ID.accessory,
          pt(earX, earY),
          0.008,
          0.008,
          head,
          PALETTE.pin,
          1,
        ),
      );
      // 坠体：菱形挂在耳钉下方，水平偏移 = 链条回摆 + 风 + 转头滞后。
      const dangleX = earX + dangleOffset + gust * 0.01 + lag;
      const dangleY = earY + 0.042;
      primitives.push(
        fillPath(
          NODE_ID.accessory,
          [
            { kind: "moveTo", point: pt(dangleX, dangleY - 0.02) },
            { kind: "lineTo", point: pt(dangleX + 0.011, dangleY) },
            { kind: "lineTo", point: pt(dangleX, dangleY + 0.02) },
            { kind: "lineTo", point: pt(dangleX - 0.011, dangleY) },
            { kind: "closePath" },
          ],
          head,
          PALETTE.pin,
        ),
      );
    }

    return { values: {}, primitives };
  },
};
