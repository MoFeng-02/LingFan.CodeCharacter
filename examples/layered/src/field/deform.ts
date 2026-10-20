/**
 * 层形变组合器：共享场 ∘ 局部位移的唯一计算入口。
 *
 * 是什么：把一层静止网格顶点，按「先共享场、再层局部场」的组合规则变换成
 *         形变后的顶点表。
 * 为什么：分层不撕裂的保证必须落在一个函数里——任何层都走同一入口，顺序
 *         固定（共享在前），就不可能有人写出「只叠局部、漏了共享」的层。
 * 怎么用：各层外观节点调用 deformLayer(rest, spec, shared, local)。
 * 注意事项：输出长度必须等于输入长度（顶点数 = cols×rows）；组合顺序
 *          不得调换——局部位移以共享场之后的坐标为基准才符合「层内容
 *          在整体运动之上再局部运动」的直觉。
 */

import type { NormalizedPoint } from "@lingfan-character/contracts";
import type { LayerSpec } from "../shared";
import { localDisplacement, type LocalParams } from "./local";
import { applyShared, type SharedParams } from "./shared";

/** 单层形变：共享位移后叠加层内局部位移。 */
export function deformLayer(
  rest: readonly NormalizedPoint[],
  spec: LayerSpec,
  shared: SharedParams,
  local: LocalParams,
): NormalizedPoint[] {
  return rest.map((point) => {
    const base = applyShared(point, shared);
    const delta = localDisplacement(base, spec.kind, local, spec.depth);
    return { x: base.x + delta.x, y: base.y + delta.y };
  });
}
