/**
 * 绘制指令流：state(t) 到 canvas2d 指令的确定性编译。
 *
 * 是什么：buildDrawPlan 把状态向量编译成纯像素绘制指令（DrawPlan），
 *         fingerprint 给出逐字节稳定的指令序列化串。
 * 为什么：确定性判据落在「同 state 编译两遍得到同一串」上——不依赖 canvas 位图、
 *         不依赖 GPU，也无需运行画布即可在 node 环境验收。
 * 怎么用：plan = buildDrawPlan(state, scale)；draw(ctx, plan) 执行；fingerprint(plan) 比对。
 * 注意事项：混合模式对契约外的取值必须报错（契约要求，不静默忽略）；
 *          指令流不含任何节点语义，只有形状、矩阵、颜色与顺序。
 */

import type {
  BlendMode,
  CharacterState,
  PathCommand,
  RgbaColor,
  ShapePrimitive,
} from "@lingfan-character/contracts";
import { compose, scaleTransform, toTuple } from "./transform.js";

/** 像素路径命令：坐标已乘缩放，扁平数字便于序列化。 */
export type PixelPathCommand =
  | { readonly kind: "moveTo"; readonly x: number; readonly y: number }
  | { readonly kind: "lineTo"; readonly x: number; readonly y: number }
  | {
      readonly kind: "bezierCurveTo";
      readonly c1x: number;
      readonly c1y: number;
      readonly c2x: number;
      readonly c2y: number;
      readonly x: number;
      readonly y: number;
    }
  | { readonly kind: "closePath" };

/** 像素形状：路径或椭圆，坐标均为画布像素。 */
export type PixelShape =
  | { readonly kind: "path"; readonly commands: readonly PixelPathCommand[] }
  | {
      readonly kind: "ellipse";
      readonly cx: number;
      readonly cy: number;
      readonly rx: number;
      readonly ry: number;
    };

/** 单条填充指令：绘制执行器逐条照抄到 canvas2d，不再做任何运算。 */
export interface DrawCommand {
  readonly composite: string;
  readonly opacity: number;
  readonly fillStyle: string;
  /** 最终合成矩阵（画布缩放 × 节点形变 × 基元形变），setTransform 参数序。 */
  readonly transform: readonly [number, number, number, number, number, number];
  readonly shape: PixelShape;
}

/** 绘制计划：一次绘制的全部指令，顺序即 zOrder 展开序。 */
export interface DrawPlan {
  readonly coordinateSpace: string;
  readonly commands: readonly DrawCommand[];
}

/** 契约混合模式到 canvas composite 的封闭映射；缺项即契约违规。 */
const BLEND_COMPOSITE: Readonly<Record<BlendMode, string>> = {
  normal: "source-over",
  multiply: "multiply",
  screen: "screen",
  overlay: "overlay",
};

/** 颜色转 canvas fillStyle：rgb 分量取整到 0..255，alpha 原样保留。 */
function fillStyleOf(color: RgbaColor): string {
  return `rgba(${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)},${color.a})`;
}

/** 像素化路径命令：所有坐标乘缩放。 */
function toPixelCommand(command: PathCommand, scale: number): PixelPathCommand {
  switch (command.kind) {
    case "moveTo":
      return {
        kind: "moveTo",
        x: command.point.x * scale,
        y: command.point.y * scale,
      };
    case "lineTo":
      return {
        kind: "lineTo",
        x: command.point.x * scale,
        y: command.point.y * scale,
      };
    case "bezierCurveTo":
      return {
        kind: "bezierCurveTo",
        c1x: command.control1.x * scale,
        c1y: command.control1.y * scale,
        c2x: command.control2.x * scale,
        c2y: command.control2.y * scale,
        x: command.point.x * scale,
        y: command.point.y * scale,
      };
    case "closePath":
      return { kind: "closePath" };
  }
}

/** 像素化形状：路径与椭圆的坐标乘缩放。 */
function toPixelShape(shape: ShapePrimitive, scale: number): PixelShape {
  if (shape.kind === "ellipse") {
    return {
      kind: "ellipse",
      cx: shape.center.x * scale,
      cy: shape.center.y * scale,
      rx: shape.radiusX * scale,
      ry: shape.radiusY * scale,
    };
  }
  return {
    kind: "path",
    commands: shape.commands.map((command) => toPixelCommand(command, scale)),
  };
}

/**
 * 把状态向量编译为像素绘制指令流。
 * @param state 内核求值产出的状态向量
 * @param scale 归一化坐标到画布像素的比例（画布边长 = 1 × scale）
 */
export function buildDrawPlan(state: CharacterState, scale: number): DrawPlan {
  const scaleMatrix = scaleTransform(scale);
  const commands: DrawCommand[] = [];
  for (const nodeId of state.zOrder) {
    const node = state.nodes[nodeId];
    if (!node) continue;
    for (const primitive of node.primitives) {
      const composite = BLEND_COMPOSITE[primitive.blend];
      if (composite === undefined) {
        throw new Error(`未声明的混合模式: ${String(primitive.blend)}`);
      }
      commands.push({
        composite,
        opacity: primitive.opacity,
        fillStyle: fillStyleOf(primitive.tint),
        transform: toTuple(
          compose(scaleMatrix, compose(node.transform, primitive.transform)),
        ),
        shape: toPixelShape(primitive.shape, scale),
      });
    }
  }
  return { coordinateSpace: state.coordinateSpace, commands };
}

/** 指纹：绘制指令流的逐字节序列化，同 state 两遍编译必然相同。 */
export function fingerprint(plan: DrawPlan): string {
  return JSON.stringify(plan.commands);
}
