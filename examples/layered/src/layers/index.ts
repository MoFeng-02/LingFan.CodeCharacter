/**
 * 各层静止几何：归一化舞台坐标下的均匀网格顶点表。
 *
 * 是什么：按层规格的区域矩形与网格密度生成静止控制点，行优先排列。
 * 为什么：分层素材的几何只由「该层在舞台上的覆盖区域」决定，是纯数据；
 *         位移规则全部交给形变场，几何与运动彻底解耦。
 * 怎么用：restLayer(spec) 产出该层静止顶点；层装配与测试共用。
 * 注意事项：顶点坐标 = 区域矩形内按 cols×rows 等分插值，边界包含在内；
 *          各层密度可不同（眼白与瞳孔不需要同样精细的网格）。
 */

import type { NormalizedPoint } from "@lingfan-character/contracts";
import type { LayerSpec } from "../shared";

/** 单层静止网格：区域矩形内均匀分布 cols×rows 个控制点，行优先。 */
export function restLayer(spec: LayerSpec): NormalizedPoint[] {
  const { x, y, width, height } = spec.rect;
  const points: NormalizedPoint[] = [];
  for (let row = 0; row < spec.rows; row += 1) {
    const vy = row / (spec.rows - 1);
    for (let col = 0; col < spec.cols; col += 1) {
      const vx = col / (spec.cols - 1);
      points.push({ x: x + width * vx, y: y + height * vy });
    }
  }
  return points;
}
