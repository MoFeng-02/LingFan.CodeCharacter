import { describe, expect, it } from "vitest";
import { chainOffsets, springResponse } from "@lingfan-character/primitives";

import type { SpringPulse } from "@lingfan-character/primitives";

/** 统一测试锚点：稳态 0、幅度 1、窗 300ms。 */
const pulse = (overrides: Partial<SpringPulse> = {}): SpringPulse => ({
  t0: 1000,
  rest: 0,
  amplitude: 1,
  durationMs: 300,
  cycles: 2,
  ...overrides,
});

describe("受控链条：解析弹簧与延迟跟随", () => {
  it("扰动前静止在稳态，扰动自锚点之后展开，窗外固化在稳态", () => {
    const p = pulse({ rest: 0.5, amplitude: 0.3 });
    expect(springResponse(p, 999)).toBe(0.5);
    expect(springResponse(p, 1000)).toBe(0.5);
    expect(springResponse(p, 1010)).not.toBe(0.5);
    expect(springResponse(p, 1300)).toBe(0.5);
    expect(springResponse(p, 5000)).toBe(0.5);
  });

  it("窗口末端连续收敛：包络在窗边界归零，无跳变", () => {
    const p = pulse({ amplitude: 1 });
    const nearEnd = springResponse(p, 1299);
    expect(Math.abs(nearEnd)).toBeLessThan(1e-3);
    expect(springResponse(p, 1300)).toBe(0);
  });

  it("振荡周期数越深回摆越深：双周期在窗中段的反相值大于单周期", () => {
    const single = pulse({ cycles: 1 });
    const double = pulse({ cycles: 2 });
    const probe = 1150;
    const singleMid = springResponse(single, probe);
    const doubleMid = springResponse(double, probe);
    expect(doubleMid).toBeLessThan(0);
    expect(Math.abs(doubleMid)).toBeGreaterThan(Math.abs(singleMid));
  });

  it("同一锚点重复采样逐字节一致（确定性重放）", () => {
    const p = pulse({ rest: 0.3, amplitude: -0.2, cycles: 3 });
    const first: number[] = [];
    const second: number[] = [];
    for (let t = 900; t <= 1400; t += 37) {
      first.push(springResponse(p, t));
      second.push(springResponse(p, t));
    }
    expect(second).toEqual(first);
  });

  it("链条按段延迟触发：扰动时刻后段尚未起动", () => {
    const offsets = chainOffsets(
      { pulse: pulse(), segments: 3, delayMs: 60, decay: 0.6 },
      1010,
    );
    expect(offsets[0]).not.toBe(0);
    expect(offsets[1]).toBe(0);
    expect(offsets[2]).toBe(0);
    const later = chainOffsets(
      { pulse: pulse(), segments: 3, delayMs: 60, decay: 0.6 },
      1200,
    );
    expect(later[1]).not.toBe(0);
    expect(later[2]).not.toBe(0);
  });

  it("链条幅度逐段衰减：段峰值不超过前段乘衰减", () => {
    const spec = {
      pulse: pulse({ amplitude: 0.8 }),
      segments: 3,
      delayMs: 60,
      decay: 0.5,
    } as const;
    let firstPeak = 0;
    let secondPeak = 0;
    for (let t = 1000; t <= 1400; t += 5) {
      const [a, b] = chainOffsets(spec, t);
      firstPeak = Math.max(firstPeak, Math.abs(a ?? 0));
      secondPeak = Math.max(secondPeak, Math.abs(b ?? 0));
    }
    expect(secondPeak).toBeGreaterThan(0);
    expect(secondPeak).toBeLessThanOrEqual(firstPeak * 0.5 + 1e-12);
  });

  it("零幅度链条恒为全零偏移", () => {
    const offsets = chainOffsets(
      { pulse: pulse({ amplitude: 0 }), segments: 4, delayMs: 50, decay: 0.7 },
      1150,
    );
    expect(offsets.every((value) => value === 0)).toBe(true);
  });
});
