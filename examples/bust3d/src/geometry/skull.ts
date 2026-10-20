/**
 * 头骨椭球网格：经纬细分球面，顶点行优先、两极收束为单点。
 *
 * 是什么：可指定分段数的参数化椭球，同时保留球面坐标索引——五官形变
 *         与发际线剔除都需要按（纬度、经度）定位顶点。
 * 为什么：细分密度与五官形变都是确定常量运算，几何可指纹；不感知视角，
 *         转头由采样器承担。
 * 怎么用：buildSkull 得到球面网格，再交给五官形变；buildHair 独立成壳。
 * 注意事项：面顶点按「从外部看逆时针」排列（法线朝外），由采样器判据锚定。
 */

import type { Face3, Vec3 } from "@lingfan-character/contracts";
import { polyCos, polySin } from "@lingfan-character/primitives";

/** 球面网格：几何本体 + 网格坐标的换算入口。 */
export interface SphereMesh {
  vertices: Vec3[];
  faces: Face3[];
  /** 纬度环数（不含两极）。 */
  latCount: number;
  /** 经度分段数。 */
  lonCount: number;
  /** 环上顶点索引（lat 从 1 起，lon 取模回绕；两极是首尾单点）。 */
  ringIndex(lat: number, lon: number): number;
  /** 纬度环对应的极角 φ（0=下极，π=上极）。 */
  phiOf(lat: number): number;
}

/**
 * 生成椭球网格：x = rx·sinφ·cosθ、y = −ry·cosφ、z = rz·sinφ·sinθ，
 * θ=π/2 指向脸前（+z）。
 */
export function buildSkull(
  rx: number,
  ry: number,
  rz: number,
  latCount: number,
  lonCount: number,
): SphereMesh {
  const vertices: Vec3[] = [{ x: 0, y: -ry, z: 0 }];
  for (let lat = 1; lat < latCount; lat += 1) {
    const phi = (lat / latCount) * Math.PI;
    const ringY = -ry * polyCos(phi);
    const ringRadius = polySin(phi);
    for (let lon = 0; lon < lonCount; lon += 1) {
      const theta = (lon / lonCount) * 2 * Math.PI;
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
  const ringIndex = (lat: number, lon: number): number =>
    1 +
    ((lat - 1) % latCount) * lonCount +
    (((lon % lonCount) + lonCount) % lonCount);

  for (let lon = 0; lon < lonCount; lon += 1) {
    faces.push({ a: top, b: ringIndex(1, lon), c: ringIndex(1, lon + 1) });
  }
  for (let lat = 1; lat < latCount - 1; lat += 1) {
    for (let lon = 0; lon < lonCount; lon += 1) {
      const a = ringIndex(lat, lon);
      const b = ringIndex(lat, lon + 1);
      const c = ringIndex(lat + 1, lon + 1);
      const d = ringIndex(lat + 1, lon);
      faces.push({ a, b, c });
      faces.push({ a, b: c, c: d });
    }
  }
  for (let lon = 0; lon < lonCount; lon += 1) {
    faces.push({
      a: bottom,
      b: ringIndex(latCount - 1, lon + 1),
      c: ringIndex(latCount - 1, lon),
    });
  }

  return {
    vertices,
    faces,
    latCount,
    lonCount,
    ringIndex,
    phiOf: (lat: number) => (lat / latCount) * Math.PI,
  };
}
