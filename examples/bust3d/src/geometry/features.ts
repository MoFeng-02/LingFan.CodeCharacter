/**
 * 五官形变：把球面网格顶点沿径向按特征位移场推移，皮肤保持连续。
 *
 * 是什么：一组球面角坐标特征（鼻梁、眉弓、眼窝、唇、下颌、耳），每个
 *         特征是「中心角 + 角向带宽 + 幅度」，核函数为四次平滑窗。
 * 为什么：凸凹体块的面法线随形变连续变化，光照分档自然呈现立体五官；
 *         相比贴附式楔块，变形式无接缝、侧面不穿帮，且全部是纯四则。
 * 怎么用：buildSkull 之后调用 applyFeatures 原位变形顶点表。
 * 注意事项：核在带宽外严格归零——特征互不串扰；θ=π/2 指向脸前，
 *          左右成对特征靠镜像中心角声明，位移幅度为半径的相对比例。
 */

import type { SphereMesh } from "./skull";

/** 角差归约到 [−π, π]：余数与比较均为确定运算。 */
function wrapPi(angle: number): number {
  let a = angle % (2 * Math.PI);
  if (a > Math.PI) {
    a -= 2 * Math.PI;
  }
  if (a < -Math.PI) {
    a += 2 * Math.PI;
  }
  return a;
}

interface FeatureSpec {
  /** 中心经度角（0..2π，π/2=脸前）。 */
  thetaC: number;
  /** 中心极角（0..π，0=下极）。 */
  phiC: number;
  /** 经向、纬向半带宽（弧度）。 */
  halfTheta: number;
  halfPhi: number;
  /** 径向位移比例：正=凸起，负=凹陷。 */
  amp: number;
}

/** 四次平滑窗：带宽内 (1−t²)²，带宽外严格为零。 */
function kernel(t: number): number {
  if (t <= -1 || t >= 1) {
    return 0;
  }
  const u = 1 - t * t;
  return u * u;
}

/** 特征表：几何即配方——改这张表就是改五官。 */
const FEATURES: readonly FeatureSpec[] = [
  // 鼻梁：脸前窄长凸起
  {
    thetaC: Math.PI / 2,
    phiC: 0.52 * Math.PI,
    halfTheta: 0.16,
    halfPhi: 0.11 * Math.PI,
    amp: 0.09,
  },
  // 眉弓 ×2：眼窝上缘横向隆起
  {
    thetaC: Math.PI / 2 - 0.52,
    phiC: 0.4 * Math.PI,
    halfTheta: 0.26,
    halfPhi: 0.05 * Math.PI,
    amp: 0.032,
  },
  {
    thetaC: Math.PI / 2 + 0.52,
    phiC: 0.4 * Math.PI,
    halfTheta: 0.26,
    halfPhi: 0.05 * Math.PI,
    amp: 0.032,
  },
  // 眼窝 ×2：眉弓之下浅凹
  {
    thetaC: Math.PI / 2 - 0.48,
    phiC: 0.47 * Math.PI,
    halfTheta: 0.15,
    halfPhi: 0.04 * Math.PI,
    amp: -0.028,
  },
  {
    thetaC: Math.PI / 2 + 0.48,
    phiC: 0.47 * Math.PI,
    halfTheta: 0.15,
    halfPhi: 0.04 * Math.PI,
    amp: -0.028,
  },
  // 唇：鼻下横向微凸
  {
    thetaC: Math.PI / 2,
    phiC: 0.66 * Math.PI,
    halfTheta: 0.3,
    halfPhi: 0.035 * Math.PI,
    amp: 0.026,
  },
  // 下颌：底部前向凸出
  {
    thetaC: Math.PI / 2,
    phiC: 0.88 * Math.PI,
    halfTheta: 0.55,
    halfPhi: 0.12 * Math.PI,
    amp: 0.05,
  },
  // 耳 ×2：两侧凸块（θ=0 为 +x 侧）
  {
    thetaC: 0,
    phiC: 0.5 * Math.PI,
    halfTheta: 0.14,
    halfPhi: 0.13 * Math.PI,
    amp: 0.06,
  },
  {
    thetaC: Math.PI,
    phiC: 0.5 * Math.PI,
    halfTheta: 0.14,
    halfPhi: 0.13 * Math.PI,
    amp: 0.06,
  },
];

/** 单顶点的合成位移比例：各特征核相乘后加权求和。 */
function displacement(theta: number, phi: number): number {
  let total = 0;
  for (const feature of FEATURES) {
    const dTheta = wrapPi(theta - feature.thetaC);
    const dPhi = wrapPi(phi - feature.phiC);
    const weight =
      kernel(dTheta / feature.halfTheta) * kernel(dPhi / feature.halfPhi);
    if (weight > 0) {
      total += feature.amp * weight;
    }
  }
  return total;
}

/** 原位变形：按球面角逐环遍历，沿径向缩放顶点。 */
export function applyFeatures(mesh: SphereMesh): void {
  const { vertices } = mesh;
  for (let lat = 1; lat < mesh.latCount; lat += 1) {
    const phi = mesh.phiOf(lat);
    for (let lon = 0; lon < mesh.lonCount; lon += 1) {
      const theta = (lon / mesh.lonCount) * 2 * Math.PI;
      const index = mesh.ringIndex(lat, lon);
      const v = vertices[index]!;
      const d = displacement(theta, phi);
      if (d !== 0) {
        vertices[index] = {
          x: v.x * (1 + d),
          y: v.y * (1 + d),
          z: v.z * (1 + d),
        };
      }
    }
  }
}
