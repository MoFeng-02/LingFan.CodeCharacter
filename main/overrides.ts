/**
 * 输入覆盖与切换过渡：滑杆与预设都只写「覆盖表」，每帧求值时读走，
 * 不做任何缓存。预设不直接改写覆盖值，而是生成重定向锚点，每帧把
 * 插值写进覆盖——切换永远值连续、不突兀；手动拖动即时生效并压制锚点。
 */

import type { SlotName } from "@lingfan-character/contracts";
import { DEFAULTS, SLOT, type SlotId } from "@lingfan-character/example-humanoid";
import {
  isTransitionDone,
  redirect,
  transitionValue,
  type Transition,
} from "../transition";
import { nowTMs } from "./clock";

/** 输入覆盖表：角色域唯一看到的「当前输入」。 */
export const overrides: Partial<Record<SlotName, number>> = {};

/** 切换锚点表由组合根持有；角色域只看到随时间连续变化的输入。 */
const transitions = new Map<SlotName, Transition>();

/**
 * 生成一次切换：目标值来自新预设（或复位回内置缺省），起点 =
 * 旧过渡当前值或现覆盖值。用户意图随时压制——手动滑杆清锚点。
 */
export function beginTransition(slot: SlotName, to: number): void {
  const previous = transitions.get(slot);
  const fallback = overrides[slot] ?? DEFAULTS[slot as SlotId] ?? 0;
  transitions.set(slot, redirect(previous, fallback, to, nowTMs(), "smoothstep"));
}

/** 每帧推进：过渡窗内写插值，走完固化目标值并清锚点。 */
export function tickTransitions(tMs: number): void {
  for (const [slot, tr] of transitions) {
    if (isTransitionDone(tr, tMs)) {
      overrides[slot] = tr.to;
      transitions.delete(slot);
    } else {
      overrides[slot] = transitionValue(tr, tMs);
    }
  }
}

/**
 * 弹簧扰动：转头与发摆滑杆的每次拖动都是一次扰动事件——组合根把
 * 扰动锚点（时刻、幅度、时长）写进覆盖，链条节点据此解析回摆。
 * 页面加载时滑杆初始化也会触发一次，作为开机的自然摆动。
 */
const PULSE_SLOTS: ReadonlySet<SlotName> = new Set<SlotName>([SLOT.turn, SLOT.swing]);
const PULSE_AMPLITUDE = 0.4;
const PULSE_MS = 420;

function triggerPulse(): void {
  overrides[SLOT.swingPulseAt] = nowTMs();
  overrides[SLOT.swingPulseAmp] = PULSE_AMPLITUDE;
  overrides[SLOT.swingPulseMs] = PULSE_MS;
}

/** 输入槽挂滑杆（各面板通用）：手动拖动即时生效并压制过渡锚点。 */
export function wireControls(): void {
  const inputs = document.querySelectorAll<HTMLInputElement>("[data-param]");
  for (const input of inputs) {
    const slot = input.dataset.param as SlotName | undefined;
    if (!slot) continue;
    const apply = () => {
      const value = Number.parseFloat(input.value);
      transitions.delete(slot);
      overrides[slot] = Number.isFinite(value) ? value : 0;
      if (PULSE_SLOTS.has(slot)) {
        triggerPulse();
      }
    };
    input.addEventListener("input", apply);
    apply();
  }
}
