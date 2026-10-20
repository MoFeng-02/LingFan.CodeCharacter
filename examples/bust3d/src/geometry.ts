/**
 * 立体头骨几何生成器：参数化椭球与鼻梁楔块的纯函数网格。
 *
 * 是什么：以呼吸系数为唯一形变输入，生成头骨椭球（经纬分割）与贴附
 *         的鼻梁楔块顶点表与三角面索引。
 * 为什么：几何本身就是算出来的——呼吸是立体均匀缩放，转头由采样视角
 *         承担，几何生成不感知视角；全部运算为多项式三角与四则。
 * 怎么用：节点求值时以当前呼吸参数调用 buildHead，得到顶点表与面索引
 *         后组装成立体几何基元。
 * 注意事项：面顶点按「从外部看逆时针」排列（法线朝外），已由采样器
 *          判据锚定；分段数是确定常量，顶点表顺序稳定可指纹。
 */

import type { Face3, Vec3 } from "@lingfan-character/contracts";
import { polyCos, polySin } from "@lingfan-character/primitives";

/** 头骨三轴半径与网格分段数：确定常量，保证几何可指纹。 */
const RADIUS_X = 0.62;
const RADIUS_Y = 0.78;
const RADIUS_Z = 0.72;
const LAT_SEGMENTS = 5;
const LON_SEGMENTS = 8;

/** 鼻梁楔块：底面中心、半宽半高与突出深度（局部单位域）。 */
const NOSE = {
  cx: 0,
  cy: 0.04,
  cz: 0.6,
  halfWidth: 0.11,
  halfHeight: 0.16,
  tipZ: 0.88,
};

export interface HeadGeometry {
  readonly vertices: readonly Vec3[];
  readonly faces: readonly Face3[];
}

/**
 * 生成头骨网格：呼吸系数对三轴半径做均匀缩放。
 * 经纬分段顶点行优先排列，两端极点收束为单点；鼻梁楔块附在脸前。
 */
export function buildHead(breath: number): HeadGeometry {
  const scale = 1 + breath * 0.04;
  const rx = RADIUS_X * scale;
  const ry = RADIUS_Y * scale;
  const rz = RADIUS_Z * scale;
  const vertices: Vec3[] = [{ x: 0, y: -ry, z: 0 }];
  for (let lat = 1; lat < LAT_SEGMENTS; lat += 1) {
    const phi = (lat / LAT_SEGMENTS) * Math.PI;
    const ringY = -ry * polyCos(phi);
    const ringRadius = polySin(phi);
    for (let lon = 0; lon < LON_SEGMENTS; lon += 1) {
      const theta = (lon / LON_SEGMENTS) * 2 * Math.PI;
      vertices.push({
        x: rx * ringRadius * polyCos(theta),
        y: ringY,
        z: rz * ringRadius * polySin(theta),
      });
    }
  }
  vertices.push({ x: 0, y: ry, z: 0 });

  const faces: Face3[] = [];
  const top = 0;
  const bottom = vertices.length - 1;
  const ring = (lat: number, lon: number): number =>
    1 + (lat - 1) * LON_SEGMENTS + lon;

  for (let lon = 0; lon < LON_SEGMENTS; lon += 1) {
    const next = (lon + 1) % LON_SEGMENTS;
    faces.push({ a: top, b: ring(1, lon), c: ring(1, next) });
  }
  for (let lat = 1; lat < LAT_SEGMENTS - 1; lat += 1) {
    for (let lon = 0; lon < LON_SEGMENTS; lon += 1) {
      const next = (lon + 1) % LON_SEGMENTS;
      const a = ring(lat, lon);
      const b = ring(lat, next);
      const c = ring(lat + 1, next);
      const d = ring(lat + 1, lon);
      faces.push({ a, b, c });
      faces.push({ a, b: c, c: d });
    }
  }
  for (let lon = 0; lon < LON_SEGMENTS; lon += 1) {
    const next = (lon + 1) % LON_SEGMENTS;
    faces.push({
      a: bottom,
      b: ring(LAT_SEGMENTS - 1, next),
      c: ring(LAT_SEGMENTS - 1, lon),
    });
  }

  const noseBase = vertices.length;
  vertices.push(
    { x: NOSE.cx - NOSE.halfWidth, y: NOSE.cy - NOSE.halfHeight, z: NOSE.cz },
    { x: NOSE.cx + NOSE.halfWidth, y: NOSE.cy - NOSE.halfHeight, z: NOSE.cz },
    { x: NOSE.cx + NOSE.halfWidth, y: NOSE.cy + NOSE.halfHeight, z: NOSE.cz },
    { x: NOSE.cx - NOSE.halfWidth, y: NOSE.cy + NOSE.halfHeight, z: NOSE.cz },
    { x: NOSE.cx, y: NOSE.cy, z: NOSE.tipZ },
  );
  const [n0, n1, n2, n3, tip] = [
    noseBase,
    noseBase + 1,
    noseBase + 2,
    noseBase + 3,
    noseBase + 4,
  ];
  faces.push({ a: n0!, b: n1!, c: tip! });
  faces.push({ a: n1!, b: n2!, c: tip! });
  faces.push({ a: n2!, b: n3!, c: tip! });
  faces.push({ a: n3!, b: n0!, c: tip! });

  return { vertices, faces };
}
