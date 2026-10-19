/**
 * 采样条款契约：对外毫秒进、状态出；对内固定子步进。
 *
 * 是什么：采样网格声明、子步进策略与两个求值入口签名。
 * 为什么：采样密度归编排者，内部动力学子步进是实现细节——但子步进次数必须进契约，
 *         否则两个实现跑同一角色结果不重合；子步进与输出采样密度无关。
 * 怎么用：编排者按需选 t 调 computeAt，或按采样网格取 computeRange；
 *         域包在端口声明中携带自己的 SubstepPolicy。
 * 注意事项：换采样密度不换动作——同一 t 恒得同一 state(t)；
 *          计算为纯内存求值，契约采用异步外观以与编排宿主一致（返回已完成结果合规）。
 */

import type { CharacterState, TimeMs } from "./state";

/** 子步进策略：固定次数是唯一允许形态，次数属于契约。 */
export type SubstepPolicy = {
  readonly kind: "fixed";
  readonly count: number;
};

/** 采样网格：编排者声明的采样密度，毫秒步长。 */
export interface SampleGrid {
  readonly stepMs: number;
}

/** 单点求值：任意 t 得到该时刻的完整状态向量。 */
export type ComputeAt = (tMs: TimeMs) => Promise<CharacterState>;

/** 区间求值：按采样网格从 fromMs 到 toMs 逐点取状态，含两端。 */
export type ComputeRange = (
  fromMs: TimeMs,
  toMs: TimeMs,
  grid: SampleGrid,
) => Promise<readonly CharacterState[]>;
