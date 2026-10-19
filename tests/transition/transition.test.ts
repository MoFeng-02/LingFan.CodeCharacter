import { describe, expect, it } from "vitest";
import {
  autoDuration,
  redirect,
  transitionValue,
  type Transition,
} from "../../transition";

/**
 * 06 #23「过渡与混合」的机制判据：切换 = 显式锚点重定向。
 * 突兀的本质是参数函数在切换点不连续——本组判据把「值连续、
 * 无状态、可重放」三条性质机械化验收。
 */

const linear = (
  from: number,
  to: number,
  t0: number,
  duration: number,
): Transition => ({
  t0,
  from,
  to,
  duration,
  easing: "smoothstep",
});

describe("锚点重定向过渡", () => {
  it("过渡窗内值连续：相邻采样差不超过缓动最大斜率给出的界", () => {
    const tr = linear(0, 1, 100, 300);
    let previous = transitionValue(tr, 100);
    for (let t = 101; t <= 400; t += 1) {
      const value = transitionValue(tr, t);
      // smoothstep 最大斜率 1.5，取 2 留浮点裕量
      expect(value - previous).toBeLessThanOrEqual((2 / 300) * 1);
      previous = value;
    }
  });

  it("中途重定向无跳变：新锚点在切换时刻的值等于旧过渡的当前值", () => {
    const first = linear(0, 1, 0, 300);
    const t1 = 150;
    const mid = transitionValue(first, t1);
    const second = redirect(first, 0, 0.3, t1, "smoothstep");
    expect(second.from).toBeCloseTo(mid, 12);
    expect(transitionValue(second, t1)).toBeCloseTo(mid, 12);
    // 切换后一小步仍贴着旧值走（斜率受缓动最大斜率约束），不产生阶跃
    const step = transitionValue(second, t1 + 1) - transitionValue(second, t1);
    expect(Math.abs(step)).toBeLessThanOrEqual(
      (1.5 * Math.abs(0.3 - mid)) / second.duration + 1e-9,
    );
  });

  it("走完后固化目标值：任意远的时刻都停在 to", () => {
    const tr = linear(0.2, 0.8, 0, 200);
    expect(transitionValue(tr, 200)).toBeCloseTo(0.8, 12);
    expect(transitionValue(tr, 10_000)).toBeCloseTo(0.8, 12);
  });

  it("纯函数可重放：同一锚点同一时刻重复求值逐字节一致", () => {
    const tr = redirect(linear(0, 1, 0, 300), 0, 0.5, 120, "smoothstep");
    for (const t of [0, 120, 250, 400, 900]) {
      expect(transitionValue(tr, t)).toBe(transitionValue(tr, t));
    }
  });

  it("幅度自适应时长：变化越大过渡越长，且压缩在 120~360ms 区间", () => {
    expect(autoDuration(0, 0.1)).toBeLessThan(autoDuration(0, 0.5));
    expect(autoDuration(0, 0.5)).toBeLessThan(autoDuration(0, 1));
    expect(autoDuration(0, 1)).toBe(360);
    expect(autoDuration(0, 0)).toBe(120);
    expect(autoDuration(0, 5)).toBe(360);
  });

  it("旧过渡已走完时重定向从现值直接出发", () => {
    const finished = linear(0, 1, 0, 100);
    const next = redirect(finished, 0.4, 0.6, 500, "smoothstep");
    expect(next.from).toBe(0.4);
  });
});
