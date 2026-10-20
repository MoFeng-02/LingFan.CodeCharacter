/**
 * 3D 采样渲染器唯一出口。
 *
 * 是什么：@lingfan-character/renderer-soft-raster 的 barrel——把立体几何
 *         采样为 2D 状态向量的纯函数集。
 * 为什么：采样器只依赖契约与运算原语，执行层由既有 2D 渲染器承担，
 *         指纹判据与组合根零改动。
 * 怎么用：import { sampleState } from 包根；computeAt → sampleState →
 *         交给 2D 渲染器编译与绘制。
 * 注意事项：采样是纯函数，同一状态两遍采样逐字节一致；不接触画布
 *          尺寸，像素映射仍由 2D 渲染器的缩放承担。
 */

export { sampleState } from "./sample";
export { shadeBand } from "./shade";
