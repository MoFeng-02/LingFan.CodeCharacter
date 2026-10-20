/**
 * 绘制执行器：把绘制计划逐条照抄到 canvas2d 上下文。
 *
 * 是什么：draw(ctx, plan) 只做指令执行——设矩阵、设样式、建路径、填充；
 *         网格基元按资源解析结果逐单元仿射贴图。
 * 为什么：执行层零运算保证「指令流是什么样，画出来就是什么样」，
 *         指纹判据与可见结果一一对应；渲染器因此不需要理解角色语义。
 * 怎么用：const plan = buildDrawPlan(state, scale); draw(ctx, plan)；
 *         含素材网格时传入第三参数 resources，由宿主提供纹理解析。
 * 注意事项：不保存/恢复上下文状态，由调用方决定帧间隔离；
 *          path 命令只支持契约四种，多余种类在编译期类型层即被排除；
 *          网格单元用左上三点解仿射（单元内双线性高阶项忽略），
 *          纹理缺失或未提供资源解析时报错而非静默跳过。
 */

import type { TextureId } from "@lingfan-character/contracts";
import type { CompiledShape, DrawPlan } from "./commands.js";

/** 画布上下文最小接口：仅依赖绘制所需方法，测试可用记录式替身。 */
export interface DrawingContext {
  setTransform(
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
  ): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  bezierCurveTo(
    c1x: number,
    c1y: number,
    c2x: number,
    c2y: number,
    x: number,
    y: number,
  ): void;
  closePath(): void;
  ellipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    startAngle: number,
    endAngle: number,
  ): void;
  fill(): void;
  clip(): void;
  save(): void;
  restore(): void;
  transform(
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
  ): void;
  rect(x: number, y: number, width: number, height: number): void;
  drawImage(
    image: CanvasImageSource,
    sourceX: number,
    sourceY: number,
    sourceWidth: number,
    sourceHeight: number,
    destX: number,
    destY: number,
    destWidth: number,
    destHeight: number,
  ): void;
  globalCompositeOperation: string;
  globalAlpha: number;
  fillStyle: string;
}

/** 宿主侧已注册的纹理资源：位图源与像素尺寸。 */
export interface TextureResource {
  readonly image: CanvasImageSource;
  readonly width: number;
  readonly height: number;
}

/** 纹理解析视图：宿主持注册表，渲染端只读解析；缺项即契约违规。 */
export type TextureResolver = (id: TextureId) => TextureResource | undefined;

/** 全角弧度：椭圆基元的闭合圆。 */
const TAU = Math.PI * 2;

/** 源块外扩量（源像素）：浮点采样按半开区间取块，精确等分会在相邻块间漏采样。 */
const SEAM_PAD = 0.5;

/**
 * 执行一条网格指令：逐单元「仿射变换 + 裁剪 + 贴图」。
 * 单元 (i, j) 的四点取自行优先顶点表；纹理对应块按等分网格切取，
 * 源块向四周外扩半像素并同步扩大裁剪域——相邻单元重叠同一源内容，
 * 后画覆盖先画，消除接缝；边界侧不外扩以免越出位图。
 */
function drawMesh(
  context: DrawingContext,
  shape: Extract<CompiledShape, { kind: "mesh" }>,
  resolve: TextureResolver,
): void {
  const resource = resolve(shape.textureId);
  if (!resource) {
    throw new Error(`纹理未注册: ${shape.textureId}`);
  }
  const { vertices, cols, rows } = shape;
  const cellWidth = resource.width / (cols - 1);
  const cellHeight = resource.height / (rows - 1);
  for (let j = 0; j < rows - 1; j += 1) {
    for (let i = 0; i < cols - 1; i += 1) {
      const v00 = vertices[j * cols + i];
      const v10 = vertices[j * cols + i + 1];
      const v01 = vertices[(j + 1) * cols + i];
      if (!v00 || !v10 || !v01) {
        throw new Error(`网格顶点缺失: ${shape.textureId} @${i},${j}`);
      }
      const padLeft = i > 0 ? SEAM_PAD : 0;
      const padTop = j > 0 ? SEAM_PAD : 0;
      const padRight = i < cols - 2 ? SEAM_PAD : 0;
      const padBottom = j < rows - 2 ? SEAM_PAD : 0;
      const sourceX = i * cellWidth - padLeft;
      const sourceY = j * cellHeight - padTop;
      const sourceW = cellWidth + padLeft + padRight;
      const sourceH = cellHeight + padTop + padBottom;
      context.save();
      // 单位正方形 (0,0)(1,0)(0,1) 映射到单元三点：基向量差即矩阵系数。
      context.transform(
        v10[0] - v00[0],
        v10[1] - v00[1],
        v01[0] - v00[0],
        v01[1] - v00[1],
        v00[0],
        v00[1],
      );
      // 裁剪域与源块同步外扩，保持采样与显示范围一致。
      context.beginPath();
      context.rect(
        -padLeft / cellWidth,
        -padTop / cellHeight,
        sourceW / cellWidth,
        sourceH / cellHeight,
      );
      context.clip();
      context.drawImage(
        resource.image,
        sourceX,
        sourceY,
        sourceW,
        sourceH,
        -padLeft / cellWidth,
        -padTop / cellHeight,
        sourceW / cellWidth,
        sourceH / cellHeight,
      );
      context.restore();
    }
  }
}

/** 按指令流顺序执行绘制；顺序即 zOrder 展开序，后画覆盖先画。 */
export function draw(
  context: DrawingContext,
  plan: DrawPlan,
  resources?: TextureResolver,
): void {
  for (const command of plan.commands) {
    context.globalCompositeOperation = command.composite;
    context.globalAlpha = command.opacity;
    context.fillStyle = command.fillStyle;
    const [a, b, c, d, e, f] = command.transform;
    context.setTransform(a, b, c, d, e, f);
    const shape = command.shape;
    if (shape.kind === "mesh") {
      if (!resources) {
        throw new Error(`指令流含素材网格但未提供资源解析: ${shape.textureId}`);
      }
      drawMesh(context, shape, resources);
      continue;
    }
    context.beginPath();
    if (shape.kind === "ellipse") {
      context.ellipse(shape.cx, shape.cy, shape.rx, shape.ry, 0, 0, TAU);
    } else {
      for (const step of shape.commands) {
        if (step.kind === "moveTo") {
          context.moveTo(step.x, step.y);
        } else if (step.kind === "lineTo") {
          context.lineTo(step.x, step.y);
        } else if (step.kind === "bezierCurveTo") {
          context.bezierCurveTo(
            step.c1x,
            step.c1y,
            step.c2x,
            step.c2y,
            step.x,
            step.y,
          );
        } else {
          context.closePath();
        }
      }
    }
    context.fill();
  }
}
