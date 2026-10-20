/**
 * 立体半身像示例配方：槽位与取值域声明。
 *
 * 是什么：三个输入槽——转头（yaw 视角源）、点头（pitch 视角源）与呼吸。
 * 为什么：视角是可编程的采样参数，由配方参数驱动进状态；
 *         呼吸在几何生成时对立体做均匀缩放，是「几何本身就是算出来的」
 *         的最小示例。
 * 怎么用：宿主经 overrides 写入参数，节点读取后驱动几何与视角。
 * 注意事项：转头与点头取值域为 −1..1，节点内映射为弧度视角；
 *          呼吸取值域 0..1，作为均匀缩放系数进入几何生成。
 */

export const SLOT = {
  headTurn: "bust3d.params.head-turn",
  headTilt: "bust3d.params.head-tilt",
  breath: "bust3d.params.breath",
} as const;

export const DEFAULTS: Record<string, number> = {
  [SLOT.headTurn]: 0,
  [SLOT.headTilt]: 0,
  [SLOT.breath]: 0.5,
};

export const RANGES: Partial<Record<string, { min: number; max: number }>> = {
  [SLOT.headTurn]: { min: -1, max: 1 },
  [SLOT.headTilt]: { min: -1, max: 1 },
  [SLOT.breath]: { min: 0, max: 1 },
};

/** 视角映射幅度：满参数对应的弧度。 */
export const YAW_RANGE = 0.9;
export const PITCH_RANGE = 0.5;
