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

/**
 * 表情基槽键清单：包装配声明与组合根复位共用同一份键序。
 * 槽名本体以 SLOT 为准，此处只列基空间的键，避免两处各写一份清单。
 */
export const BASIS_SLOT_KEYS = [
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

  browRaiseL: 0,
  browRaiseR: 0,
  browFurrowL: 0,
  browFurrowR: 0,
  eyeOpenL: 0.5,
  eyeOpenR: 0.5,
  gazeX: 0,
  gazeY: 0,
  pupilDilate: 0,
  noseFlareL: 0,
  noseFlareR: 0,
  cheekRaiseL: 0,
  cheekRaiseR: 0,
  mouthCornerL: 0,
  mouthCornerR: 0,
  lipCurlUpper: 0,
  lipCurlLower: 0,
  lipCompress: 0,
  jawOpen: 0,
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

  browRaiseL: { min: 0, max: 1 },
  browRaiseR: { min: 0, max: 1 },
  browFurrowL: { min: 0, max: 1 },
  browFurrowR: { min: 0, max: 1 },
  eyeOpenL: { min: 0, max: 1 },
  eyeOpenR: { min: 0, max: 1 },
  gazeX: { min: -1, max: 1 },
  gazeY: { min: -1, max: 1 },
  pupilDilate: { min: 0, max: 1 },
  noseFlareL: { min: 0, max: 1 },
  noseFlareR: { min: 0, max: 1 },
  cheekRaiseL: { min: 0, max: 1 },
  cheekRaiseR: { min: 0, max: 1 },
  mouthCornerL: { min: -1, max: 1 },
  mouthCornerR: { min: -1, max: 1 },
  lipCurlUpper: { min: 0, max: 1 },
  lipCurlLower: { min: 0, max: 1 },
  lipCompress: { min: 0, max: 1 },
  jawOpen: { min: 0, max: 1 },
};

/**
 * 节点声明公共骨架：域包节点统一从这里的类型收窄受益，
 * step 内部保持纯函数——同样的输入子流永远产出同样的输出。
 */
export type PackNode = NodeDeclaration;
