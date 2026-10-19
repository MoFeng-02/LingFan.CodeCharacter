/**
 * canvas2d 渲染器公共出口：编译（buildDrawPlan）、指纹（fingerprint）、执行（draw）。
 *
 * 是什么：渲染器三步走的唯一入口——纯消费状态向量，不 import 内核与域包。
 * 怎么用：见各文件头注释；消费方只需要 contracts 的 CharacterState。
 */

export {
  buildDrawPlan,
  fingerprint,
  type DrawCommand,
  type DrawPlan,
  type CompiledPathCommand,
  type CompiledShape,
} from "./commands.js";
export { draw, type DrawingContext } from "./draw.js";
export {
  applyToPoint,
  compose,
  IDENTITY,
  scaleTransform,
  toTuple,
} from "./transform.js";
