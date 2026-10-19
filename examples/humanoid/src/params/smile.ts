import type { NodeDeclaration } from "@lingfan-character/contracts";
import { NODE_ID } from "../nodes";
import { SLOT } from "../shared";

/**
 * 微笑参数节点：基调透传为表情波形。
 * 耦合链（颧升/眼挤）由独立耦合节点消费该波形，参数层不承担联动。
 */
export const smileNode: NodeDeclaration = {
  id: NODE_ID.smile,
  reads: [SLOT.smile],
  writes: [SLOT.smileWave],
  step: (inputs) => ({
    values: { [SLOT.smileWave]: inputs.values[SLOT.smile] ?? 0 },
  }),
};
