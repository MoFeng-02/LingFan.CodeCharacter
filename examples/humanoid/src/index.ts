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
      defaultValue: DEFAULTS[SLOT.turn],
      range: RANGES[SLOT.turn],
    },
    {
      name: SLOT.smile,
      direction: "input",
      defaultValue: DEFAULTS[SLOT.smile],
      range: RANGES[SLOT.smile],
    },
    {
      name: SLOT.blink,
      direction: "input",
      defaultValue: DEFAULTS[SLOT.blink],
      range: RANGES[SLOT.blink],
    },
    {
      name: SLOT.breath,
      direction: "input",
      defaultValue: DEFAULTS[SLOT.breath],
      range: RANGES[SLOT.breath],
    },
    {
      name: SLOT.swing,
      direction: "input",
      defaultValue: DEFAULTS[SLOT.swing],
      range: RANGES[SLOT.swing],
    },
    {
      name: SLOT.mouthDrive,
      direction: "input",
      defaultValue: DEFAULTS[SLOT.mouthDrive],
      range: RANGES[SLOT.mouthDrive],
    },
    {
      name: SLOT.wind,
      direction: "input",
      defaultValue: DEFAULTS[SLOT.wind],
      range: RANGES[SLOT.wind],
    },
    // 弹簧锚点三槽：时刻为毫秒量纲、时长与幅度由组合根负责，不设钳制范围。
    {
      name: SLOT.swingPulseAt,
      direction: "input",
      defaultValue: DEFAULTS[SLOT.swingPulseAt],
    },
    {
      name: SLOT.swingPulseAmp,
      direction: "input",
      defaultValue: DEFAULTS[SLOT.swingPulseAmp],
    },
    {
      name: SLOT.swingPulseMs,
      direction: "input",
      defaultValue: DEFAULTS[SLOT.swingPulseMs],
    },
    { name: SLOT.headTurn, direction: "output", range: RANGES[SLOT.headTurn] },
    {
      name: SLOT.smileWave,
      direction: "output",
      range: RANGES[SLOT.smileWave],
    },
    {
      name: SLOT.blinkWave,
      direction: "output",
      range: RANGES[SLOT.blinkWave],
    },
    {
      name: SLOT.breathWave,
      direction: "output",
      range: RANGES[SLOT.breathWave],
    },
    {
      name: SLOT.swingWave,
      direction: "output",
      range: RANGES[SLOT.swingWave],
    },
    { name: SLOT.openWave, direction: "output", range: RANGES[SLOT.openWave] },
    {
      name: SLOT.cheekLift,
      direction: "output",
      range: RANGES[SLOT.cheekLift],
    },
    {
      name: SLOT.eyeSqueeze,
      direction: "output",
      range: RANGES[SLOT.eyeSqueeze],
    },
    ...BASIS_SLOT_KEYS.map((key) => ({
      name: SLOT[key],
      direction: "input" as const,
      defaultValue: DEFAULTS[SLOT[key]],
      range: RANGES[SLOT[key]],
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
export type { SlotKey, SlotId } from "./shared";
