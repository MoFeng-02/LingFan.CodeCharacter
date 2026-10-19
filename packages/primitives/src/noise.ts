/**
 * 确定性平滑值噪声：一维值噪声加固定倍频程公式。
 *
 * 是什么：NoiseExpr 的求值器——整数格点哈希、平滑插值、逐倍频程求和后归一化。
 * 为什么：噪声算法与种子派生规则在契约中固定，保证两个实现跑同一角色结果重合。
 * 怎么用：域包在需要有机感的节点中调用 evaluateNoise(expr, tMs, substream)，
 *         substream.seed 来自内核派生的节点种子。
 * 注意事项：输出归一化到 0..1（各倍频程幅度加权和除以幅度总和）；
 *          每倍频程频率乘 lacunarity、幅度乘 gain、格点种子按倍频程序号偏移；
 *          插值权重为 smoothstep 多项式，全链路无超越函数。
 */

import type {
  NoiseExpr,
  RandomSubstream,
  TimeMs,
} from "@lingfan-character/contracts";

/** 整数格点哈希到 0..1：乘法混淆三轮，完全由格点与种子决定。 */
const latticeHash = (i: number, seed: number): number => {
  let h = Math.imul(i, 374761393) ^ Math.imul(seed, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

/** 一维值噪声：相邻格点哈希以 smoothstep 权重插值。 */
const valueNoise1D = (x: number, seed: number): number => {
  const i = Math.floor(x);
  const u = x - i;
  const w = u * u * (3 - 2 * u);
  const a = latticeHash(i, seed);
  const b = latticeHash(i + 1, seed);
  return a + (b - a) * w;
};

/** 倍频程偏移基数：各倍频程使用不同的格点种子偏移，避免倍频程间同格点相关。 */
const OCTAVE_OFFSET = 1013904223;

/** 噪声求值：同一声明、t 与种子恒得同一值。 */
export const evaluateNoise = (
  expr: NoiseExpr,
  tMs: TimeMs,
  substream: RandomSubstream,
): number => {
  let amplitude = 1;
  let frequency = expr.frequency;
  let total = 0;
  let weight = 0;
  for (let octave = 0; octave < expr.octaves; octave++) {
    const seed = (substream.seed + octave * OCTAVE_OFFSET) >>> 0;
    total += amplitude * valueNoise1D(tMs * frequency, seed);
    weight += amplitude;
    amplitude *= expr.gain;
    frequency *= expr.lacunarity;
  }
  return weight === 0 ? 0 : total / weight;
};
