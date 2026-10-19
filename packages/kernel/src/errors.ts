/**
 * 内核错误：跨边界失败一律显式类型化，禁止裸 Error 与吞错。
 *
 * 是什么：编译期与求值期的类型化错误——错误种类枚举加定位明细。
 * 为什么：组合根与测试需要按种类分支处理（写冲突要改域包，环要改耦合声明），
 *         字符串匹配错误文本脆弱；种类枚举让失败可被机器判别。
 * 怎么用：catch 后按 instanceof 与 kind 判别；details 携带节点与槽位标识用于定位。
 * 注意事项：错误信息面向开发者，不携带任何内部流程叙事；
 *          新增错误种类属于内核契约增补，只增不改。
 */

/** 编译失败种类。 */
export type CompileErrorKind =
  | "duplicate-node"
  | "duplicate-slot"
  | "write-conflict"
  | "cycle"
  | "unknown-slot"
  | "slot-naming"
  | "default-out-of-range";

/** 编译期错误：域包声明无法构成合法求值图。 */
export class CompileError extends Error {
  readonly kind: CompileErrorKind;
  readonly details: Readonly<Record<string, string>>;

  constructor(
    kind: CompileErrorKind,
    message: string,
    details: Readonly<Record<string, string>> = {},
  ) {
    super(message);
    this.name = "CompileError";
    this.kind = kind;
    this.details = details;
  }
}

/** 求值失败种类。 */
export type ComputeErrorKind = "invalid-grid" | "invalid-override";

/** 求值期错误：采样网格或显式参数非法。 */
export class ComputeError extends Error {
  readonly kind: ComputeErrorKind;
  readonly details: Readonly<Record<string, string>>;

  constructor(
    kind: ComputeErrorKind,
    message: string,
    details: Readonly<Record<string, string>> = {},
  ) {
    super(message);
    this.name = "ComputeError";
    this.kind = kind;
    this.details = details;
  }
}
