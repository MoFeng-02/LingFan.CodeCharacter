import type { NodeDeclaration } from "@lingfan-character/contracts";
import { NODE_ID } from "../nodes";
import { SLOT } from "../shared";

/**
 * 微笑耦合链：表情波形按固定衰减系数传播到颧部与眼周，
 * 衰减系数在这里唯一声明。值的传播依赖拓扑序（写者先于读者
 * 求值）而非依赖边——依赖边语义是目标槽的镜像复制，目标槽不得被写。
 */
export const smileChainNode: NodeDeclaration = {
  id: NODE_ID.smileChain,
  reads: [SLOT.smileWave],
  writes: [SLOT.cheekLift, SLOT.eyeSqueeze],
  step: (inputs) => {
    const smile = inputs.values[SLOT.smileWave] ?? 0;
    return {
      values: {
        [SLOT.cheekLift]: smile * 0.6,
        [SLOT.eyeSqueeze]: smile * 0.4,
      },
    };
  },
};
