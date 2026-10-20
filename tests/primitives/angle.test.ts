import { polyCos, polySin } from "@lingfan-character/primitives";
import { describe, expect, it } from "vitest";

/**
 * 多项式三角：确定性 3D 采样的角度函数。
 * 断言全部以解析参考值与误差界表达——多项式是 IEEE 四则，
 * 同一输入在任何引擎逐位相同，因此判据关心的是与真值的距离。
 */
describe("多项式三角", () => {
  it("主值区间内与解析值之差不超过 1e-8", () => {
    expect(polySin(0)).toBe(0);
    expect(polyCos(0)).toBe(1);
    expect(polySin(Math.PI / 6)).toBeCloseTo(0.5, 8);
    expect(polyCos(Math.PI / 3)).toBeCloseTo(0.5, 8);
    expect(polySin(Math.PI / 2)).toBeCloseTo(1, 8);
    expect(polyCos(Math.PI)).toBeCloseTo(-1, 8);
  });

  it("任意角度经主值归约后保持正确", () => {
    expect(polySin((7 * Math.PI) / 6)).toBeCloseTo(-0.5, 8);
    expect(polySin(-(7 * Math.PI) / 6)).toBeCloseTo(0.5, 8);
    expect(polyCos(4 * Math.PI)).toBeCloseTo(1, 8);
    expect(polySin(100.123)).toBeCloseTo(Math.sin(100.123), 8);
  });

  it("奇偶性与同角恒等成立", () => {
    const x = 0.7;
    expect(polySin(-x)).toBe(-polySin(x));
    expect(polyCos(-x)).toBe(polyCos(x));
    expect(polyCos(x) * polyCos(x) + polySin(x) * polySin(x)).toBeCloseTo(1, 9);
  });

  it("同一输入两遍求值逐位相同", () => {
    const x = 2.3456789;
    expect(polySin(x)).toBe(polySin(x));
    expect(polyCos(x)).toBe(polyCos(x));
  });
});
