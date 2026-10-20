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
export const YAW_RANGE = 1.2;
export const PITCH_RANGE = 0.5;

/** 皮肤色带（亮→暗）：采样器按光照分档取色，档越细过渡越柔和。 */
export const SKIN_BANDS = [
  { r: 0.97, g: 0.86, b: 0.73, a: 1 },
  { r: 0.93, g: 0.79, b: 0.64, a: 1 },
  { r: 0.87, g: 0.71, b: 0.55, a: 1 },
  { r: 0.79, g: 0.61, b: 0.46, a: 1 },
  { r: 0.68, g: 0.5, b: 0.38, a: 1 },
  { r: 0.55, g: 0.39, b: 0.3, a: 1 },
] as const;

/** 头发色带（亮→暗）：发壳独立基元独立分档。 */
export const HAIR_BANDS = [
  { r: 0.42, g: 0.3, b: 0.22, a: 1 },
  { r: 0.35, g: 0.24, b: 0.17, a: 1 },
  { r: 0.27, g: 0.18, b: 0.13, a: 1 },
  { r: 0.2, g: 0.13, b: 0.09, a: 1 },
] as const;
