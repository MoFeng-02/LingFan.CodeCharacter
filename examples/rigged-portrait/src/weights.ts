/**
 * 权重场：把归一化坐标映射到「每根骨骼的牵引强度」。
 *
 * 是什么：BONE_ORDER 顺序的权重表生成器——每个网格顶点得到一组非负
 *         权重，和为 1，表示它被哪些骨骼共同牵引。
 * 为什么：单图蒙皮的质量全在权重上。画师画的是一张整图，没有分层可以
 *         分别驱动；只能靠「哪块像素归哪根骨骼管」来表达解耦。
 *         权重按椭圆区域平滑衰减并归一化，重叠区的顶点被多根骨骼同时
 *         牵引，形变因此连续——硬边界会在区域交界处把画面撕开。
 * 怎么用：配方节点在构造期对静止网格调一次 buildWeightTable，
 *         求得权重表缓存；每帧只做「权重 × 骨骼变换」的混合。
 * 注意事项：权重表与时间无关（只依赖静止坐标），因此可在构造期算好；
 *          归一化保证凸组合，顶点不会因权重和偏离 1 而被缩放。
 */

import type { NormalizedPoint } from "@lingfan-character/contracts";
import {
  BONE,
  BONE_ANCHOR,
  BONE_ORDER,
  BONE_RADIUS,
  ROOT_BASE_WEIGHT,
  type BoneId,
} from "./shared";

/** 单顶点权重：与 BONE_ORDER 等长的非负重数组，求和为 1。 */
export type WeightRow = readonly number[];

/** 一层权重表：行优先，行数 = 顶点数，列数 = 骨骼数。 */
export type WeightTable = readonly WeightRow[];

/**
 * 抛物线衰减：椭圆区域内 1 → 边界 0，区域外恒 0。
 * 除以半径后取 1−r² 是对二次式的复用，只有四则运算。
 */
function falloff(
  point: NormalizedPoint,
  anchor: { x: number; y: number },
  radius: { rx: number; ry: number },
): number {
  const dx = (point.x - anchor.x) / radius.rx;
  const dy = (point.y - anchor.y) / radius.ry;
  const q = 1 - dx * dx - dy * dy;
  return q > 0 ? q : 0;
}

/**
 * 生成一张顶点的权重行：根骨骼拿固定基础权重，其余骨骼按区域衰减，
 * 最后整行归一化。区域全不覆盖的顶点（画布角落）归路只有根基权，
 * 于是它保持静止——这正是想要的：背景角落不该随角色摆动。
 */
export function weightsAt(point: NormalizedPoint): WeightRow {
  const raw: number[] = [];
  for (const bone of BONE_ORDER) {
    if (bone === BONE.root) {
      raw.push(ROOT_BASE_WEIGHT);
    } else {
      raw.push(falloff(point, BONE_ANCHOR[bone], BONE_RADIUS[bone]));
    }
  }

  let total = 0;
  for (const weight of raw) total += weight;
  // 根基权恒为正，total 不可能为 0；这里不加兜底分支，避免掩盖权重配置错误。
  return raw.map((weight) => weight / total);
}

/** 对整张静止网格生成权重表：行优先，与顶点表一一对应。 */
export function buildWeightTable(
  rest: readonly NormalizedPoint[],
): WeightTable {
  return rest.map(weightsAt);
}

/** 骨骼索引：把骨骼标识换成权重表的列号，避免每帧字符串查找。 */
export function boneIndexOf(bone: BoneId): number {
  return BONE_ORDER.indexOf(bone);
}
