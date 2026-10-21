/**
 * 闭眼态纹理：从整身立绘派生一张「眼睛已合上」的同尺寸图。
 *
 * 是什么：逐只眼在椭圆范围内用同侧皮肤盖住眼裂，再在椭圆偏下处压出一条睫毛线。
 * 为什么：眼裂在整身画幅里只有十来个像素高，靠顶点形变合眼时两侧皮肤要被挤过来，
 *         而网格分辨率低于眼裂——位移差会剪坏网格单元，画面出现斜向色带与重影。
 *         眼皮的像素该由素材给出，顶点只负责形变。
 * 为什么皮肤要逐列取：左右脸受光不同，一块平色与脸颊对不上；逐列取框下方
 *         同侧的颊面，横向明暗梯度随之保留，边界只有椭圆淡出、看不见贴片。
 * 为什么不用暗像素检测找眼裂：眉毛与眼线在同一列上往往连成一片，检测分不开
 *         两者的边界，压完会留下半个眼白；椭圆按解剖位置直接圈定更可靠。
 * 怎么用：组合根在登记开眼纹理之后调一次，把结果按闭眼纹理标识入库；
 *         配方产出两条共用顶点的网格，按眨眼量交叉淡入。
 * 注意事项：椭圆四边要按距离淡出，否则贴片边界在整身画幅里看得出来。
 */

import type { TextureResource } from "@lingfan-character/renderer-canvas2d";
import type { EyeSlit } from "@lingfan-character/example-rigged-portrait";

/** 框内亮像素的亮度下限：高于此值视为皮肤，低于此值是睫毛、眼白与瞳孔。 */
const SKIN_LIMIT = 120;

/** 发丝的绿色偏置：绿色通道明显高于红色即视为头发。 */
const HAIR_GREEN_BIAS = 10;

/** 睫毛线在椭圆内的相对纵向位置：0 为椭圆顶、1 为底，略偏下即闭合线。 */
const LASH_AT = 0.6;

/** 睫毛线的纵向半宽（相对椭圆纵向半径）：越窄越像一条缝。 */
const LASH_HALF = 0.18;

/** 睫毛线颜色相对皮肤的亮度比例：越小越浓。 */
const LASH_DARK = 0.22;

/** 覆盖区的整体亮度校正：框内亮像素取平均会偏亮，压一点才与颊面同调。 */
const SKIN_TONE = 0.9;

/** 覆盖强度的上限：留一点原像素，眼皮上因此还有纹理，不是一块平色。 */
const COVER_MAX = 0.88;

/** 睫毛线上方的眼睑阴影：模拟上睑的厚度，越靠近睫毛线越暗。 */
const LID_SHADE = 0.16;

/** 眼睑阴影的纵向跨度（相对椭圆纵向半径）：从睫毛线上沿往上这么多。 */
const LID_SPAN = 0.5;

/** 椭圆边缘的柔化起点（相对半径）：此比例以内完全不透明。 */
const SOLID_CORE = 0.3;

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

/** 把归一化矩形换算成像素矩形，并夹在画布内。 */
function toPixels(slit: EyeSlit, width: number, height: number): Rect {
  const x = Math.max(0, Math.min(width - 1, Math.round(slit.x * width)));
  const y = Math.max(0, Math.min(height - 1, Math.round(slit.y * height)));
  return {
    x,
    y,
    w: Math.max(2, Math.min(Math.round(slit.width * width), width - x)),
    h: Math.max(2, Math.min(Math.round(slit.height * height), height - y)),
  };
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

/** 平滑的边框衰减：0 在边界、1 在核心区。 */
function falloff(distance: number): number {
  if (distance <= SOLID_CORE) return 1;
  if (distance >= 1) return 0;
  const t = (1 - distance) / (1 - SOLID_CORE);
  return t * t * (3 - 2 * t);
}

/** 一列的平均肤色：只统计亮且不偏绿的像素，发丝与睫毛因此不进样本。 */
function columnSkin(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  column: number,
  from: number,
  span: number,
): Rgb | undefined {
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  const to = Math.min(height, from + span);
  for (let row = Math.max(0, from); row < to; row += 1) {
    const index = (row * width + column) * 4;
    if (data[index + 3]! < 200) continue;
    const pr = data[index]!;
    const pg = data[index + 1]!;
    const pb = data[index + 2]!;
    if (pg > pr + HAIR_GREEN_BIAS) continue;
    if (0.299 * pr + 0.587 * pg + 0.114 * pb < SKIN_LIMIT) continue;
    r += pr;
    g += pg;
    b += pb;
    count += 1;
  }
  if (count === 0) return undefined;
  return { r: r / count, g: g / count, b: b / count };
}

/**
 * 像素是否属于垂在脸前的发丝：只按偏绿判定，不看亮度。
 *
 * 为什么不能连暗的一起判：睫毛线与瞳孔同样很暗，按亮度判会把整只眼
 * 当成发丝跳过，覆盖等于没做。
 */
function isHair(data: Uint8ClampedArray, index: number): boolean {
  const pr = data[index]!;
  const pg = data[index + 1]!;
  const pb = data[index + 2]!;
  return pg > pr + HAIR_GREEN_BIAS && pg > pb + HAIR_GREEN_BIAS;
}

/** 把一只眼盖成闭眼：椭圆内逐像素混向同侧皮肤，再压一条睫毛线。 */
function pressEye(
  base: CanvasRenderingContext2D,
  rect: Rect,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const image = base.getImageData(rect.x, rect.y, rect.w, rect.h);
  const data = image.data;
  const copy = new Uint8ClampedArray(data);
  const source = base.getImageData(0, 0, canvasWidth, canvasHeight).data;

  const centerX = rect.w / 2;
  const centerY = rect.h / 2;
  const radiusX = rect.w / 2;
  const radiusY = rect.h / 2;
  const lashCenter = LASH_AT * 2 - 1;

  // 肤色从框内自己取：框里大半是眼皮与颊面，亮像素就是皮肤本色。
  // 取框外下方的颊面不可靠——垂在脸侧的发丝正好落在那里，采到的就是发色。
  const skins: (Rgb | undefined)[] = [];
  for (let column = 0; column < rect.w; column += 1) {
    skins.push(
      columnSkin(source, canvasWidth, canvasHeight, rect.x + column, rect.y, rect.h),
    );
  }
  // 空列用最近的有效列补上，再做三点平滑，避免逐列色差形成竖纹。
  const filled: Rgb[] = [];
  let last: Rgb | undefined;
  for (const skin of skins) {
    if (skin) last = skin;
    filled.push(last ?? { r: 214, g: 190, b: 178 });
  }
  for (let index = filled.length - 1, next: Rgb | undefined = undefined; index >= 0; index -= 1) {
    if (skins[index]) next = skins[index];
    else if (next) filled[index] = next;
  }
  const smooth = filled.map((skin, index) => {
    const prev = filled[Math.max(0, index - 1)]!;
    const next = filled[Math.min(filled.length - 1, index + 1)]!;
    return {
      r: (prev.r + skin.r + next.r) / 3,
      g: (prev.g + skin.g + next.g) / 3,
      b: (prev.b + skin.b + next.b) / 3,
    };
  });

  for (let row = 0; row < rect.h; row += 1) {
    const dy = (row + 0.5 - centerY) / radiusY;
    for (let column = 0; column < rect.w; column += 1) {
      const dx = (column + 0.5 - centerX) / radiusX;
      const radius = Math.sqrt(dx * dx + dy * dy);
      if (radius >= 1) continue;
      const weight = falloff(radius);
      if (weight <= 0) continue;

      const index = (row * rect.w + column) * 4;
      // 垂在脸前的发丝原样保留，否则眼皮会糊掉一绺头发。
      if (isHair(copy, index)) continue;

      const skin = smooth[column]!;
      const lashDistance = Math.abs(dy - lashCenter) / LASH_HALF;
      const lash = lashDistance >= 1 ? 0 : (1 - lashDistance * lashDistance) ** 2;
      // 睫毛线上方留一道渐变阴影：上睑有厚度，不是一张贴纸。
      const lidGap = (lashCenter - dy) / LID_SPAN;
      const lid = lidGap <= 0 || lidGap >= 1 ? 0 : (1 - lidGap) ** 2 * LID_SHADE;
      const factor = SKIN_TONE * (1 - lash * LASH_DARK - lid);
      const strength = weight * COVER_MAX;

      const mix = (target: number, channel: number): number =>
        Math.round(copy[index + channel]! * (1 - strength) + target * strength);
      data[index] = mix(skin.r * factor, 0);
      data[index + 1] = mix(skin.g * factor, 1);
      data[index + 2] = mix(skin.b * factor, 2);
    }
  }
  base.putImageData(image, rect.x, rect.y);
}

/**
 * 派生闭眼纹理：返回与源图同尺寸的新资源，源图不被修改。
 *
 * 为什么先拷一份到自建画布：取样要走 getImageData，统一拷进自建画布后，
 * 无论贴图来自文件、离屏生成还是其它画布，都走同一条像素路径。
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
    pressEye(result.pen, toPixels(slit, width, height), width, height);
  }

  return { image: result.canvas, width, height };
}
