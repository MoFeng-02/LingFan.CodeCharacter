/**
 * 颊部基形变：纯数值计算。颊升上提腮红与颊部，与耦合链产出的
 * 颧升波形在消费侧相加，两条通道正交。
 */

/** 颊部基形变：纵向位移（负=上提）。 */
export function cheekDeform(raise: number): number {
  return -0.012 * raise;
}
