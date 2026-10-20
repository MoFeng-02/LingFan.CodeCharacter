/**
 * 色带着色：把面朝向离散映射到明暗色带。
 *
 * 是什么：卡通着色的最小实现——固定光向、面法线点积、按位置取色带档位。
 * 为什么：确定性路线不使用光照方程与浮点纹理，离散色带让明暗完全由
 *         四则运算与比较决定，任何设备同帧同色。
 * 怎么用：对每个可见面取几何法线与立体几何声明的色带调用 shadeBand。
 * 注意事项：光向常量在模块内定义并归一化（sqrt 属于 IEEE 754 正确舍入
 *          运算）；零长度法线视为退化面，落在最暗档以暴露建模错误。
 */

import type { RgbaColor, Vec3 } from "@lingfan-character/contracts";

/** 光照方向（归一化前）：来自左上前方，与 2D 视觉习惯一致。 */
const LIGHT_RAW: Vec3 = { x: -0.45, y: -0.6, z: 0.66 };

const LIGHT_LENGTH = Math.sqrt(
  LIGHT_RAW.x * LIGHT_RAW.x +
    LIGHT_RAW.y * LIGHT_RAW.y +
    LIGHT_RAW.z * LIGHT_RAW.z,
);

const LIGHT: Vec3 = {
  x: LIGHT_RAW.x / LIGHT_LENGTH,
  y: LIGHT_RAW.y / LIGHT_LENGTH,
  z: LIGHT_RAW.z / LIGHT_LENGTH,
};

/** 向量归一化；零向量原样返回（后续点积得零，落在中间档）。 */
function normalize(v: Vec3): Vec3 {
  const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (length === 0) {
    return v;
  }
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

/**
 * 按面法线在色带中取色：正对光取最亮档（索引 0），
 * 背光取最暗档（索引 length−1），中间线性分档。
 */
export function shadeBand(
  normal: Vec3,
  bands: readonly RgbaColor[],
): RgbaColor {
  const n = normalize(normal);
  const d = n.x * LIGHT.x + n.y * LIGHT.y + n.z * LIGHT.z;
  const t = (1 - d) / 2;
  const index = Math.min(
    bands.length - 1,
    Math.max(0, Math.floor(t * bands.length)),
  );
  return bands[index]!;
}
