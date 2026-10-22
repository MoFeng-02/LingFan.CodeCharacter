/**
 * 闭眼态纹理：从整身立绘派生一张「眼睛已合上」的同尺寸图。
 *
 * 是什么：逐只眼把眼裂内的暗像素抹平成皮肤，抹平后的值由周围皮肤的调和插值给出，
 *         再沿闭合睑缘补一道极淡的睑缝阴影，让上下睑读作贴合。
 * 为什么不由顶点合眼：眼裂在整身画幅里只有十来个像素高，靠顶点形变合眼时两侧皮肤
 *         要被挤过来，而网格分辨率低于眼裂——位移差会剪坏网格单元，画面出现斜向
 *         色带与重影。眼皮的像素该由素材给出，顶点只负责形变。
 * 为什么用调和插值而不是平涂：平涂一块常数色丢掉了上下眼睑的明暗梯度，与颊面之间
 *         留下可见的贴片边界。调和填充把区域边界当作固定条件，填充值从边界连续
 *         过渡进去，不存在零阶跳变，因此既无贴片感也无接缝。
 * 为什么掩膜按亮度自适应生长而不是画椭圆：椭圆边界会落在深色眼线上，边界条件取到
 *         暗色，解出来仍是一团暗。只有让掩膜只吸收暗像素、遇亮皮肤即止，边界才落在
 *         亮肤上，填充结果才是眼皮。
 * 怎么用：组合根在登记开眼纹理之后调一次，把结果按闭眼纹理标识入库；配方产出两条
 *         共用顶点的网格，按眨眼量交叉淡入。
 * 注意事项：掩膜必须排除偏绿的垂发，否则眼皮会糊掉一绺头发；迭代到相邻两次变化
 *         小于亚像素级即可，继续迭代不会改变观感。
 */

import type { TextureResource } from "@lingfan-character/renderer-canvas2d";
import type { EyeSlit } from "@lingfan-character/example-rigged-portrait";

/** 掩膜吸收的亮度上限：低于此值视为睫毛、眼线与眼白，高于此值是皮肤。 */
const DARK_LIMIT = 150;

/** 发丝的绿色偏置：绿色通道明显高于红色与蓝色即视为头发。 */
const HAIR_GREEN_BIAS = 8;

/** 环带取样的亮度下限：只有亮像素才当作皮肤，浅阴影与睫毛不进样本。 */
const SKIN_LIMIT = 170;

/** 环带取样区相对眼裂椭圆的半径倍数：内圈躲开眼线，外圈留在颊面。 */
const RING_INNER = 1.05;
const RING_OUTER = 1.85;

/** 睑缝阴影：闭合眼睑不是一片均匀皮肤，贴合的睑缘要压出一条淡线。 */
const CREASE_AT = 0.42;
const CREASE_CURVE = 2.6;
const CREASE_HALF = 1;
const CREASE_DARK = 0.3;

/** 松弛迭代的上限轮数与收敛判据（最大通道变化，低于即停）。 */
const MAX_SWEEPS = 2400;
const TOLERANCE = 0.4;

interface Ellipse {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
}

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** 把归一化矩形当作眼裂的外接矩形，换算成像素椭圆的中心与半径。 */
function ellipseOf(slit: EyeSlit, width: number, height: number): Ellipse {
  return {
    cx: (slit.x + slit.width / 2) * width,
    cy: (slit.y + slit.height / 2) * height,
    rx: Math.max(2, (slit.width * width) / 2),
    ry: Math.max(2, (slit.height * height) / 2),
  };
}

/** 取样区：把眼裂椭圆按环带倍数外扩，夹在画布内。 */
function boxOf(eye: Ellipse, width: number, height: number): Rect {
  const x0 = Math.max(0, Math.floor(eye.cx - eye.rx * RING_OUTER));
  const y0 = Math.max(0, Math.floor(eye.cy - eye.ry * RING_OUTER));
  const x1 = Math.min(width, Math.ceil(eye.cx + eye.rx * RING_OUTER) + 1);
  const y1 = Math.min(height, Math.ceil(eye.cy + eye.ry * RING_OUTER) + 1);
  return { x: x0, y: y0, w: Math.max(2, x1 - x0), h: Math.max(2, y1 - y0) };
}

/** 建一张离屏画布并返回上下文，取不到上下文时返回 undefined。 */
function offscreen(
  width: number,
  height: number,
): { canvas: HTMLCanvasElement; pen: CanvasRenderingContext2D } | undefined {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const pen = canvas.getContext("2d", { willReadFrequently: true });
  return pen ? { canvas, pen } : undefined;
}

/** 像素亮度，整数加权：跨引擎结果一致，不用浮点系数。 */
function luma(r: number, g: number, b: number): number {
  return (299 * r + 587 * g + 114 * b) / 1000;
}

/**
 * 眼裂外的眼睛：是否属于偏绿的垂发。
 *
 * 为什么只按色偏判、不看亮度：睫毛与瞳孔同样很暗，按亮度判会把整只眼当成发丝
 * 跳过，填充等于没做。
 */
function isHair(r: number, g: number, b: number): boolean {
  return g > r + HAIR_GREEN_BIAS && g > b + HAIR_GREEN_BIAS;
}

/** 建掩膜：椭圆内的暗像素，排除偏绿垂发。 */
function buildMask(
  data: Uint8ClampedArray,
  box: Rect,
  eye: Ellipse,
): Uint8Array | undefined {
  const mask = new Uint8Array(box.w * box.h);
  let count = 0;
  for (let row = 0; row < box.h; row += 1) {
    const dy = (row + 0.5 + box.y - eye.cy) / eye.ry;
    for (let column = 0; column < box.w; column += 1) {
      const dx = (column + 0.5 + box.x - eye.cx) / eye.rx;
      if (dx * dx + dy * dy > 1) continue;
      const index = (row * box.w + column) * 4;
      if (data[index + 3]! < 200) continue;
      const pr = data[index]!;
      const pg = data[index + 1]!;
      const pb = data[index + 2]!;
      if (isHair(pr, pg, pb)) continue;
      if (luma(pr, pg, pb) > DARK_LIMIT) continue;
      mask[row * box.w + column] = 1;
      count += 1;
    }
  }
  return count > 0 ? mask : undefined;
}

/** 环带皮肤均值：填充的起点色，也是迭代的边界条件所在的那一圈。 */
function ringSkin(
  data: Uint8ClampedArray,
  box: Rect,
  eye: Ellipse,
): Rgb | undefined {
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let row = 0; row < box.h; row += 1) {
    const dy = (row + 0.5 + box.y - eye.cy) / eye.ry;
    for (let column = 0; column < box.w; column += 1) {
      const dx = (column + 0.5 + box.x - eye.cx) / eye.rx;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < RING_INNER || distance > RING_OUTER) continue;
      const index = (row * box.w + column) * 4;
      if (data[index + 3]! < 200) continue;
      const pr = data[index]!;
      const pg = data[index + 1]!;
      const pb = data[index + 2]!;
      if (isHair(pr, pg, pb)) continue;
      if (luma(pr, pg, pb) < SKIN_LIMIT) continue;
      r += pr;
      g += pg;
      b += pb;
      count += 1;
    }
  }
  if (count === 0) return undefined;
  return { r: r / count, g: g / count, b: b / count };
}

/**
 * 在掩膜内解调和方程：每个像素取四邻域平均，迭代到变化小于容差。
 *
 * 为什么从环带均值起步：常数初值让首轮迭代全部落在同一值附近，收敛方向对称；
 * 若从原图的暗值起步，前几百轮会在眼裂中心留下一团低频暗斑。
 */
function relax(
  mask: Uint8Array,
  fill: Float32Array,
  box: Rect,
  start: Rgb,
): void {
  for (let index = 0; index < mask.length; index += 1) {
    if (!mask[index]) continue;
    fill[index * 3] = start.r;
    fill[index * 3 + 1] = start.g;
    fill[index * 3 + 2] = start.b;
  }
  for (let sweep = 0; sweep < MAX_SWEEPS; sweep += 1) {
    let worst = 0;
    for (let row = 1; row < box.h - 1; row += 1) {
      for (let column = 1; column < box.w - 1; column += 1) {
        const index = row * box.w + column;
        if (!mask[index]) continue;
        const base = index * 3;
        for (let channel = 0; channel < 3; channel += 1) {
          const next =
            (fill[base - box.w * 3 + channel]! +
              fill[base + box.w * 3 + channel]! +
              fill[base - 3 + channel]! +
              fill[base + 3 + channel]!) *
            0.25;
          const change = Math.abs(next - fill[base + channel]!);
          if (change > worst) worst = change;
          fill[base + channel] = next;
        }
      }
    }
    if (worst < TOLERANCE) return;
  }
}

/** 闭合睑缘的淡阴影：贴着下睑压一条，读作上下睑贴合而不是一张平皮。 */
function pressCrease(
  data: Uint8ClampedArray,
  mask: Uint8Array,
  box: Rect,
  eye: Ellipse,
): void {
  for (let row = 0; row < box.h; row += 1) {
    const wy = row + 0.5 + box.y;
    for (let column = 0; column < box.w; column += 1) {
      if (!mask[row * box.w + column]) continue;
      const wx = column + 0.5 + box.x;
      const t = (wx - eye.cx) / eye.rx;
      const center = eye.cy + eye.ry * CREASE_AT + t * t * CREASE_CURVE;
      const gap = Math.abs(wy - center);
      if (gap > CREASE_HALF) continue;
      const taper = 1 - Math.abs(t) ** 4;
      if (taper <= 0) continue;
      const amount = CREASE_DARK * (1 - gap / (CREASE_HALF + 1)) * taper;
      const index = (row * box.w + column) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        data[index + channel] = Math.round(
          data[index + channel]! * (1 - amount) +
            (channel === 1 ? 118 : 150) * amount,
        );
      }
    }
  }
}

/** 把一只眼盖成闭眼：解调和方程得到填充场，写回像素，再补睑缝阴影。 */
function pressEye(
  pen: CanvasRenderingContext2D,
  slit: EyeSlit,
  width: number,
  height: number,
): void {
  const eye = ellipseOf(slit, width, height);
  const box = boxOf(eye, width, height);
  const image = pen.getImageData(box.x, box.y, box.w, box.h);
  const data = image.data;
  const mask = buildMask(data, box, eye);
  if (!mask) return;
  const start = ringSkin(data, box, eye);
  if (!start) return;

  const fill = new Float32Array(box.w * box.h * 3);
  for (let index = 0; index < box.w * box.h; index += 1) {
    fill[index * 3] = data[index * 4]!;
    fill[index * 3 + 1] = data[index * 4 + 1]!;
    fill[index * 3 + 2] = data[index * 4 + 2]!;
  }
  relax(mask, fill, box, start);

  for (let index = 0; index < box.w * box.h; index += 1) {
    if (!mask[index]) continue;
    for (let channel = 0; channel < 3; channel += 1) {
      const value = fill[index * 3 + channel]!;
      data[index * 4 + channel] = Math.round(
        value < 0 ? 0 : value > 255 ? 255 : value,
      );
    }
  }
  pressCrease(data, mask, box, eye);
  pen.putImageData(image, box.x, box.y);
}

/**
 * 派生闭眼纹理：返回与源图同尺寸的新资源，源图不被修改。
 *
 * 为什么先拷一份到自建画布：取样要走 getImageData，统一拷进自建画布后，无论贴图
 * 来自文件、离屏生成还是其它画布，都走同一条像素路径。
 */
export function buildClosedEyesTexture(
  source: TextureResource,
  slits: readonly EyeSlit[],
): TextureResource {
  const width = source.width;
  const height = source.height;
  const result = offscreen(width, height);
  if (!result) return source;
  result.pen.drawImage(source.image, 0, 0, width, height);

  for (const slit of slits) {
    pressEye(result.pen, slit, width, height);
  }

  return { image: result.canvas, width, height };
}
