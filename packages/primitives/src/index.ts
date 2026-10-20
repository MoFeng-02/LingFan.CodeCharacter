/**
 * 运算原语参考实现唯一出口。
 *
 * 是什么：@lingfan-character/primitives 的 barrel——契约规定算法的唯一实现落点。
 * 为什么：域包与内核从这里消费曲线与噪声求值，保证全仓同一算法只有一份；
 *         消费方只准从包根 import（原子化纪律）。
 * 怎么用：import { evaluateCurve, deriveSeed, createSubstream, evaluateNoise } from 包根。
 * 注意事项：本包只承载契约规定算法；新增原语实现须先在契约中声明算法语义。
 */

export { applyEasing, evaluateCurve } from "./curve";
export {
  chainOffsets,
  springResponse,
  type ChainSpec,
  type SpringPulse,
} from "./chain";
export { createSubstream, deriveSeed } from "./random";
export { evaluateNoise } from "./noise";
export { polyCos, polySin } from "./angle";
export {
  multiplyMat4,
  rotationX,
  rotationY,
  rotationZ,
  transformPoint,
  viewMatrix,
  type Mat4,
} from "./matrix3";
