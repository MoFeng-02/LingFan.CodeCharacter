/**
 * 画布与执行接口：查询 DOM、收窄空值，并把 DOM 2D 上下文适配成
 * 渲染器的最小执行接口——渲染器不依赖 DOM 宽类型，tests 里用替身实现。
 * 注意：守卫抛错即终止脚本；此后 stage / ctx / drawingTarget 必然可用。
 */

import type { DrawingContext } from "@lingfan-character/renderer-canvas2d";

const canvas = document.querySelector<HTMLCanvasElement>("#stage");
const context = canvas?.getContext("2d");
const statusElement = document.querySelector<HTMLElement>("#status");
if (!canvas || !context) {
  throw new Error("找不到画布或 2d 上下文，请确认 index.html 结构完整");
}

/** 收窄后的稳定引用：此后画布与上下文必然存在。 */
export const stage: HTMLCanvasElement = canvas;
export const ctx: CanvasRenderingContext2D = context;
export const status: HTMLElement | null = statusElement;

/** DOM 上下文到渲染器最小执行接口的适配：属性写入原样传导到画布。 */
export const drawingTarget: DrawingContext = {
  get globalCompositeOperation() {
    return ctx.globalCompositeOperation;
  },
  set globalCompositeOperation(value: string) {
    ctx.globalCompositeOperation = value as GlobalCompositeOperation;
  },
  get globalAlpha() {
    return ctx.globalAlpha;
  },
  set globalAlpha(value: number) {
    ctx.globalAlpha = value;
  },
  get fillStyle() {
    return ctx.fillStyle as string;
  },
  set fillStyle(value: string) {
    ctx.fillStyle = value;
  },
  setTransform: (a, b, c, d, e, f) => ctx.setTransform(a, b, c, d, e, f),
  beginPath: () => ctx.beginPath(),
  moveTo: (x, y) => ctx.moveTo(x, y),
  lineTo: (x, y) => ctx.lineTo(x, y),
  bezierCurveTo: (c1x, c1y, c2x, c2y, x, y) =>
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, x, y),
  closePath: () => ctx.closePath(),
  ellipse: (x, y, radiusX, radiusY, rotation, startAngle, endAngle) =>
    ctx.ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle),
  fill: () => ctx.fill(),
  clip: () => ctx.clip(),
  save: () => ctx.save(),
  restore: () => ctx.restore(),
  transform: (a, b, c, d, e, f) => ctx.transform(a, b, c, d, e, f),
  rect: (x, y, width, height) => ctx.rect(x, y, width, height),
  drawImage: (image, sx, sy, sw, sh, dx, dy, dw, dh) =>
    ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh),
};
