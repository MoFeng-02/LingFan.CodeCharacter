/**
 * rigged-portrait 配方组装：单图权重蒙皮示范。
 *
 * 是什么：CharacterPack 声明——一张立绘贴图套在 36×54 网格上，十二根骨骼
 *         按权重牵引顶点，产出唯一一条网格基元。
 * 为什么：这条路把「画」与「动」彻底分开——美术资产是一张现成图片，
 *         长相 1:1 保留；动作由骨骼变换的加权混合决定，位移是解析函数。
 *         与分层素材轨相比少了一层「切图」工作，代价是失去层间解耦
 *         （闭眼、眼球转动只能靠几何近似）。
 * 怎么用：组合根 createCharacterRuntime(riggedPortraitPack) → computeAt(t)
 *         → buildDrawPlan → draw(ctx, plan, resolveTexture)。
 * 注意事项：槽位缺省值与范围同源声明，编译器保证缺省落在范围内；
 *          纹理标识只是宿主资源表的键，位图本体不进状态向量。
 */

import type {
  CharacterPack,
  NodeDeclaration,
} from "@lingfan-character/contracts";
import { surfaceNode } from "./nodes";
import { DEFAULTS, RANGES, SLOT } from "./shared";

/** 输入槽位声明：范围与缺省表同源，缺省值必然落在范围内。 */
const inputSlots = Object.values(SLOT).map((name) => ({
  name,
  direction: "input" as const,
  defaultValue: DEFAULTS[name],
  range: RANGES[name],
}));

/** 单节点配方：外观节点产出全部绘制内容。 */
const nodes: NodeDeclaration[] = [surfaceNode];

/** rigged-portrait 配方：一张立绘 + 一副骨架。 */
export const riggedPortraitPack: CharacterPack = {
  declaration: {
    id: "rigged",
    version: "0.1.0",
    families: ["appearance", "motion"],
  },
  slots: inputSlots,
  nodes,
  edges: [],
  validations: [],
  substep: { kind: "fixed", count: 1 },
};
