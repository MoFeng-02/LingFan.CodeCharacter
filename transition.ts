/**
 * 锚点重定向过渡引擎（06 #23「过渡与混合」的机制载体，组合根专用）。
 *
 * 是什么：把「切换」表达为显式锚点四元组 (t0, from, to, duration, easing)——
 *         参数在过渡窗内 = from + (to−from)·easing(clamp((t−t0)/duration))，
 *         窗后停在 to。新锚点在旧过渡未完成时到来 = 重定向（from = 旧过渡
 *         函数在切换时刻的值），因此任意密集的切换都保持值连续。
 * 为什么：突兀的本质 = 参数函数在切换点不连续；状态机跳变（直接改写
 *         覆盖值）正是阶跃源。锚点是显式输入，不在角色域留任何内部状态，
 *         与「时间主权在采样方」一致——锚点表由组合根持有并逐帧注入。
 * 怎么用：切换时 redirect(...) 生成锚点；每帧 transitionValue 求值写入
 *         覆盖，isTransitionDone 后固化目标值并清除锚点。
 * 注意事项：本模块是纯函数库——同一锚点在任意时刻重复求值结果逐字节
 *          一致；禁止在此引入计时器、缓存或任何跨调用状态。
 */

import type { EasingName, TimeMs } from "@lingfan-character/contracts";
import { applyEasing } from "@lingfan-character/primitives";

/** 一次切换的完整声明：起始时刻、起止值、时长与缓动。 */
export interface Transition {
  readonly t0: TimeMs;
  readonly from: number;
  readonly to: number;
  readonly duration: number;
  readonly easing: EasingName;
}

/** 过渡窗内按锚点插值，窗外停在目标值；任意时刻求值结果一致。 */
export function transitionValue(tr: Transition, tMs: TimeMs): number {
  const raw = tr.duration <= 0 ? 1 : (tMs - tr.t0) / tr.duration;
  const u = Math.min(Math.max(raw, 0), 1);
  return tr.from + (tr.to - tr.from) * applyEasing(tr.easing, u);
}

/** 过渡窗是否已经走完（走完后应固化目标值并清除锚点）。 */
export function isTransitionDone(tr: Transition, tMs: TimeMs): boolean {
  return tMs - tr.t0 >= tr.duration;
}

/** 幅度自适应时长：微表情短、大动作长，同把过渡压在 120~360ms。 */
export function autoDuration(from: number, to: number): number {
  const span = Math.min(Math.abs(to - from), 1);
  return 120 + 240 * span;
}

/**
 * 生成一次重定向锚点：切换点从「旧过渡当前值」（活跃时）或「当前覆盖
 * 值」（已固化/无过渡）出发——切换风暴下的值连续由此保证。
 */
export function redirect(
  previous: Transition | undefined,
  fallback: number,
  to: number,
  tMs: TimeMs,
  easing: EasingName,
): Transition {
  const from =
    previous !== undefined && !isTransitionDone(previous, tMs)
      ? transitionValue(previous, tMs)
      : fallback;
  return { t0: tMs, from, to, duration: autoDuration(from, to), easing };
}
