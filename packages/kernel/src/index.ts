/**
 * 角色内核唯一出口。
 *
 * 是什么：@lingfan-character/kernel 的 barrel——编译、求值运行时、状态验证与类型化错误。
 * 为什么：组合根只从这里消费内核（原子化纪律，禁止深入包内路径 import）；
 *         求值语义的唯一实现落点在此，域包与渲染器都不复刻任何求值逻辑。
 * 怎么用：import { createCharacterRuntime, compile, validateState } from 包根。
 * 注意事项：坐标系常量也在此导出，state(t) 的 coordinateSpace 取值以它为准。
 */

export { compile, type CompiledGraph } from "./compile";
export {
  CHARACTER_COORDINATE_SPACE,
  createCharacterRuntime,
  type CharacterRuntime,
} from "./compute";
export {
  CompileError,
  ComputeError,
  type CompileErrorKind,
  type ComputeErrorKind,
} from "./errors";
export { validateState } from "./validate";
