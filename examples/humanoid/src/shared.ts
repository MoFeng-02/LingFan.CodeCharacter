import type { NodeDeclaration, SlotName } from "@lingfan-character/contracts";

/**
 * 槽位命名遵循「包.节点族.槽位」三段式。input 族槽位是外部可驱动的
 * 五个参数基调；params 族槽位是参数节点修饰后的波形值；coupling 族
 * 槽位是耦合链产出；motion 族槽位是供外观层消费的刚体运动量。
 */
export const SLOT = {
  turn: "humanoid.params.turn",
  smile: "humanoid.params.smile",
  blink: "humanoid.params.blink",
  breath: "humanoid.params.breath",
  swing: "humanoid.params.swing",
  mouthDrive: "humanoid.params.mouth-drive",

  headTurn: "humanoid.motion.head-turn",
  smileWave: "humanoid.face.smile-wave",
  blinkWave: "humanoid.face.blink-wave",
  breathWave: "humanoid.body.breath-wave",
  swingWave: "humanoid.hair.swing-wave",
  openWave: "humanoid.mouth.open-wave",

  cheekLift: "humanoid.face.cheek-lift",
  eyeSqueeze: "humanoid.face.eye-squeeze",
} as const satisfies Record<string, SlotName>;

export type SlotKey = keyof typeof SLOT;

/** 参数槽默认值：呼吸与眨眼的基调取中低档，其余归零。 */
export const DEFAULTS: Record<SlotKey, number> = {
  turn: 0,
  smile: 0.2,
  blink: 0,
  breath: 0.35,
  swing: 0,
  mouthDrive: 0,

  headTurn: 0,
  smileWave: 0.2,
  blinkWave: 0,
  breathWave: 0.35,
  swingWave: 0,
  openWave: 0,

  cheekLift: 0,
  eyeSqueeze: 0,
};

/** 参数槽取值范围：input 钳制、输出钳制与约束校验共用同一张表。 */
export const RANGES: Partial<Record<SlotKey, { min: number; max: number }>> = {
  turn: { min: -1, max: 1 },
  smile: { min: 0, max: 1 },
  blink: { min: 0, max: 1 },
  breath: { min: 0, max: 1 },
  swing: { min: -1, max: 1 },
  mouthDrive: { min: 0, max: 1 },

  headTurn: { min: -1, max: 1 },
  smileWave: { min: 0, max: 1 },
  blinkWave: { min: 0, max: 1 },
  breathWave: { min: 0, max: 1 },
  swingWave: { min: -1, max: 1 },
  openWave: { min: 0, max: 1 },

  cheekLift: { min: 0, max: 1 },
  eyeSqueeze: { min: 0, max: 1 },
};

/**
 * 节点声明公共骨架：域包节点统一从这里的类型收窄受益，
 * step 内部保持纯函数——同样的输入子流永远产出同样的输出。
 */
export type PackNode = NodeDeclaration;
