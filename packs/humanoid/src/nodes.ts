import type { NodeId } from "@lingfan-character/contracts";

/** 节点标识唯一出处：节点声明、基元归属与约束校验共用。 */
export const NODE_ID = {
  turn: "params.turn",
  smile: "params.smile",
  blink: "params.blink",
  breath: "params.breath",
  swing: "params.swing",
  smileChain: "coupling.smile-chain",
  hairBack: "appearance.hair-back",
  face: "appearance.face",
  hairFront: "appearance.hair-front",
  accessory: "appearance.accessory",
} as const satisfies Record<string, NodeId>;
