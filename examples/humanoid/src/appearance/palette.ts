import type { RgbaColor } from "@lingfan-character/contracts";

/** v0 程序轨色板：全部外观颜色在此集中声明，随状态向量进入渲染器。 */
export const PALETTE = {
  skin: color(0.961, 0.804, 0.655),
  skinShade: color(0.91, 0.627, 0.541),
  hairDark: color(0.29, 0.216, 0.157),
  hairLight: color(0.42, 0.318, 0.251),
  eyeWhite: color(0.98, 0.969, 0.949),
  iris: color(0.231, 0.165, 0.122),
  pupil: color(0.098, 0.071, 0.055),
  mouth: color(0.725, 0.416, 0.369),
  brow: color(0.247, 0.18, 0.133),
  pin: color(0.851, 0.643, 0.255),
} as const;

function color(r: number, g: number, b: number, a = 1): RgbaColor {
  return { r, g, b, a };
}
