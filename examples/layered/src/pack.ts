/**
 * layered 配方组装：分层素材轨示范——十二层贴图网格 + 两级形变场。
 *
 * 是什么：CharacterPack 声明（槽位/节点/验证），一个参数节点算出形变场
 *         参数，十二个层节点各把静止网格形变成 MeshPrimitive。
 * 为什么：分层素材的表达力全在「层的组织 + 位移场」，求值图本身与程序轨
 *         完全同构——这正是素材轨与程序轨能共融的原因：配方只声明顶点
 *         是哪些输入的纯函数，位图本体由组合根装配。
 * 怎么用：组合根 createCharacterRuntime(layeredPack) → computeAt(t) →
 *         buildDrawPlan → draw(ctx, plan, resources)。
 * 注意事项：节点数组序 = zOrder = 绘制序，层规格数组序必须与此一致；
 *          参数节点与层节点的先后由「层读场槽、参数节点写场槽」天然确定，
 *          不需要额外耦合边；纹理标识只是宿主资源表的键，位图绝不能进
 *          状态向量（否则指纹会随素材变化而漂移）。
 */

import type {
  CharacterPack,
  NodeDeclaration,
} from "@lingfan-character/contracts";
import { layerNodes } from "./nodes";
import { fieldParamsNode } from "./params";
import { DEFAULTS, FIELD_SLOT, LAYER_SPECS, RANGES, SLOT } from "./shared";

/** 输入槽位声明：范围与缺省表同源，缺省值必然落在范围内。 */
const inputSlots = Object.values(SLOT).map((name) => ({
  name,
  direction: "input" as const,
  defaultValue: DEFAULTS[name],
  range: RANGES[name],
}));

/** 场参数槽位声明：由参数节点写出，无缺省值（缺省由节点求值决定）。 */
const fieldSlots = Object.values(FIELD_SLOT).map((name) => ({
  name,
  direction: "output" as const,
}));

/** 参数节点在前、层节点按绘制序紧随：数组序即 zOrder。 */
const nodes: NodeDeclaration[] = [fieldParamsNode, ...layerNodes];

/** layered 配方：参数节点 + 十二层节点，输入滑杆驱动全部形变。 */
export const layeredPack: CharacterPack = {
  declaration: {
    id: "layered",
    version: "0.1.0",
    families: ["appearance", "motion"],
  },
  slots: [...inputSlots, ...fieldSlots],
  nodes,
  edges: [],
  validations: [],
  substep: { kind: "fixed", count: 1 },
};

export { FIELD_SLOT, LAYER_SPECS, SLOT };
