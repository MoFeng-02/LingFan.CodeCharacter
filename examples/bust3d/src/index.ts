/**
 * 立体半身像示例配方唯一出口。
 *
 * 是什么：@lingfan-character/example-bust3d 的 barrel——最小立体配方，
 *         参数化头骨几何加采样视角，验证「转头出真实侧脸」全链路。
 * 为什么：示例配方演示契约用法，不背 API 稳定性承诺。
 * 怎么用：import { bust3dPack, SLOT } from 包根。
 * 注意事项：本配方无输出槽与耦合边；视角与几何都在节点内逐帧重算。
 */

export { bust3dPack, NODE_ID, SLOT, DEFAULTS, RANGES } from "./pack";
export { buildHead, type HeadGeometry } from "./geometry";
