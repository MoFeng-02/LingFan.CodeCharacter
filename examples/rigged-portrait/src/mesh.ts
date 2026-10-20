/**
 * 静止网格：把一张整图切成 cols×rows 控制点构成的可形变薄片。
 *
 * 是什么：均匀网格生成器——顶点在 [0,1]² 上按行列等距排布，行优先。
 * 为什么：单图蒙皮的前提是「一张画变成一张网」。网格越密，形变越贴合
 *         原画轮廓与五官；代价是每帧逐单元贴图的填充次数随单元数线性增长。
 * 怎么用：配方在构造期调一次，得到的顶点表作为静止形态与权重表的输入；
 *         之后每帧只对它做蒙皮，不再重新生成。
 * 注意事项：顶点坐标是图层局部归一化值，与契约坐标系一致；
 *          网格覆盖整张图（含透明留白），留白区由权重表固定，不会跟着动。
 */

import type { NormalizedPoint } from "@lingfan-character/contracts";
import { GRID_COLS, GRID_ROWS } from "./shared";

/**
 * 生成静止网格：行优先，共 GRID_COLS × GRID_ROWS 个顶点。
 * 首行 y=0、末行 y=1；首列 x=0、末列 x=1——边界必须落在画布边缘，
 * 否则贴图会在四周留下未覆盖的缝。
 */
export function restGrid(): NormalizedPoint[] {
  const points: NormalizedPoint[] = [];
  for (let row = 0; row < GRID_ROWS; row += 1) {
    const y = row / (GRID_ROWS - 1);
    for (let col = 0; col < GRID_COLS; col += 1) {
      const x = col / (GRID_COLS - 1);
      points.push({ x, y });
    }
  }
  return points;
}
