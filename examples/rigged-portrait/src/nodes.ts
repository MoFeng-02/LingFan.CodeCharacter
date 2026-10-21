/**
 * 外观节点：一张图 + 一副骨架 → 可形变的网格基元。
 *
 * 是什么：配方里唯一的节点，读取参数槽位，把静止网格蒙皮成新顶点表，
 *         产出带纹理标识的 MeshPrimitive。
 * 为什么：单图方案的表达力全部来自「权重 × 骨骼变换」，这两样都与时间无关
 *         的结构（网格、权重表）在构造期算好，每帧只做一次矩阵混合——
 *         求值因此保持 O(顶点数) 的纯算术，不随时间积累任何状态。
 * 怎么用：内核按拓扑序求值；组合根把纹理注册到资源表，渲染器按标识贴图。
 * 注意事项：transform 保持单位矩阵（位移已在顶点里）。眨眼不靠顶点压缩，
 *          而是两条网格共用同一份顶点、分别贴开眼图与闭眼图，按眨眼量
 *          交叉淡入——眼裂在本画幅里只有几个像素高，网格分辨率远低于它，
 *          顶点压缩的位移差会剪坏单元；眼皮像素由素材给出才自然。
 */

import type {
  MeshPrimitive,
  NodeDeclaration,
  NodeStep,
  RenderPrimitive,
} from "@lingfan-character/contracts";
import { boneTransforms, type BoneInputs } from "./bones";
import { restGrid } from "./mesh";
import { breathPhase } from "./rhythm";
import { OPAQUE_EPSILON, skinVertices } from "./skin";
import {
  CLOSED_TEXTURE_ID,
  GRID_COLS,
  GRID_ROWS,
  SLOT,
  TEXTURE_ID,
} from "./shared";
import { buildWeightTable } from "./weights";

const IDENTITY = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } as const;
const WHITE = { r: 1, g: 1, b: 1, a: 1 } as const;

/** 节点标识：层的名字就是节点的名字，状态向量与绘制序都靠它对齐。 */
export const SURFACE_NODE_ID = "rigged.appearance.surface";

/** 节点读取的全部输入槽位。 */
const SURFACE_READS = [
  SLOT.breathe,
  SLOT.headTurn,
  SLOT.blink,
  SLOT.mouthOpen,
  SLOT.wind,
  SLOT.swingAt,
  SLOT.swingAmplitude,
  SLOT.swingMs,
] as const;

/** 构造期算一次：静止网格与它的权重表，逐帧复用。 */
const REST = restGrid();
const WEIGHTS = buildWeightTable(REST);

/** 同拓扑的网格基元只差纹理标识，抽出来避免两处重复。 */
function meshWith(textureId: string, vertices: MeshPrimitive["vertices"]) {
  return {
    kind: "mesh",
    cols: GRID_COLS,
    rows: GRID_ROWS,
    vertices,
    textureId,
  } as MeshPrimitive;
}

/**
 * 求值：读参数 → 算骨骼变换 → 蒙皮 → 按眨眼量产出一条或两条网格基元。
 *
 * 为什么底层保持不透明：网格按单元切块绘制，半透明会让相邻单元的接缝
 * 透出底色，画面浮出格线。底层铺满不透明像素，上层只在眼区多出眼皮
 * 像素，淡入因此不会在身体上留下痕迹。
 */
const surfaceStep: NodeStep = (inputs, tMs, substream) => {
  const read = (slot: string): number => inputs.values[slot] ?? 0;
  const boneInputs: BoneInputs = {
    breathPhase: breathPhase(tMs),
    breathe: read(SLOT.breathe),
    headTurn: read(SLOT.headTurn),
    mouthOpen: read(SLOT.mouthOpen),
    wind: read(SLOT.wind),
    swingAt: read(SLOT.swingAt),
    swingAmplitude: read(SLOT.swingAmplitude),
    swingMs: read(SLOT.swingMs),
  };
  const transforms = boneTransforms(boneInputs, tMs, substream);
  const vertices = skinVertices(REST, WEIGHTS, transforms);

  const blink = Math.min(1, Math.max(0, read(SLOT.blink)));
  // 底层恒不透明：闭眼图除眼区外与开眼图逐像素相同，全闭时它自己就能铺满，
  // 因此全闭只画一层；过渡期底层留开眼图，闭眼图按眨眼量叠上去。
  const closedOnly = blink >= 1;
  const primitives: RenderPrimitive[] = [
    {
      nodeId: SURFACE_NODE_ID,
      shape: meshWith(closedOnly ? CLOSED_TEXTURE_ID : TEXTURE_ID, vertices),
      transform: IDENTITY,
      tint: WHITE,
      blend: "normal",
      opacity: 1,
    },
  ];
  if (!closedOnly && blink > OPAQUE_EPSILON) {
    primitives.push({
      nodeId: SURFACE_NODE_ID,
      shape: meshWith(CLOSED_TEXTURE_ID, vertices),
      transform: IDENTITY,
      tint: WHITE,
      blend: "normal",
      opacity: blink,
    });
  }
  return { values: {}, primitives };
};

/** 外观节点声明：只读不写，产出网格基元。 */
export const surfaceNode: NodeDeclaration = {
  id: SURFACE_NODE_ID,
  reads: SURFACE_READS,
  writes: [],
  step: surfaceStep,
};
