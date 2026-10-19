/**
 * 仿射变换合成：渲染侧唯一的几何运算。
 *
 * 是什么：canvas2d 同序六系数矩阵（a b c d e f）的乘法与点变换。
 * 为什么：渲染器把「画布缩放 × 节点形变 × 基元形变」合成单一矩阵后下发给绘制层，
 *         指令流因此只含最终矩阵，指纹与绘制都不必理解矩阵来源。
 * 怎么用：compose(outer, inner) 表示先应用 inner 再应用 outer。
 * 注意事项：不做裁剪与归一化，保持逐字节确定性；输入恒等元时输出仍为精确恒等矩阵。
 */

import type {
  AffineTransform,
  NormalizedPoint,
} from "@lingfan-character/contracts";

/** 恒等变换：任何合成链的起点。 */
export const IDENTITY: AffineTransform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/** 等比缩放矩阵：归一化坐标到画布像素的唯一入口。 */
export function scaleTransform(scale: number): AffineTransform {
  return { a: scale, b: 0, c: 0, d: scale, e: 0, f: 0 };
}

/** 合成两个变换：先应用 inner，再应用 outer。 */
export function compose(
  outer: AffineTransform,
  inner: AffineTransform,
): AffineTransform {
  return {
    a: outer.a * inner.a + outer.c * inner.b,
    b: outer.b * inner.a + outer.d * inner.b,
    c: outer.a * inner.c + outer.c * inner.d,
    d: outer.b * inner.c + outer.d * inner.d,
    e: outer.a * inner.e + outer.c * inner.f + outer.e,
    f: outer.b * inner.e + outer.d * inner.f + outer.f,
  };
}

/** 变换作用于点：x' = a·x + c·y + e；y' = b·x + d·y + f。 */
export function applyToPoint(
  m: AffineTransform,
  p: NormalizedPoint,
): NormalizedPoint {
  return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
}

/** 展开为 canvas setTransform 参数顺序的六元组。 */
export function toTuple(
  m: AffineTransform,
): [number, number, number, number, number, number] {
  return [m.a, m.b, m.c, m.d, m.e, m.f];
}
