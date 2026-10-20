/**
 * rigged-portrait 公共出口。
 *
 * 是什么：单图权重蒙皮配方的唯一入口——配方本体、槽位常量、骨骼表与
 *         蒙皮数学都从这里导出。
 * 为什么：组合根只认包名，不认内部路径；蒙皮数学导出是为了让判据能对
 *         纯函数单独验证（不必每次都跑完整求值图）。
 * 怎么用：`import { riggedPortraitPack, SLOT, TEXTURE_ID } from
 *         "@lingfan-character/example-rigged-portrait"`。
 * 注意事项：配方内部的构造期缓存（静止网格、权重表）属于实现细节，
 *          不导出——外部无需也不应依赖这些数组的引用身份。
 */

export { riggedPortraitPack } from "./pack";
export { surfaceNode } from "./nodes";
export { restGrid } from "./mesh";
export {
  buildWeightTable,
  weightsAt,
  type WeightRow,
  type WeightTable,
} from "./weights";
export { skinVertices, squeezeEyeBand } from "./skin";
export { boneTransforms, type BoneInputs } from "./bones";
export { breathPhase } from "./rhythm";
export {
  BLINK_SQUEEZE,
  BONE,
  BONE_ANCHOR,
  BONE_ORDER,
  BONE_RADIUS,
  BREATH_LIFT,
  BREATH_PERIOD_MS,
  CHEST_SWING,
  DEFAULTS,
  EYE_BAND,
  GRID_COLS,
  GRID_ROWS,
  HEAD_SWING,
  HEAD_TILT_RAD,
  JAW_BAND,
  JAW_DROP,
  RANGES,
  ROOT_BASE_WEIGHT,
  SKIRT_SWING,
  SLOT,
  TEXTURE_ID,
  WIND_NOISE,
  type BoneId,
  type SlotId,
} from "./shared";
