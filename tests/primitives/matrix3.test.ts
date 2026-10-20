import {
  multiplyMat4,
  rotationX,
  rotationY,
  rotationZ,
  transformPoint,
  viewMatrix,
} from "@lingfan-character/primitives";
import { describe, expect, it } from "vitest";

const HALF_PI = Math.PI / 2;

/**
 * 3D 旋转矩阵：采样视角到顶点变换的确定性数学。
 * 矩阵元素全部来自多项式三角与四则运算，判据检查精确锚点与两遍一致。
 */
describe("3D 旋转矩阵", () => {
  it("绕 y 轴旋转 90 度把 +x 转到 −z", () => {
    const p = transformPoint(rotationY(HALF_PI), { x: 1, y: 0, z: 0 });
    expect(p.x).toBeCloseTo(0, 9);
    expect(p.y).toBe(0);
    expect(p.z).toBeCloseTo(-1, 9);
  });

  it("绕 x 轴旋转 90 度把 +z 转到 −y（正角抬头）", () => {
    const p = transformPoint(rotationX(HALF_PI), { x: 0, y: 0, z: 1 });
    expect(p.x).toBe(0);
    expect(p.y).toBeCloseTo(-1, 9);
    expect(p.z).toBeCloseTo(0, 9);
  });

  it("旋转矩阵保持向量长度（正交性）", () => {
    const m = viewMatrix({ yaw: 0.9, pitch: -0.4, roll: 0.2 });
    const p = transformPoint(m, { x: 0.3, y: -0.8, z: 0.5 });
    const lengthSq = p.x * p.x + p.y * p.y + p.z * p.z;
    expect(lengthSq).toBeCloseTo(0.3 * 0.3 + 0.8 * 0.8 + 0.5 * 0.5, 8);
  });

  it("零角复合等于恒等", () => {
    const m = viewMatrix({ yaw: 0, pitch: 0, roll: 0 });
    const p = transformPoint(m, { x: 0.25, y: -0.5, z: 0.75 });
    expect(p.x).toBe(0.25);
    expect(p.y).toBe(-0.5);
    expect(p.z).toBe(0.75);
  });

  it("复合顺序符合定义且两遍逐位一致", () => {
    const view = { yaw: 0.7, pitch: 0.3, roll: -0.1 };
    const m = viewMatrix(view);
    const manual = multiplyMat4(
      rotationZ(view.roll),
      multiplyMat4(rotationX(view.pitch), rotationY(view.yaw)),
    );
    expect(Array.from(m)).toEqual(Array.from(manual));
    expect(Array.from(viewMatrix(view))).toEqual(Array.from(m));
  });
});
