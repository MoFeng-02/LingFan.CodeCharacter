/**
 * 外观节点：一张图 + 一副骨架 → 一条可形变的网格基元。
 *
 * 是什么：配方里唯一的节点，读取参数槽位，把静止网格蒙皮成新顶点表，
 *         产出带纹理标识的 MeshPrimitive。
 * 为什么：单图方案的表达力全部来自「权重 × 骨骼变换」，这两样都与时间无关
 *         的结构（网格、权重表）在构造期算好，每帧只做一次矩阵混合——
 *         求值因此保持 O(顶点数) 的纯算术，不随时间积累任何状态。
 * 怎么用：内核按拓扑序求值；组合根把纹理注册到资源表，渲染器按标识贴图。
 * 注意事项：transform 保持单位矩阵（位移已在顶点里）；眨眼用眼带几何压缩
 *          近似——单图没有眼睑层，这是本方案最弱的一环，能读作眯眼但不等于
 *          真实闭眼；真正闭眼需要分层素材。
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
import { squeezeEyeBand, skinVertices } from "./skin";
import {
  BLINK_SQUEEZE,
  EYE_BAND,
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

/** 求值：读参数 → 算骨骼变换 → 蒙皮 → 眼带压缩 → 产网格基元。 */
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
  const skinned = skinVertices(REST, WEIGHTS, transforms);
  const vertices = squeezeEyeBand(
    skinned,
    read(SLOT.blink),
    EYE_BAND,
    BLINK_SQUEEZE,
  );

  const mesh: MeshPrimitive = {
    kind: "mesh",
    cols: GRID_COLS,
    rows: GRID_ROWS,
    vertices,
    textureId: TEXTURE_ID,
  };
  const primitive: RenderPrimitive = {
    nodeId: SURFACE_NODE_ID,
    shape: mesh,
    transform: IDENTITY,
    tint: WHITE,
    blend: "normal",
    opacity: 1,
  };
  return { values: {}, primitives: [primitive] };
};

/** 外观节点声明：只读不写，产出一条网格基元。 */
export const surfaceNode: NodeDeclaration = {
  id: SURFACE_NODE_ID,
  reads: SURFACE_READS,
  writes: [],
  step: surfaceStep,
};
