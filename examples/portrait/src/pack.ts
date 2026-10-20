/**
 * portrait 配方组装：素材轨示范——立绘网格 + 四通道形变基。
 *
 * 是什么：CharacterPack 声明（槽位/节点/验证），外观节点把基参数
 *         求值成 MeshPrimitive 顶点表，textureId 指向宿主注册的位图。
 * 为什么：素材轨与程序轨共用同一套求值图与判据机器——配方只声明
 *         「顶点是哪些输入的纯函数」，位图本体由组合根装配。
 * 怎么用：组合根 createCharacterRuntime(portraitPack) → computeAt(t) →
 *         buildDrawPlan → draw(ctx, plan, resources)。
 * 注意事项：节点写出值在 state 的 params 与 primitives 中；
 *          顶点表逐字节确定，指纹含全部顶点坐标。
 */

import type {
  CharacterPack,
  MeshPrimitive,
  NodeDeclaration,
  NormalizedPoint,
} from "@lingfan-character/contracts";
import { deformGrid } from "./mesh";
import {
  DEFAULTS,
  RANGES,
  SLOT,
  TEXTURE_ID,
  GRID_COLS,
  GRID_ROWS,
} from "./shared";

const NODE_SURFACE = "portrait.appearance.surface";

/** 槽位声明：四通道输入，范围与缺省表同源。 */
const slots = [
  { name: SLOT.breathe, direction: "input" as const },
  { name: SLOT.blink, direction: "input" as const },
  { name: SLOT.mouthOpen, direction: "input" as const },
  { name: SLOT.headTurn, direction: "input" as const },
].map((slot) => ({
  ...slot,
  defaultValue: DEFAULTS[slot.name],
  range: RANGES[slot.name],
}));

/** 外观节点：网格顶点 = 四通道输入与呼吸节律的纯函数；无输出槽。 */
const surfaceNode = {
  id: NODE_SURFACE,
  reads: [SLOT.breathe, SLOT.blink, SLOT.mouthOpen, SLOT.headTurn],
  writes: [],
  step: (inputs, tMs, substream) => {
    void substream;
    const read = (slot: string): number => inputs.values[slot] ?? 0;
    const vertices: NormalizedPoint[] = deformGrid(
      {
        breathPhase: 0,
        blink: read(SLOT.blink),
        mouthOpen: read(SLOT.mouthOpen),
        headTurn: read(SLOT.headTurn),
        breatheAmp: read(SLOT.breathe),
      },
      tMs,
    );
    const mesh: MeshPrimitive = {
      kind: "mesh",
      cols: GRID_COLS,
      rows: GRID_ROWS,
      vertices,
      textureId: TEXTURE_ID,
    };
    return {
      values: {},
      primitives: [
        {
          nodeId: NODE_SURFACE,
          shape: mesh,
          transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
          tint: { r: 1, g: 1, b: 1, a: 1 },
          blend: "normal" as const,
          opacity: 1,
        },
      ],
    };
  },
} satisfies NodeDeclaration;

/** portrait 配方：单外观节点 + 四输入槽。 */
export const portraitPack: CharacterPack = {
  declaration: { id: "portrait", version: "0.1.0", families: ["appearance"] },
  slots,
  nodes: [surfaceNode],
  edges: [],
  validations: [],
  substep: { kind: "fixed", count: 1 },
};
