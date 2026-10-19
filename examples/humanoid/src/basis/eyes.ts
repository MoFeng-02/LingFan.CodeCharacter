/**
 * 眼部基形变：纯数值计算。视线为双眼共轭（不分侧），睑开合与瞳孔
 * 缩放同侧同值；形变量只由对应基参数贡献，保持正交纪律。
 */

/** 眼部形变量：lidShift 眼睑纵向位移（正=上提睁大），irisDx/irisDy 虹膜视移，pupilScale 瞳孔缩放。 */
export interface EyeDeform {
  lidShift: number;
  irisDx: number;
  irisDy: number;
  pupilScale: number;
}

/**
 * 眼部基形变：open=0.5 为基线不动，偏小下压呈半眯、偏大上提呈睁大；
 * 视线基直接平移虹膜与瞳孔；瞳孔缩放围绕基线 1 倍。
 */
export function eyeDeform(
  open: number,
  gazeX: number,
  gazeY: number,
  dilate: number,
): EyeDeform {
  return {
    lidShift: (0.5 - open) * 0.012,
    irisDx: gazeX * 0.012,
    irisDy: gazeY * 0.008,
    pupilScale: 1 + dilate * 0.6,
  };
}
