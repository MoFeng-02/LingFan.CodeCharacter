/**
 * 3D 采样器：把立体几何基元编译为 2D 形状基元。
 *
 * 是什么：纯函数 sampleState——遍历状态向量，把每个 solid3d 基元按其
 *         采样视角旋转、投影到归一化平面，做背面剔除与画家算法排序、
 *         按面朝向取色带，展开为一组 2D 路径基元；其余基元原样透传。
 * 为什么：2D 表象 = 对 3D 几何任意视角的采样；采样输出仍是状态向量，
 *         下游执行层、指纹判据与组合根全部复用既有 2D 管线，零改动。
 * 怎么用：computeAt 得到 state 后先过 sampleState 再交给 2D 渲染器；
 *         采样不接触画布尺寸——像素映射仍由渲染器的缩放承担。
 * 注意事项：面顶点按「从外部看逆时针」约定，法线 z 分量大于零视为
 *          正面；顶点位于局部单位域（−1..1），投影映射为 0..1，且
 *          y 轴在投影时翻转——几何沿用数学约定（y 向上），图像平面
 *          y 向下；立体基元的整体色（tint）不参与面色，面色只由色带
 *          决定；索引越界与非法色带一律报错而非静默。
 */

import type {
  CharacterState,
  NodeState,
  RenderPrimitive,
  SolidPrimitive,
  Vec3,
} from "@lingfan-character/contracts";
import { transformPoint, viewMatrix } from "@lingfan-character/primitives";
import { shadeBand } from "./shade";

/** 立体基元的形状窄化引用，供内部采样函数使用。 */
type SolidRenderPrimitive = RenderPrimitive & {
  readonly shape: SolidPrimitive;
};

/** 三维叉积。 */
function cross(u: Vec3, v: Vec3): Vec3 {
  return {
    x: u.y * v.z - u.z * v.y,
    y: u.z * v.x - u.x * v.z,
    z: u.x * v.y - u.y * v.x,
  };
}

/** 三维减法。 */
function subtract(u: Vec3, v: Vec3): Vec3 {
  return { x: u.x - v.x, y: u.y - v.y, z: u.z - v.z };
}

/** 单位域坐标映射到归一化平面（−1..1 → 0..1；y 翻转，数学空间向上、图像向下）。 */
function toPlane(v: Vec3): { x: number; y: number } {
  return { x: v.x * 0.5 + 0.5, y: 0.5 - v.y * 0.5 };
}

/** 采样一个立体基元：旋转、投影、剔除、排序、着色，产出面基元序列。 */
function sampleSolid(primitive: SolidRenderPrimitive): RenderPrimitive[] {
  const solid = primitive.shape;
  if (solid.vertices.length < 4) {
    throw new Error("立体几何顶点数至少为 4");
  }
  if (solid.shading.length < 2) {
    throw new Error("立体几何明暗色带至少为 2 档");
  }
  const matrix = viewMatrix(solid.view);
  const world = solid.vertices.map((vertex) => transformPoint(matrix, vertex));
  for (const face of solid.faces) {
    if (
      face.a >= world.length ||
      face.b >= world.length ||
      face.c >= world.length
    ) {
      throw new Error("立体几何面索引超出顶点表");
    }
  }

  const visible = solid.faces
    .map((face) => {
      const a = world[face.a]!;
      const b = world[face.b]!;
      const c = world[face.c]!;
      const normal = cross(subtract(b, a), subtract(c, a));
      return { a, b, c, normal, depth: (a.z + b.z + c.z) / 3 };
    })
    .filter((face) => face.normal.z > 0)
    .sort((u, v) => u.depth - v.depth);

  return visible.map((face) => {
    const band = shadeBand(face.normal, solid.shading);
    const p0 = toPlane(face.a);
    const p1 = toPlane(face.b);
    const p2 = toPlane(face.c);
    return {
      nodeId: primitive.nodeId,
      shape: {
        kind: "path",
        commands: [
          { kind: "moveTo", point: p0 },
          { kind: "lineTo", point: p1 },
          { kind: "lineTo", point: p2 },
          { kind: "closePath" },
        ],
      },
      transform: primitive.transform,
      tint: band,
      blend: primitive.blend,
      opacity: primitive.opacity,
    } satisfies RenderPrimitive;
  });
}

/**
 * 采样整个状态向量：solid3d 基元展开为 2D 面基元（保持节点归属与
 * 绘制序），其余基元与无立体内容的节点原样透传；输出仍是完整状态向量。
 */
export function sampleState(state: CharacterState): CharacterState {
  const nodes: Record<string, NodeState> = {};
  for (const nodeId of state.zOrder) {
    const node = state.nodes[nodeId];
    if (!node) {
      continue;
    }
    if (
      !node.primitives.some((primitive) => primitive.shape.kind === "solid3d")
    ) {
      nodes[nodeId] = node;
      continue;
    }
    const sampled: RenderPrimitive[] = [];
    for (const primitive of node.primitives) {
      if (primitive.shape.kind !== "solid3d") {
        sampled.push(primitive);
        continue;
      }
      sampled.push(...sampleSolid(primitive as SolidRenderPrimitive));
    }
    nodes[nodeId] = { ...node, primitives: sampled };
  }
  return { ...state, nodes };
}
