import type {
  AffineTransform,
  BlendMode,
  NodeId,
  NormalizedPoint,
  PathCommand,
  RenderPrimitive,
  RgbaColor,
} from "@lingfan-character/contracts";

/** 单位矩阵：形变缺省值。 */
export const IDENTITY: AffineTransform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/** 数值钳制：槽位与几何共用。 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 仿射矩阵乘法（m 后作用于 n），系数序与 canvas2d setTransform 一致。 */
export function multiply(
  m: AffineTransform,
  n: AffineTransform,
): AffineTransform {
  return {
    a: m.a * n.a + m.c * n.b,
    b: m.b * n.a + m.d * n.b,
    c: m.a * n.c + m.c * n.d,
    d: m.b * n.c + m.d * n.d,
    e: m.a * n.e + m.c * n.f + m.e,
    f: m.b * n.e + m.d * n.f + m.f,
  };
}

/** 平移。 */
export function translate(tx: number, ty: number): AffineTransform {
  return { a: 1, b: 0, c: 0, d: 1, e: tx, f: ty };
}

/** 围绕锚点的缩放（呼吸起伏等体积感形变）。 */
export function scaleAround(
  cx: number,
  cy: number,
  sx: number,
  sy: number,
): AffineTransform {
  return multiply(
    multiply(translate(cx, cy), { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 }),
    translate(-cx, -cy),
  );
}

/** 围绕锚点的旋转（弧度，发摆等摆动形变）。 */
export function rotateAround(
  cx: number,
  cy: number,
  angle: number,
): AffineTransform {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return multiply(
    multiply(translate(cx, cy), {
      a: cos,
      b: sin,
      c: -sin,
      d: cos,
      e: 0,
      f: 0,
    }),
    translate(-cx, -cy),
  );
}

/** 归一化坐标点构造。 */
export function pt(x: number, y: number): NormalizedPoint {
  return { x, y };
}

/** 椭圆基元构造。 */
export function ellipse(
  nodeId: NodeId,
  center: NormalizedPoint,
  radiusX: number,
  radiusY: number,
  transform: AffineTransform,
  tint: RgbaColor,
  opacity = 1,
  blend: BlendMode = "normal",
): RenderPrimitive {
  return {
    nodeId,
    shape: { kind: "ellipse", center, radiusX, radiusY },
    transform,
    tint,
    blend,
    opacity,
  };
}

/** 路径基元构造（填充语义）。 */
export function fillPath(
  nodeId: NodeId,
  commands: readonly PathCommand[],
  transform: AffineTransform,
  tint: RgbaColor,
  opacity = 1,
  blend: BlendMode = "normal",
): RenderPrimitive {
  return {
    nodeId,
    shape: { kind: "path", commands },
    transform,
    tint,
    blend,
    opacity,
  };
}
