/**
 * 发壳：略大于头骨的第二层椭球，面级发际线剔除露出脸区。
 *
 * 是什么：从后颈到头顶的球壳网格，逐面判定「面中心是否低于该经度的
 *         发际线」，脸区与额头的面不生成——头发盖头顶、两侧与后脑。
 * 为什么：剔除产生的锯齿边恰似发梢，不需要任何额外描边；发壳与头骨
 *         是两个独立立体基元，各自带色带，光照分档互不干扰。
 * 怎么用：buildHair 与头骨同呼吸缩放，节点输出两个立体基元。
 * 注意事项：极角约定与头骨一致——φ=0 指向下极（下巴）、φ=π 指向
 *          上极（头顶），θ=π/2 指向脸前（+z）；正前发际线起点最高
 *          （露额头），正后最低（盖后颈）；面剔除判定全部使用生成
 *          时的网格参数，无反三角函数；底边开口朝下，采样视角受限
 *          不会看到空壳内部。
 */

import type { Face3, Vec3 } from "@lingfan-character/contracts";
import { polyCos, polySin } from "@lingfan-character/primitives";

/** 发壳分段与相对头骨半径的蓬松系数。 */
const LAT_HAIR = 7;
const LON_HAIR = 16;
const FLUFF_X = 1.05;
const FLUFF_Y = 1.04;
const FLUFF_Z = 1.06;
const PHI_BASE = 0.42 * Math.PI;

/** 发际线：头发覆盖的下界纬度随经度变化（脸前起点高、后脑起点低）。 */
function hairlinePhi(theta: number): number {
  const front = 0.8 * Math.PI;
  const back = 0.45 * Math.PI;
  const base = back + ((front - back) * (1 + polySin(theta))) / 2;
  // 多周期微扰：发际线呈波状起伏，剔除边界读作发梢而非几何切口
  return base + 0.02 * Math.PI * polySin(theta * 7);
}

export interface HeadGeometry {
  readonly vertices: readonly Vec3[];
  readonly faces: readonly Face3[];
}

/** 生成发壳网格（顶点行优先、上极收束；面中心低于发际线即剔除）。 */
export function buildHair(rx: number, ry: number, rz: number): HeadGeometry {
  const hx = rx * FLUFF_X;
  const hy = ry * FLUFF_Y;
  const hz = rz * FLUFF_Z;

  const phiOf = (lat: number): number =>
    PHI_BASE + (lat / LAT_HAIR) * (Math.PI - PHI_BASE);
  const vertices: Vec3[] = [{ x: 0, y: -hy * polyCos(PHI_BASE), z: 0 }];
  for (let lat = 1; lat < LAT_HAIR; lat += 1) {
    const phi = phiOf(lat);
    const ringY = -hy * polyCos(phi);
    const ringRadius = polySin(phi);
    for (let lon = 0; lon < LON_HAIR; lon += 1) {
      const theta = (lon / LON_HAIR) * 2 * Math.PI;
      vertices.push({
        x: hx * ringRadius * polyCos(theta),
        y: ringY,
        z: hz * ringRadius * polySin(theta),
      });
    }
  }
  vertices.push({ x: 0, y: hy, z: 0 });

  const ring = (lat: number, lon: number): number =>
    1 + (lat - 1) * LON_HAIR + (((lon % LON_HAIR) + LON_HAIR) % LON_HAIR);

  const faces: Face3[] = [];
  const keepFace = (lat: number, lon: number): boolean => {
    // 面中心参数：经度取两经线中点，纬度取两环中点——纯生成参数，零反解。
    const thetaC = ((lon + 0.5) / LON_HAIR) * 2 * Math.PI;
    const phiC = (phiOf(lat) + phiOf(lat + 1)) / 2;
    return phiC >= hairlinePhi(thetaC);
  };

  for (let lon = 0; lon < LON_HAIR; lon += 1) {
    if (keepFace(LAT_HAIR - 1, lon)) {
      faces.push({
        a: vertices.length - 1,
        b: ring(LAT_HAIR - 1, lon + 1),
        c: ring(LAT_HAIR - 1, lon),
      });
    }
  }
  for (let lat = 1; lat < LAT_HAIR - 1; lat += 1) {
    for (let lon = 0; lon < LON_HAIR; lon += 1) {
      if (!keepFace(lat, lon)) {
        continue;
      }
      faces.push({
        a: ring(lat, lon),
        b: ring(lat, lon + 1),
        c: ring(lat + 1, lon + 1),
      });
      faces.push({
        a: ring(lat, lon),
        b: ring(lat + 1, lon + 1),
        c: ring(lat + 1, lon),
      });
    }
  }

  return { vertices, faces };
}
