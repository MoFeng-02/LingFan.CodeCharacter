/**
 * 受控链条数学：解析弹簧响应与多段延迟跟随的参考实现。
 *
 * 是什么：springResponse 把一次扰动（锚点四元组：起始时刻、稳态值、幅度、
 *         时长、振荡周期数）解析为任意时刻的值——振荡用契比雪夫多项式
 *         T_n（它是 cos(nθ) 的精确多项式等价），包络用 (1−u)³ 幂衰减，
 *         因此整条响应只含四则运算与比较；chainOffsets 把同一脉冲按
 *         逐段延迟与幅度衰减展开成 N 段偏移，表达「扰动沿链条传播」。
 * 为什么：衣物、发梢、饰物需要「被拉一下会回摆」的手感，而迭代积分
 *         式物理必须跨帧保存状态，破坏两遍求值逐字节一致；解析式把
 *         物理退化成曲线——同一锚点在任意时刻重复求值结果一致，且
 *         窗口外固化稳态（没有完成事件，只有完成状态）。
 * 怎么用：组合根在扰动发生时生成锚点并经输入覆盖注入，配方节点对每段
 *         调 springResponse / chainOffsets 取偏移量叠加到几何上。
 * 注意事项：全部运算为 IEEE 双精度四则运算与整数比较，无超越函数；
 *          禁止在此引入计时器、缓存或任何跨调用状态；响应窗之外
 *          恒返回稳态值，窗边缘连续（包络在窗口末端为零）。
 */

import type { TimeMs } from "@lingfan-character/contracts";

/** 一次弹簧扰动的完整声明：全部字段由调用方显式给值。 */
export interface SpringPulse {
  /** 扰动起始时刻；此时刻之前与「时长」之后响应恒为稳态值。 */
  readonly t0: TimeMs;
  /** 稳态值：扰动平息后停留的位置。 */
  readonly rest: number;
  /** 初始幅度：相对稳态的最大偏移。 */
  readonly amplitude: number;
  /** 响应窗时长（毫秒）：窗内完成全部振荡与衰减。 */
  readonly durationMs: number;
  /** 窗内振荡周期数：1 = 单向弹出后回稳，2 = 一次过冲回摆，以此类推。 */
  readonly cycles: number;
}

/** 契比雪夫多项式 T_n：递推 T₀=1、T₁=x、Tₖ₊₁=2x·Tₖ−Tₖ₋₁，纯四则运算。 */
const chebyshev = (cycles: number, x: number): number => {
  if (cycles <= 0) return 1;
  let previous = 1;
  let current = x;
  for (let k = 2; k <= cycles; k += 1) {
    const next = 2 * x * current - previous;
    previous = current;
    current = next;
  }
  return current;
};

/** 单段解析弹簧：窗内 = 稳态 + 幅度·(1−u)³·T_cycles(1−2u)，窗外 = 稳态。 */
export const springResponse = (pulse: SpringPulse, tMs: TimeMs): number => {
  const elapsed = tMs - pulse.t0;
  if (elapsed <= 0) return pulse.rest;
  const u = elapsed / pulse.durationMs;
  if (u >= 1) return pulse.rest;
  const envelope = (1 - u) * (1 - u) * (1 - u);
  return (
    pulse.rest + pulse.amplitude * envelope * chebyshev(pulse.cycles, 1 - 2 * u)
  );
};

/** 链条展开声明：同一脉冲沿 N 段逐段延迟触发、幅度逐段衰减。 */
export interface ChainSpec {
  readonly pulse: SpringPulse;
  /** 链条段数（含首段），至少 1。 */
  readonly segments: number;
  /** 相邻段之间的触发延迟（毫秒）：扰动沿链传播的速度。 */
  readonly delayMs: number;
  /** 每段幅度相对前段的比例：0..1，0 = 只有首段动。 */
  readonly decay: number;
}

/**
 * 链条各段在 tMs 时刻相对稳态的偏移数组：段 k 等价于同一脉冲在
 * t − k·delay 触发且幅度乘 decay^k——求过去时刻的解析值是纯函数
 * 重算，不需要任何跨帧状态。
 */
export const chainOffsets = (
  spec: ChainSpec,
  tMs: TimeMs,
): readonly number[] => {
  const offsets: number[] = [];
  for (let k = 0; k < spec.segments; k += 1) {
    const delayed = springResponse(spec.pulse, tMs - k * spec.delayMs);
    let decayFactor = 1;
    for (let d = 0; d < k; d += 1) decayFactor *= spec.decay;
    offsets.push((delayed - spec.pulse.rest) * decayFactor);
  }
  return offsets;
};
