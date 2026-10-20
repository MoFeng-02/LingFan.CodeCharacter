/**
 * 3D 旋转矩阵：把采样视角作用到几何顶点上的纯四则变换。
 *
 * 是什么：行主序 4×4 旋转矩阵与点变换，覆盖 yaw（绕 y）、pitch（绕 x）、
 *         roll（绕 z）三个采样自由度。
 * 为什么：3D 到 2D 的采样第一步是按视角旋转几何；矩阵乘法全部是
 *         IEEE 四则运算，三角函数值来自多项式三角，保证跨设备一致。
 * 怎么用：按需复合 rotationY/rotationX/rotationZ 得到视角矩阵，
 *         再用 transformPoint 逐顶点变换；投影取变换后顶点的 x、y
 *         映射回归一化平面，z 仅用于面深度排序。
 * 注意事项：矩阵为行主序数组；y 轴向下、z 轴朝观察者，与图层局部
 *          归一化 2D 坐标的图像习惯一致，投影无需翻转。
 */

import type { Vec3 } from "@lingfan-character/contracts";
import { polyCos, polySin } from "./angle";

/** 行主序 4×4 矩阵。 */
export type Mat4 = readonly number[];

/** 绕 y 轴旋转（转头）：正角把 +z 朝向转向 −x 侧。 */
export function rotationY(yaw: number): Mat4 {
  const c = polyCos(yaw);
  const s = polySin(yaw);
  return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1];
}

/** 绕 x 轴旋转（点头）：正角把 +z 朝向转向 −y 侧（抬头）。 */
export function rotationX(pitch: number): Mat4 {
  const c = polyCos(pitch);
  const s = polySin(pitch);
  return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1];
}

/** 绕 z 轴旋转（歪头）。 */
export function rotationZ(roll: number): Mat4 {
  const c = polyCos(roll);
  const s = polySin(roll);
  return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

/** 矩阵乘法：先应用 right，再应用 left。 */
export function multiplyMat4(left: Mat4, right: Mat4): Mat4 {
  const out = new Array<number>(16);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) {
        sum += left[row * 4 + k]! * right[k * 4 + col]!;
      }
      out[row * 4 + col] = sum;
    }
  }
  return out;
}

/** 用仿射部分变换一个点（末行按 [0,0,0,1] 处理）。 */
export function transformPoint(m: Mat4, v: Vec3): Vec3 {
  const xx = m[0]!;
  const xy = m[1]!;
  const xz = m[2]!;
  const xw = m[3]!;
  const yx = m[4]!;
  const yy = m[5]!;
  const yz = m[6]!;
  const yw = m[7]!;
  const zx = m[8]!;
  const zy = m[9]!;
  const zz = m[10]!;
  const zw = m[11]!;
  return {
    x: xx * v.x + xy * v.y + xz * v.z + xw,
    y: yx * v.x + yy * v.y + yz * v.z + yw,
    z: zx * v.x + zy * v.y + zz * v.z + zw,
  };
}

/** 按视角次序（roll ← pitch ← yaw）复合采样矩阵。 */
export function viewMatrix(view: {
  yaw: number;
  pitch: number;
  roll: number;
}): Mat4 {
  return multiplyMat4(
    rotationZ(view.roll),
    multiplyMat4(rotationX(view.pitch), rotationY(view.yaw)),
  );
}
