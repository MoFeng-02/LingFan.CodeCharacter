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

  // 表情基空间：0..1（部分 ±1）直通输入，外观节点逐条读取；不设中间
  // 波形层，range 钳制在输入侧生效。宏观参数与基两条通道正交叠加。
  browRaiseL: "humanoid.face.brow-raise-l",
  browRaiseR: "humanoid.face.brow-raise-r",
  browFurrowL: "humanoid.face.brow-furrow-l",
  browFurrowR: "humanoid.face.brow-furrow-r",
  eyeOpenL: "humanoid.face.eye-open-l",
  eyeOpenR: "humanoid.face.eye-open-r",
  gazeX: "humanoid.face.gaze-x",
  gazeY: "humanoid.face.gaze-y",
  pupilDilate: "humanoid.face.pupil-dilate",
  noseFlareL: "humanoid.face.nose-flare-l",
  noseFlareR: "humanoid.face.nose-flare-r",
  cheekRaiseL: "humanoid.face.cheek-raise-l",
  cheekRaiseR: "humanoid.face.cheek-raise-r",
  mouthCornerL: "humanoid.face.mouth-corner-l",
  mouthCornerR: "humanoid.face.mouth-corner-r",
  lipCurlUpper: "humanoid.mouth.lip-curl-upper",
  lipCurlLower: "humanoid.mouth.lip-curl-lower",
  lipCompress: "humanoid.mouth.lip-compress",
  jawOpen: "humanoid.mouth.jaw-open",
} as const satisfies Record<string, SlotName>;

export type SlotKey = keyof typeof SLOT;

/** 完整槽名联合：SLOT 各值的类型，即缺省表与范围表的键。 */
export type SlotId = (typeof SLOT)[SlotKey];

/**
 * 表情基槽键清单：包装配声明与组合根复位共用同一份键序。
 * 槽名本体以 SLOT 为准，此处只列基空间的键，避免两处各写一份清单。
 */
export const BASIS_SLOT_KEYS: readonly SlotKey[] = [
  "browRaiseL",
  "browRaiseR",
  "browFurrowL",
  "browFurrowR",
  "eyeOpenL",
  "eyeOpenR",
  "gazeX",
  "gazeY",
  "pupilDilate",
  "noseFlareL",
  "noseFlareR",
  "cheekRaiseL",
  "cheekRaiseR",
  "mouthCornerL",
  "mouthCornerR",
  "lipCurlUpper",
  "lipCurlLower",
  "lipCompress",
  "jawOpen",
] as const satisfies readonly (keyof typeof SLOT)[];

/** 参数槽默认值：呼吸与眨眼的基调取中低档，其余归零。 */
export const DEFAULTS: Record<SlotId, number> = {
  [SLOT.turn]: 0,
  [SLOT.smile]: 0.2,
  [SLOT.blink]: 0,
  [SLOT.breath]: 0.35,
  [SLOT.swing]: 0,
  [SLOT.mouthDrive]: 0,

  [SLOT.headTurn]: 0,
  [SLOT.smileWave]: 0.2,
  [SLOT.blinkWave]: 0,
  [SLOT.breathWave]: 0.35,
  [SLOT.swingWave]: 0,
  [SLOT.openWave]: 0,

  [SLOT.cheekLift]: 0,
  [SLOT.eyeSqueeze]: 0,

  [SLOT.browRaiseL]: 0,
  [SLOT.browRaiseR]: 0,
  [SLOT.browFurrowL]: 0,
  [SLOT.browFurrowR]: 0,
  [SLOT.eyeOpenL]: 0.5,
  [SLOT.eyeOpenR]: 0.5,
  [SLOT.gazeX]: 0,
  [SLOT.gazeY]: 0,
  [SLOT.pupilDilate]: 0,
  [SLOT.noseFlareL]: 0,
  [SLOT.noseFlareR]: 0,
  [SLOT.cheekRaiseL]: 0,
  [SLOT.cheekRaiseR]: 0,
  [SLOT.mouthCornerL]: 0,
  [SLOT.mouthCornerR]: 0,
  [SLOT.lipCurlUpper]: 0,
  [SLOT.lipCurlLower]: 0,
  [SLOT.lipCompress]: 0,
  [SLOT.jawOpen]: 0,
};

/** 参数槽取值范围：input 钳制、输出钳制与约束校验共用同一张表。 */
export const RANGES: Partial<Record<SlotId, { min: number; max: number }>> = {
  [SLOT.turn]: { min: -1, max: 1 },
  [SLOT.smile]: { min: 0, max: 1 },
  [SLOT.blink]: { min: 0, max: 1 },
  [SLOT.breath]: { min: 0, max: 1 },
  [SLOT.swing]: { min: -1, max: 1 },
  [SLOT.mouthDrive]: { min: 0, max: 1 },

  [SLOT.headTurn]: { min: -1, max: 1 },
  [SLOT.smileWave]: { min: 0, max: 1 },
  [SLOT.blinkWave]: { min: 0, max: 1 },
  [SLOT.breathWave]: { min: 0, max: 1 },
  [SLOT.swingWave]: { min: -1, max: 1 },
  [SLOT.openWave]: { min: 0, max: 1 },

  [SLOT.cheekLift]: { min: 0, max: 1 },
  [SLOT.eyeSqueeze]: { min: 0, max: 1 },

  [SLOT.browRaiseL]: { min: 0, max: 1 },
  [SLOT.browRaiseR]: { min: 0, max: 1 },
  [SLOT.browFurrowL]: { min: 0, max: 1 },
  [SLOT.browFurrowR]: { min: 0, max: 1 },
  [SLOT.eyeOpenL]: { min: 0, max: 1 },
  [SLOT.eyeOpenR]: { min: 0, max: 1 },
  [SLOT.gazeX]: { min: -1, max: 1 },
  [SLOT.gazeY]: { min: -1, max: 1 },
  [SLOT.pupilDilate]: { min: 0, max: 1 },
  [SLOT.noseFlareL]: { min: 0, max: 1 },
  [SLOT.noseFlareR]: { min: 0, max: 1 },
  [SLOT.cheekRaiseL]: { min: 0, max: 1 },
  [SLOT.cheekRaiseR]: { min: 0, max: 1 },
  [SLOT.mouthCornerL]: { min: -1, max: 1 },
  [SLOT.mouthCornerR]: { min: -1, max: 1 },
  [SLOT.lipCurlUpper]: { min: 0, max: 1 },
  [SLOT.lipCurlLower]: { min: 0, max: 1 },
  [SLOT.lipCompress]: { min: 0, max: 1 },
  [SLOT.jawOpen]: { min: 0, max: 1 },
};

/**
 * 节点声明公共骨架：域包节点统一从这里的类型收窄受益，
 * step 内部保持纯函数——同样的输入子流永远产出同样的输出。
 */
export type PackNode = NodeDeclaration;
