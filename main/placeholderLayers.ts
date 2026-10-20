/**
 * 分层素材轨的占位分层图：用离屏画布现场画出十二层位图。
 *
 * 是什么：每层一张透明底位图，内容只画该层的可见图形（发团、脸、眼白、
 *         瞳孔、眼睑、眉、嘴、刘海），按层规格注册到宿主资源表。
 * 为什么：分层素材轨验证的是「层怎样被位移场驱动」，位图本身是占位——
 *         画布上现画即可让链路完整可看，不必先有美术稿。
 * 怎么用：boot() 里调用 ensureLayeredTextures()，注册后纹理解析器可查到；
 *         之后与真实立绘只差「换一张位图」，求值与渲染零改动。
 * 注意事项：位图尺寸按层区域矩形的宽高比生成，避免网格等分贴图时把圆形
 *          拉成椭圆；图形一律留出内边距，给形变留出余量，防止露边。
 */

import type { TextureResource } from "@lingfan-character/renderer-canvas2d";
import { LAYER_SPECS, type LayerSpec } from "@lingfan-character/example-layered";
import { registerTexture, textureRegistered } from "./modes";

/** 长边像素：占位图只求看清层级关系，不追求高清。 */
const LONG_EDGE = 256;

/** 皮肤、发色与线色的占位配色。 */
const SKIN = "#e8c3a1";
const SKIN_SHADE = "#d5ac8b";
const BLUSH = "#e5a894";
const HAIR = "#4a3728";
const HAIR_LIGHT = "#5e4835";
const LIP = "#c4705f";
const MOUTH_DARK = "#5b2f2a";
const BROW = "#3d2b1f";
const EYE_WHITE = "#fbf8f3";
const PUPIL = "#241a14";

/** 按层区域矩形的宽高比生成长边 256 的透明画布。 */
function layerCanvas(spec: LayerSpec): {
  canvas: HTMLCanvasElement;
  pen: CanvasRenderingContext2D;
} {
  const aspect = spec.rect.height / spec.rect.width;
  const width = aspect > 1 ? Math.round(LONG_EDGE / aspect) : LONG_EDGE;
  const height = aspect > 1 ? LONG_EDGE : Math.round(LONG_EDGE * aspect);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(8, width);
  canvas.height = Math.max(8, height);
  const pen = canvas.getContext("2d");
  if (!pen) {
    throw new Error("占位分层图无法取得 2d 上下文");
  }
  return { canvas, pen };
}

/** 椭圆填充：以画布比例给内边距，形变时不露边。 */
function ellipse(
  pen: CanvasRenderingContext2D,
  color: string,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): void {
  pen.fillStyle = color;
  pen.beginPath();
  pen.ellipse(
    pen.canvas.width * cx,
    pen.canvas.height * cy,
    pen.canvas.width * rx,
    pen.canvas.height * ry,
    0,
    0,
    Math.PI * 2,
  );
  pen.fill();
}

/** 逐层绘制分派：每种层只画自己的图形。 */
function paintLayer(spec: LayerSpec, pen: CanvasRenderingContext2D): void {
  switch (spec.kind) {
    case "hair-back":
      ellipse(pen, HAIR, 0.5, 0.52, 0.47, 0.47);
      ellipse(pen, HAIR_LIGHT, 0.5, 0.42, 0.38, 0.3);
      break;
    case "face":
      ellipse(pen, SKIN, 0.5, 0.5, 0.46, 0.48);
      // 腮红：两团淡色，位置与真人颧部一致，不做整片阴影（整片会读成口罩）。
      ellipse(pen, BLUSH, 0.26, 0.6, 0.1, 0.06);
      ellipse(pen, BLUSH, 0.74, 0.6, 0.1, 0.06);
      break;
    case "eye-white":
      ellipse(pen, EYE_WHITE, 0.5, 0.5, 0.44, 0.3);
      break;
    case "pupil":
      ellipse(pen, PUPIL, 0.5, 0.5, 0.3, 0.42);
      break;
    case "eyelid":
      // 整层铺满肤色：下移时光滑盖住眼白与瞳孔，边缘即眼皮。
      // 底缘画一道深色描线作为睫毛线，闭眼时读作合上的眼缝。
      pen.fillStyle = SKIN;
      pen.fillRect(0, 0, pen.canvas.width, pen.canvas.height);
      pen.strokeStyle = SKIN_SHADE;
      pen.lineWidth = Math.max(2, pen.canvas.height * 0.06);
      pen.beginPath();
      pen.moveTo(0, pen.canvas.height);
      pen.lineTo(pen.canvas.width, pen.canvas.height);
      pen.stroke();
      break;
    case "brow":
      pen.strokeStyle = BROW;
      pen.lineWidth = Math.max(3, pen.canvas.height * 0.34);
      pen.lineCap = "round";
      pen.beginPath();
      pen.moveTo(pen.canvas.width * 0.08, pen.canvas.height * 0.72);
      pen.quadraticCurveTo(
        pen.canvas.width * 0.5,
        pen.canvas.height * 0.08,
        pen.canvas.width * 0.92,
        pen.canvas.height * 0.62,
      );
      pen.stroke();
      break;
    case "mouth":
      ellipse(pen, MOUTH_DARK, 0.5, 0.5, 0.36, 0.16);
      ellipse(pen, LIP, 0.5, 0.34, 0.42, 0.14);
      ellipse(pen, LIP, 0.5, 0.68, 0.38, 0.16);
      break;
    case "hair-front":
      // 刘海：顶边画成弧形发顶（平顶会读成帽子），下缘三缕发梢；
      // 左右与上下都留边，形变时不致顶到层边界露底。
      pen.fillStyle = HAIR;
      pen.beginPath();
      pen.moveTo(pen.canvas.width * 0.06, pen.canvas.height * 0.34);
      pen.quadraticCurveTo(
        pen.canvas.width * 0.5,
        -pen.canvas.height * 0.22,
        pen.canvas.width * 0.94,
        pen.canvas.height * 0.34,
      );
      pen.quadraticCurveTo(
        pen.canvas.width * 0.8,
        pen.canvas.height * 0.82,
        pen.canvas.width * 0.64,
        pen.canvas.height * 0.56,
      );
      pen.quadraticCurveTo(
        pen.canvas.width * 0.5,
        pen.canvas.height * 0.9,
        pen.canvas.width * 0.38,
        pen.canvas.height * 0.58,
      );
      pen.quadraticCurveTo(
        pen.canvas.width * 0.22,
        pen.canvas.height * 0.84,
        pen.canvas.width * 0.06,
        pen.canvas.height * 0.34,
      );
      pen.closePath();
      pen.fill();
      break;
    default:
      break;
  }
}

/** 注册全部层纹理：已注册过则跳过，重复引导无副作用。 */
export function ensureLayeredTextures(): void {
  for (const spec of LAYER_SPECS) {
    if (textureRegistered(spec.textureId)) continue;
    const { canvas, pen } = layerCanvas(spec);
    paintLayer(spec, pen);
    const resource: TextureResource = {
      image: canvas,
      width: canvas.width,
      height: canvas.height,
    };
    registerTexture(spec.textureId, resource);
  }
}
