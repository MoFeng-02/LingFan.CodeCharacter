/**
 * 蒙皮：把权重表与骨骼变换混合成顶点位移。
 *
 * 是什么：线性混合蒙皮（LBS）的二维版本——每个顶点的新坐标是
 *         「静止坐标经各骨骼变换后的结果」按权重加权平均。
 * 为什么：这是「画一张图、用骨骼驱动」的数学核心。位移随权重连续变化，
 *         相邻顶点之间不会突变，画面因此不会被撕开；同时整张图只有
 *         一份像素，长相 1:1 保留，不需要重画。
 * 怎么用：配方节点在构造期准备静止网格与权重表，每帧把骨骼变换传进来
 *         调一次，得到可直接写入 MeshPrimitive 的顶点表。
 * 注意事项：权重行求和为 1（由权重表保证），因此凸组合不会产生
 *          整体缩放或外扩；全零权重行不合法，权重表已排除该情形。
 */

import type {
  AffineTransform,
  NormalizedPoint,
} from "@lingfan-character/contracts";
import type { WeightTable } from "./weights";

/** 单点应用仿射变换：x' = a·x + c·y + e，y' = b·x + d·y + f。 */
function applyTransform(
  point: NormalizedPoint,
  transform: AffineTransform,
): NormalizedPoint {
  return {
    x: transform.a * point.x + transform.c * point.y + transform.e,
    y: transform.b * point.x + transform.d * point.y + transform.f,
  };
}

/**
 * 蒙皮整张网格：对每个顶点按权重混合各骨骼变换后的位置。
 * 返回新数组，不修改传入的静止网格（它会被反复复用）。
 */
export function skinVertices(
  rest: readonly NormalizedPoint[],
  weights: WeightTable,
  transforms: readonly AffineTransform[],
): NormalizedPoint[] {
  const skinned: NormalizedPoint[] = [];
  for (let index = 0; index < rest.length; index += 1) {
    const point = rest[index]!;
    const row = weights[index]!;
    let x = 0;
    let y = 0;
    for (let bone = 0; bone < row.length; bone += 1) {
      const weight = row[bone]!;
      if (weight === 0) continue;
      const placed = applyTransform(point, transforms[bone]!);
      x += weight * placed.x;
      y += weight * placed.y;
    }
    skinned.push({ x, y });
  }
  return skinned;
}

/** 开眼/闭眼两态之间是否已经可以省掉一条基元的最小不透明度。 */
export const OPAQUE_EPSILON = 1e-4;
