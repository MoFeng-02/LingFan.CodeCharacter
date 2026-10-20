/**
 * 分层素材轨示范配方的唯一出口。
 *
 * 是什么：@lingfan-character/example-layered 的 barrel——槽位表、层规格、
 *         形变场工具、层节点与配方声明。
 * 为什么：组合根与测试只从包根 import；分层的核心概念是「共享场 + 局部场」，
 *         两者必须能被单独取用，防撕裂判据才能直接对共享分量做断言。
 * 怎么用：import { layeredPack, SLOT, LAYER_SPECS } from 包根。
 * 注意事项：纹理标识是宿主资源表的键，配方位图本体不在此包内。
 */

export {
  BREATH_GAIN,
  BREATH_ORIGIN,
  BREATH_PERIOD_MS,
  BROW_OPEN_GAIN,
  BROW_SMILE_GAIN,
  DEFAULTS,
  FIELD_NODE_ID,
  FIELD_SLOT,
  GAZE_X_GAIN,
  GAZE_Y_GAIN,
  LAYER_SPECS,
  LID_TRAVEL,
  MOUTH_OPEN_GAIN,
  PARALLAX_GAIN,
  PARALLAX_PIVOT,
  RANGES,
  SLOT,
  SWING_GAIN,
  TURN_SHIFT_GAIN,
  WIND_GAIN,
  WIND_NOISE,
  layerNodeId,
  layerSpec,
  type FieldSlotId,
  type LayerKind,
  type LayerSpec,
  type SlotId,
  type SlotKey,
} from "./shared";
export {
  applyShared,
  deformLayer,
  localDisplacement,
  parallaxShift,
  resolveShared,
  sharedDisplacement,
  type LocalParams,
  type SharedInput,
  type SharedParams,
} from "./field";
export { restLayer } from "./layers";
export { fieldParamsNode } from "./params";
export { layerNodes } from "./nodes";
export { layeredPack } from "./pack";
