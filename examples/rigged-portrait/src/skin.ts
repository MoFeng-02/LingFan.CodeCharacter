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

/**
 * 眼带纵向压缩：单图没有眼睑层，只能用几何压缩表达「眯眼」。
 * 作用域是椭圆权重，闭眼方向把眼带内顶点向上压向眼带中线。
 * 这是本方案最弱的一环——真实闭眼需要分层素材，此处只做观感近似。
 */
export function squeezeEyeBand(
  points: readonly NormalizedPoint[],
  blink: number,
  band: { x: number; y: number; rx: number; ry: number },
  squeeze: number,
): NormalizedPoint[] {
  if (blink === 0) return [...points];
  return points.map((point) => {
    const dx = (point.x - band.x) / band.rx;
    const dy = (point.y - band.y) / band.ry;
    const q = 1 - dx * dx - dy * dy;
    if (q <= 0) return point;
    // 压缩向眼带中线靠拢：越靠上下缘压缩越强，中线附近不动。
    const pull = q * blink * squeeze;
    return {
      x: point.x,
      y: point.y + (band.y - point.y) * pull,
    };
  });
}
