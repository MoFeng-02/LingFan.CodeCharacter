/**
 * 立体头部几何组装：头骨椭球 + 五官形变 + 发壳，呼吸统一缩放。
 *
 * 是什么：把细分椭球、特征位移与发壳三步编排为一个头部几何，
 *         返回头骨与发壳两个网格（各自配独立色带成两个立体基元）。
 * 为什么：几何生成的参数只有呼吸系数——呼吸是均匀缩放，转头由采样
 *         视角承担；三步都是确定常量运算，逐字节可指纹。
 * 怎么用：节点求值时调用 buildHead(breath)，把两个网格分别与
 *         SKIN_BANDS / HAIR_BANDS 组装成立体几何基元。
 * 注意事项：网格分段与特征表是确定常量；旧的单文件几何生成器已由
 *          本目录拆分取代。
 */

import { applyFeatures } from "./features";
import { buildHair, type HeadGeometry } from "./hair";
import { buildSkull } from "./skull";

export type { HeadGeometry } from "./hair";

/** 头骨三轴半径与网格分段：12×16 细分约 350 面，色带层次足够柔和。 */
const RADIUS_X = 0.62;
const RADIUS_Y = 0.78;
const RADIUS_Z = 0.72;
const LAT_SEGMENTS = 12;
const LON_SEGMENTS = 16;

export function buildHead(breath: number): {
  skull: HeadGeometry;
  hair: HeadGeometry;
} {
  const scale = 1 + breath * 0.04;
  const rx = RADIUS_X * scale;
  const ry = RADIUS_Y * scale;
  const rz = RADIUS_Z * scale;

  const skull = buildSkull(rx, ry, rz, LAT_SEGMENTS, LON_SEGMENTS);
  applyFeatures(skull);
  const hair = buildHair(rx, ry, rz);

  return {
    skull: { vertices: skull.vertices, faces: skull.faces },
    hair,
  };
}
