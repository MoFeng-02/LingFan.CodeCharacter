/**
 * 单图权重蒙皮的浏览器侧占位素材。
 *
 * 是什么：一张「古风白裙女子半身」的程序占位图——离屏画布现场绘制，
 *         尺寸与网格预期一致（正面站姿，头部在上三分之一、裙摆出画）。
 * 为什么：蒙皮要看到效果必须有张整图。占位图的目的不是好看，而是
 *         提供足够的结构特征（发、脸、眼、袖、裙）来检验「权重牵引是否
 *         按区域分开」——用户换成真实立绘时同一套权重仍然工作。
 * 怎么用：组合根引导时调一次，把结果登记进纹理表。
 * 注意事项：绘制内容全是矩形/椭圆/路径，不含文字——文字会在形变时
 *          被拉成波浪；留边（各元素离画布边缘留出余量）避免形变露底。
 */

import type { TextureResource } from "@lingfan-character/renderer-canvas2d";
import { TEXTURE_ID } from "@lingfan-character/example-rigged-portrait";

/** 占位图边长：与画布短边一致，贴图不会被非等比拉伸。 */
const SIZE = 512;

/** 配色：古风淡色系，便于观察各区域形变。 */
const SKIN = "#e9c6a8";
const SKIN_SHADE = "#d8ae90";
const HAIR = "#3b2b21";
const HAIR_HI = "#4e3a2c";
const ROBE = "#f2f0ea";
const ROBE_SHADE = "#dcd8cd";
const SASH = "#7fa08c";
const EYE = "#2a1f18";

/** 椭圆填充的简写。 */
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
  pen.ellipse(cx * SIZE, cy * SIZE, rx * SIZE, ry * SIZE, 0, 0, Math.PI * 2);
  pen.fill();
}

/**
 * 绘制占位立绘：发团 → 脸 → 五官 → 衣领袖 → 裙身。
 * 顺序即遮挡顺序，与真实分层的绘制语义一致。
 */
function paintPortrait(pen: CanvasRenderingContext2D): void {
  // 后发：包住头部的深色发团，向下延伸至肩后。
  fillEllipse(pen, HAIR, 0.5, 0.2, 0.19, 0.135);
  fillEllipse(pen, HAIR, 0.5, 0.3, 0.235, 0.26);

  // 颈与脸：颈在脸下方先画，脸覆盖衔接处。
  fillEllipse(pen, SKIN_SHADE, 0.5, 0.29, 0.05, 0.05);
  fillEllipse(pen, SKIN, 0.5, 0.145, 0.105, 0.1);
  fillEllipse(pen, SKIN, 0.5, 0.175, 0.1, 0.1);

  // 五官：眉、眼、鼻、唇——眼与眉的位置决定权重区域是否够准。
  pen.fillStyle = HAIR;
  pen.fillRect(0.44 * SIZE, 0.132 * SIZE, 0.045 * SIZE, 0.004 * SIZE);
  pen.fillRect(0.515 * SIZE, 0.132 * SIZE, 0.045 * SIZE, 0.004 * SIZE);
  fillEllipse(pen, "#fbf8f3", 0.462, 0.1565, 0.019, 0.011);
  fillEllipse(pen, "#fbf8f3", 0.538, 0.1565, 0.019, 0.011);
  fillEllipse(pen, EYE, 0.462, 0.1565, 0.0072, 0.0085);
  fillEllipse(pen, EYE, 0.538, 0.1565, 0.0072, 0.0085);
  fillEllipse(pen, SKIN_SHADE, 0.5, 0.183, 0.006, 0.011);
  fillEllipse(pen, "#c9796b", 0.5, 0.212, 0.016, 0.006);

  // 前发：刘海压在额头上，两侧鬓发垂下。
  fillEllipse(pen, HAIR_HI, 0.5, 0.108, 0.115, 0.052);
  fillEllipse(pen, HAIR, 0.4, 0.16, 0.045, 0.085);
  fillEllipse(pen, HAIR, 0.6, 0.16, 0.045, 0.085);

  // 衣领与双袖：袖山位置即肩，是袖摆骨骼的锚点所在。
  fillEllipse(pen, ROBE, 0.5, 0.32, 0.16, 0.06);
  fillEllipse(pen, ROBE_SHADE, 0.5, 0.335, 0.155, 0.045);
  fillEllipse(pen, ROBE, 0.28, 0.4, 0.115, 0.13);
  fillEllipse(pen, ROBE, 0.72, 0.4, 0.115, 0.13);
  fillEllipse(pen, ROBE_SHADE, 0.28, 0.48, 0.1, 0.06);
  fillEllipse(pen, ROBE_SHADE, 0.72, 0.48, 0.1, 0.06);

  // 腰带与裙身：裙身一路画到画布底部之外，避免形变时露出下边缘。
  fillEllipse(pen, SASH, 0.5, 0.37, 0.115, 0.022);
  fillEllipse(pen, ROBE, 0.5, 0.62, 0.27, 0.32);
  fillEllipse(pen, ROBE_SHADE, 0.35, 0.72, 0.07, 0.24);
  fillEllipse(pen, ROBE_SHADE, 0.65, 0.72, 0.07, 0.24);
}

/** 生成占位纹理资源：未选择图片时的可视基线。 */
export function createRiggedTexture(): TextureResource {
  const offscreen = document.createElement("canvas");
  offscreen.width = SIZE;
  offscreen.height = SIZE;
  const pen = offscreen.getContext("2d");
  if (pen) paintPortrait(pen);
  return { image: offscreen, width: SIZE, height: SIZE };
}

/** 占位素材的纹理标识：与配方声明同源，避免两处手写字面量。 */
export const RIGGED_TEXTURE_ID = TEXTURE_ID;
