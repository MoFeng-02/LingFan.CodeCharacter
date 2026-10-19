import type { CharacterPack } from "@lingfan-character/contracts";
import { accessoryNode } from "./appearance/accessory";
import { faceNode } from "./appearance/face";
import { hairBackNode } from "./appearance/hairBack";
import { hairFrontNode } from "./appearance/hairFront";
import { mouthNode } from "./appearance/mouth";
import { humanoidValidations } from "./constraints";
import { smileChainNode } from "./coupling/smileChain";
import { blinkNode } from "./params/blink";
import { breathNode } from "./params/breath";
import { mouthDriveNode } from "./params/mouthDrive";
import { smileNode } from "./params/smile";
import { swingNode } from "./params/swing";
import { turnNode } from "./params/turn";
import { NODE_ID } from "./nodes";
import { BASIS_SLOT_KEYS, DEFAULTS, RANGES, SLOT } from "./shared";

/**
 * 半写实头像域包：六参数 / 一条耦合链 / 五层外观 / 两条约束。
 * 绘制序 = 节点声明序：后发 → 脸 → 嘴 → 前发 → 饰品；
 * 参数与耦合节点不产出像素，声明位置不影响合成。
 */
export const humanoidPack: CharacterPack = {
  declaration: {
    id: "humanoid",
    version: "0.1.0",
    families: ["params", "coupling", "appearance"],
  },
  slots: [
    {
      name: SLOT.turn,
      direction: "input",
      defaultValue: DEFAULTS.turn,
      range: RANGES.turn,
    },
    {
      name: SLOT.smile,
      direction: "input",
      defaultValue: DEFAULTS.smile,
      range: RANGES.smile,
    },
    {
      name: SLOT.blink,
      direction: "input",
      defaultValue: DEFAULTS.blink,
      range: RANGES.blink,
    },
    {
      name: SLOT.breath,
      direction: "input",
      defaultValue: DEFAULTS.breath,
      range: RANGES.breath,
    },
    {
      name: SLOT.swing,
      direction: "input",
      defaultValue: DEFAULTS.swing,
      range: RANGES.swing,
    },
    {
      name: SLOT.mouthDrive,
      direction: "input",
      defaultValue: DEFAULTS.mouthDrive,
      range: RANGES.mouthDrive,
    },
    { name: SLOT.headTurn, direction: "output", range: RANGES.headTurn },
    { name: SLOT.smileWave, direction: "output", range: RANGES.smileWave },
    { name: SLOT.blinkWave, direction: "output", range: RANGES.blinkWave },
    { name: SLOT.breathWave, direction: "output", range: RANGES.breathWave },
    { name: SLOT.swingWave, direction: "output", range: RANGES.swingWave },
    { name: SLOT.openWave, direction: "output", range: RANGES.openWave },
    { name: SLOT.cheekLift, direction: "output", range: RANGES.cheekLift },
    { name: SLOT.eyeSqueeze, direction: "output", range: RANGES.eyeSqueeze },
    ...BASIS_SLOT_KEYS.map((key) => ({
      name: SLOT[key],
      direction: "input" as const,
      defaultValue: DEFAULTS[key],
      range: RANGES[key],
    })),
  ],
  nodes: [
    turnNode,
    smileNode,
    blinkNode,
    breathNode,
    swingNode,
    mouthDriveNode,
    smileChainNode,
    hairBackNode,
    faceNode,
    mouthNode,
    hairFrontNode,
    accessoryNode,
  ],
  // 本包的参数联动全部由耦合节点承担（带衰减系数）；
  // 依赖边只用于目标槽的镜像复制，目标槽被写即编译错误。
  edges: [],
  validations: humanoidValidations(),
  substep: { kind: "fixed", count: 1 },
};

/** 槽位与节点标识的统一出口：组合根、测试与渲染器按名引用时从这里取。 */
export { SLOT, DEFAULTS, RANGES, NODE_ID, BASIS_SLOT_KEYS };
