/**
 * 单图权重蒙皮的浏览器侧占位素材。
 *
 * 是什么：一张「古风青绿长裙女子全身立绘」的程序占位图——离屏画布现场绘制。
 * 为什么：蒙皮要看到效果必须有张整图。占位图的目的不是好看，而是提供足够
 *         的结构特征（发、脸、眼、袖、裙）来检验「权重牵引是否按区域分开」，
 *         并且它的画幅与解剖位置要和真实立绘一致，换图时同一套骨骼锚点仍然
 *         落在同一个部位上。
 * 怎么用：组合根引导时调一次，把结果登记进纹理表；真实立绘加载成功后被替换。
 * 注意事项：绘制内容全是矩形/椭圆/路径，不含文字——文字会在形变时被拉成波浪；
 *          留边（各元素离画布边缘留出余量）避免形变露底。
 */

import type { TextureResource } from "@lingfan-character/renderer-canvas2d";
import { TEXTURE_ID } from "@lingfan-character/example-rigged-portrait";

/**
 * 占位图画幅：竖构图，宽高比约 2:3（与常见整身立绘的构图一致）。
 * 与画布的推导口径一致（长边 512、短边按比例），因此占位图与真实图
 * 上屏后的画布尺寸接近，切换时画面不跳。
 */
const LONG_EDGE = 512;
const ASPECT = 2 / 3;
const WIDTH = Math.round(LONG_EDGE * ASPECT);
const HEIGHT = LONG_EDGE;

/** 配色：古风淡青绿，便于观察各区域形变。 */
const SKIN = "#e9c6a8";
const SKIN_SHADE = "#d8ae90";
const HAIR = "#2f2a24";
const HAIR_HI = "#453d33";
const ROBE = "#eaf1ea";
const ROBE_SHADE = "#c9dacd";
const SASH = "#7fa08c";
const EYE = "#2a1f18";
const LIP = "#b5675a";

/** 椭圆填充的简写：坐标按画幅归一化后换算成像素。 */
function fillEllipse(
  pen: CanvasRenderingContext2D,
  color: string,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): void {
  pen.fillStyle = color;
  pen.beginPath();
  pen.ellipse(cx * WIDTH, cy * HEIGHT, rx * WIDTH, ry * HEIGHT, 0, 0, Math.PI * 2);
  pen.fill();
}

/** 矩形填充的简写：同样按归一化坐标。 */
function fillRect(
  pen: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  pen.fillStyle = color;
  pen.fillRect(x * WIDTH, y * HEIGHT, w * WIDTH, h * HEIGHT);
}

/**
 * 绘制占位立绘：发团 → 脸 → 五官 → 衣领袖 → 腰带 → 裙身。
 * 顺序即遮挡顺序，与真实分层的绘制语义一致；纵向位置与配方里的
 * 骨骼锚点同源（头中心 0.115、眼线 0.136、唇 0.168、锁 0.224、腰 0.43）。
 */
function paintPortrait(pen: CanvasRenderingContext2D): void {
  // 后发：包住头部的深色发团，一路垂到腰下。
  fillEllipse(pen, HAIR, 0.5, 0.1, 0.15, 0.075);
  fillEllipse(pen, HAIR, 0.5, 0.28, 0.16, 0.2);

  // 颈与脸：颈在脸下方先画，脸覆盖衔接处。
  fillEllipse(pen, SKIN_SHADE, 0.5, 0.205, 0.042, 0.03);
  fillEllipse(pen, SKIN, 0.5, 0.115, 0.082, 0.075);
  fillEllipse(pen, SKIN, 0.5, 0.15, 0.075, 0.06);

  // 五官：眉、眼、鼻、唇。左右眼中心与配方声明的眼裂取样框对齐，
  // 因此真实立绘与占位图走同一条闭眼纹理派生路径。
  fillRect(pen, HAIR, 0.455, 0.126, 0.038, 0.003);
  fillRect(pen, HAIR, 0.516, 0.126, 0.038, 0.003);
  fillEllipse(pen, "#fbf8f3", 0.478, 0.137, 0.018, 0.008);
  fillEllipse(pen, "#fbf8f3", 0.549, 0.137, 0.018, 0.008);
  fillEllipse(pen, EYE, 0.478, 0.137, 0.007, 0.007);
  fillEllipse(pen, EYE, 0.549, 0.137, 0.007, 0.007);
  fillEllipse(pen, SKIN_SHADE, 0.5, 0.157, 0.005, 0.008);
  fillEllipse(pen, LIP, 0.5, 0.168, 0.013, 0.005);

  // 前发：刘海压额，两侧鬓发垂到颌线。
  fillEllipse(pen, HAIR_HI, 0.5, 0.088, 0.09, 0.038);
  fillEllipse(pen, HAIR, 0.415, 0.13, 0.032, 0.06);
  fillEllipse(pen, HAIR, 0.585, 0.13, 0.032, 0.06);

  // 交领与双袖：袖山落在肩上，是袖摆骨骼的锚点所在。
  fillEllipse(pen, ROBE, 0.5, 0.235, 0.11, 0.035);
  fillEllipse(pen, ROBE_SHADE, 0.5, 0.245, 0.105, 0.026);
  fillEllipse(pen, ROBE, 0.4, 0.3, 0.07, 0.1);
  fillEllipse(pen, ROBE, 0.6, 0.3, 0.07, 0.1);
  fillEllipse(pen, ROBE_SHADE, 0.4, 0.37, 0.06, 0.05);
  fillEllipse(pen, ROBE_SHADE, 0.6, 0.37, 0.06, 0.05);

  // 腰带与裙身：裙身一路画到画脚，避免形变时露出下边缘。
  fillEllipse(pen, SASH, 0.5, 0.43, 0.085, 0.016);
  fillEllipse(pen, ROBE, 0.5, 0.63, 0.2, 0.22);
  fillEllipse(pen, ROBE_SHADE, 0.42, 0.72, 0.05, 0.17);
  fillEllipse(pen, ROBE_SHADE, 0.58, 0.72, 0.05, 0.17);
  fillEllipse(pen, ROBE, 0.5, 0.92, 0.13, 0.06);
}

/** 生成占位纹理资源：未选择图片时的可视基线。 */
export function createRiggedTexture(): TextureResource {
  const offscreen = document.createElement("canvas");
  offscreen.width = WIDTH;
  offscreen.height = HEIGHT;
  const pen = offscreen.getContext("2d");
  if (pen) paintPortrait(pen);
  return { image: offscreen, width: WIDTH, height: HEIGHT };
}

/** 占位素材的纹理标识：与配方声明同源，避免两处手写字面量。 */
export const RIGGED_TEXTURE_ID = TEXTURE_ID;
