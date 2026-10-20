/**
 * 层位移场的 barrel：共享场、局部场与组合入口的唯一出口。
 *
 * 是什么：分层配方的形变能力入口——外部只从这里取，不深入子文件。
 * 为什么：分层形变是本配方的核心概念，收成一个子域避免与节点装配混杂。
 * 怎么用：import { deformLayer, sharedDisplacement } from "./field"。
 * 注意事项：共享分量与局部分量必须分开导出——防撕裂判据直接对共享分量
 *          做断言，混在一起就无法单独验证。
 */

export {
  applyShared,
  resolveShared,
  sharedDisplacement,
  type SharedInput,
  type SharedParams,
} from "./shared";
export {
  DEPTH_SCALE_GAIN,
  INTRA_PARALLAX_GAIN,
  PROFILE_PIVOT,
  depthProfile,
  depthScale,
} from "./depth";
export { localDisplacement, parallaxShift, type LocalParams } from "./local";
export { deformLayer } from "./deform";
