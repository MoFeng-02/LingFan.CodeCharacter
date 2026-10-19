/**
 * 确定性曲线求值：契约规定缓动白名单与表达式语义的参考实现。
 *
 * 是什么：CurveExpr 的求值器——常量、缓动段、求和、缩放、时移、循环。
 * 为什么：曲线是跨实现重合的运算原语，算法必须唯一且只依赖加减乘除与比较；
 *         这里是全仓唯一的曲线求值实现，禁止在别处另写求值逻辑。
 * 怎么用：域包在节点求值中调用 evaluateCurve(expr, tMs) 得到参数值。
 * 注意事项：全部运算为 IEEE 双精度四则运算与整数比较，无超越函数；
 *          缓动段在区间外取边界值；循环把时间映射到 0..periodMs 的相位后求值。
 */

import type {
  CurveExpr,
  EasingName,
  TimeMs,
} from "@lingfan-character/contracts";

const clampUnit = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** 缓动白名单求值：全部为多项式，输入先钳制到 0..1。 */
export const applyEasing = (easing: EasingName, u: number): number => {
  const t = clampUnit(u);
  switch (easing) {
    case "linear":
      return t;
    case "smoothstep":
      return t * t * (3 - 2 * t);
    case "smootherstep":
      return t * t * t * (t * (t * 6 - 15) + 10);
    case "easeInQuad":
      return t * t;
    case "easeOutQuad":
      return 1 - (1 - t) * (1 - t);
    case "easeInOutQuad":
      return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
    case "easeInCubic":
      return t * t * t;
    case "easeOutCubic":
      return 1 - (1 - t) * (1 - t) * (1 - t);
    case "easeInOutCubic":
      return t < 0.5
        ? 4 * t * t * t
        : 1 - ((-2 * t + 2) * (-2 * t + 2) * (-2 * t + 2)) / 2;
  }
};

/** 曲线表达式求值：同一表达式与 t 恒得同一值。 */
export const evaluateCurve = (expr: CurveExpr, tMs: TimeMs): number => {
  switch (expr.kind) {
    case "constant":
      return expr.value;
    case "easing": {
      const span = expr.toMs - expr.fromMs;
      const u = span === 0 ? 1 : (tMs - expr.fromMs) / span;
      return (
        expr.fromValue +
        (expr.toValue - expr.fromValue) * applyEasing(expr.easing, u)
      );
    }
    case "sum":
      return expr.parts.reduce(
        (acc, part) => acc + evaluateCurve(part, tMs),
        0,
      );
    case "scale":
      return expr.factor * evaluateCurve(expr.base, tMs);
    case "timeShift":
      return evaluateCurve(expr.base, tMs - expr.offsetMs);
    case "cycle": {
      const phase = ((tMs % expr.periodMs) + expr.periodMs) % expr.periodMs;
      return evaluateCurve(expr.base, phase);
    }
  }
};
