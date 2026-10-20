/**
 * 绘制指令流：state(t) 到 canvas2d 指令的确定性编译。
 *
 * 是什么：buildDrawPlan 把状态向量编译成纯像素绘制指令（DrawPlan），
 *         fingerprint 给出逐字节稳定的指令序列化串。
 * 为什么：确定性判据落在「同 state 编译两遍得到同一串」上——不依赖 canvas 位图、
 *         不依赖 GPU，也无需运行画布即可在 node 环境验收。
 * 怎么用：plan = buildDrawPlan(state, view)；draw(ctx, plan) 执行；fingerprint(plan) 比对。
 *         view 传数字 = 等比缩放（方画布）；传 ViewSize = 分轴缩放（非方形画幅）。
 * 注意事项：形状坐标保持归一化（与 state(t) 同域），画布缩放全部由 transform
 *          矩阵承担——最终像素点 = 缩放矩阵 · 节点形变 · 基元形变 · 形状点，
 *          缩放只允许出现一次；混合模式对契约外的取值必须报错（契约要求，
 *          不静默忽略）；指令流不含任何节点语义，只有形状、矩阵、颜色与顺序。
 */

import type {
  BlendMode,
  CharacterState,
  PathCommand,
  RgbaColor,
  ShapePrimitive,
} from "@lingfan-character/contracts";
import {
  compose,
  scaleTransform,
  toTuple,
  type ViewSize,
} from "./transform.js";

/** 编译后路径命令：坐标保持归一化，空间映射交给 transform。 */
export type CompiledPathCommand =
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

/** 编译后形状：路径、椭圆或网格，坐标均为归一化域。 */
export type CompiledShape =
  | { readonly kind: "path"; readonly commands: readonly CompiledPathCommand[] }
  | {
      readonly kind: "ellipse";
      readonly cx: number;
      readonly cy: number;
      readonly rx: number;
      readonly ry: number;
    }
  | {
      readonly kind: "mesh";
      readonly cols: number;
      readonly rows: number;
      /** 形变后控制点，行优先 [x, y] 元组，长度 = cols×rows。 */
      readonly vertices: readonly (readonly [number, number])[];
      readonly textureId: string;
    };

/** 单条填充指令：绘制执行器逐条照抄到 canvas2d，不再做任何运算。 */
export interface DrawCommand {
  readonly composite: string;
  readonly opacity: number;
  readonly fillStyle: string;
  /** 最终合成矩阵（画布缩放 × 节点形变 × 基元形变），setTransform 参数序。 */
  readonly transform: readonly [number, number, number, number, number, number];
  readonly shape: CompiledShape;
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

/** 编译路径命令：坐标保持归一化，空间映射交给指令的 transform。 */
function toCompiledCommand(command: PathCommand): CompiledPathCommand {
  switch (command.kind) {
    case "moveTo":
      return { kind: "moveTo", x: command.point.x, y: command.point.y };
    case "lineTo":
      return { kind: "lineTo", x: command.point.x, y: command.point.y };
    case "bezierCurveTo":
      return {
        kind: "bezierCurveTo",
        c1x: command.control1.x,
        c1y: command.control1.y,
        c2x: command.control2.x,
        c2y: command.control2.y,
        x: command.point.x,
        y: command.point.y,
      };
    case "closePath":
      return { kind: "closePath" };
  }
}

/** 编译形状：路径、椭圆与网格的坐标保持归一化，缩放由 transform 矩阵统一承担。 */
function toCompiledShape(shape: ShapePrimitive): CompiledShape {
  if (shape.kind === "ellipse") {
    return {
      kind: "ellipse",
      cx: shape.center.x,
      cy: shape.center.y,
      rx: shape.radiusX,
      ry: shape.radiusY,
    };
  }
  if (shape.kind === "mesh") {
    return {
      kind: "mesh",
      cols: shape.cols,
      rows: shape.rows,
      vertices: shape.vertices.map((point) => [point.x, point.y] as const),
      textureId: shape.textureId,
    };
  }
  if (shape.kind === "solid3d") {
    throw new Error(
      "canvas2d 渲染器无法执行立体几何基元，请改用 3D 采样渲染器",
    );
  }
  return {
    kind: "path",
    commands: shape.commands.map(toCompiledCommand),
  };
}

/**
 * 把状态向量编译为像素绘制指令流。
 * @param state 内核求值产出的状态向量
 * @param view 归一化坐标到画布像素的比例：数字 = 等比缩放（方画布），
 *             或 ViewSize = 分轴缩放（非方形画幅下保真素材宽高比）
 */
export function buildDrawPlan(
  state: CharacterState,
  view: number | ViewSize,
): DrawPlan {
  const scaleMatrix = scaleTransform(view);
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
        shape: toCompiledShape(primitive.shape),
      });
    }
  }
  return { coordinateSpace: state.coordinateSpace, commands };
}

/** 指纹：绘制指令流的逐字节序列化，同 state 两遍编译必然相同。 */
export function fingerprint(plan: DrawPlan): string {
  return JSON.stringify(plan.commands);
}
