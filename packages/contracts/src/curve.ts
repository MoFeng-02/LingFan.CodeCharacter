/**
 * 曲线原语契约：把 t 映射为数值的确定性运算，声明式描述。
 *
 * 是什么：曲线表达式的判别联合（常量、线性、缓动、求和、缩放、时移、循环）
 *         与缓动函数白名单。
 * 为什么：角色定义是文本数据（可 diff、可审查），曲线以声明树表达而非闭包；
 *         白名单保证跨实现重合——白名单外的缓动属于契约增补，必须显式迁移。
 * 怎么用：参数曲线、包络与 retiming 都用本联合表达；求值实现由内核提供（见签名）。
 * 注意事项：确定性白名单只允许加减乘除与比较，多项式缓动满足该约束；
 *          任何超越函数（三角、指数）禁止进入缓动实现，避免跨设备浮点差异。
 */

import type { TimeMs } from "./state";

/**
 * 缓动函数白名单：多项式缓动，跨设备逐字节确定。
 * linear 恒等；smoothstep 为 3t^2 - 2t^3；smootherstep 为 6t^5 - 15t^4 + 10t^3；
 * 其余按名称对应标准二次/三次多项式缓动。
 */
export type EasingName =
  | "linear"
  | "smoothstep"
  | "smootherstep"
  | "easeInQuad"
  | "easeOutQuad"
  | "easeInOutQuad"
  | "easeInCubic"
  | "easeOutCubic"
  | "easeInOutCubic";

/** 区间缓动段：fromMs 到 toMs 之间从 fromValue 过渡到 toValue。 */
export interface EasingSegment {
  readonly kind: "easing";
  readonly fromMs: TimeMs;
  readonly toMs: TimeMs;
  readonly fromValue: number;
  readonly toValue: number;
  readonly easing: EasingName;
}

/**
 * 曲线表达式。
 * timeShift 平移输入时间（retiming）；cycle 以 periodMs 为周期重复基曲线（呼吸等）；
 * sum 与 scale 提供线性组合。全部求值只用加减乘除。
 */
export type CurveExpr =
  | { readonly kind: "constant"; readonly value: number }
  | EasingSegment
  | { readonly kind: "sum"; readonly parts: readonly CurveExpr[] }
  | {
      readonly kind: "scale";
      readonly factor: number;
      readonly base: CurveExpr;
    }
  | {
      readonly kind: "timeShift";
      readonly offsetMs: TimeMs;
      readonly base: CurveExpr;
    }
  | {
      readonly kind: "cycle";
      readonly periodMs: TimeMs;
      readonly base: CurveExpr;
    };

/** 曲线求值签名：内核提供实现，结果对同一表达式与 t 恒定。 */
export type CurveEvaluator = (expr: CurveExpr, tMs: TimeMs) => number;
