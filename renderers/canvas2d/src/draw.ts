/**
 * 绘制执行器：把绘制计划逐条照抄到 canvas2d 上下文。
 *
 * 是什么：draw(ctx, plan) 只做指令执行——设矩阵、设样式、建路径、填充。
 * 为什么：执行层零运算保证「指令流是什么样，画出来就是什么样」，
 *         指纹判据与可见结果一一对应；渲染器因此不需要理解角色语义。
 * 怎么用：const plan = buildDrawPlan(state, scale); draw(ctx, plan)。
 * 注意事项：不保存/恢复上下文状态，由调用方决定帧间隔离；
 *          path 命令只支持契约四种，多余种类在编译期类型层即被排除。
 */

import type { DrawPlan } from "./commands.js";

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
  globalCompositeOperation: string;
  globalAlpha: number;
  fillStyle: string;
}

/** 全角弧度：椭圆基元的闭合圆。 */
const TAU = Math.PI * 2;

/** 按指令流顺序执行绘制；顺序即 zOrder 展开序，后画覆盖先画。 */
export function draw(context: DrawingContext, plan: DrawPlan): void {
  for (const command of plan.commands) {
    context.globalCompositeOperation = command.composite;
    context.globalAlpha = command.opacity;
    context.fillStyle = command.fillStyle;
    const [a, b, c, d, e, f] = command.transform;
    context.setTransform(a, b, c, d, e, f);
    context.beginPath();
    const shape = command.shape;
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
