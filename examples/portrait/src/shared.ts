/**
 * 素材轨示范配方的槽位与常量：单一出处。
 *
 * 是什么：portrait 配方全部槽位名、缺省值与取值范围；纹理标识。
 * 为什么：槽位名是配方与编排者的唯一约定，集中一处避免拼写漂移。
 * 怎么用：节点与组合根都从这里引用 SLOT；编排者用 SLOT 常量注入覆盖。
 * 注意事项：槽位名以「包.节点族.槽位」点分；纹理标识是宿主资源表的
 *          键，位图本体不进状态向量（契约注释）。
 */

export const SLOT = {
  /** 呼吸起伏幅度 0..1。 */
  breathe: "portrait.params.breathe",
  /** 眼睑闭合 0..1（1 = 全闭）。 */
  blink: "portrait.params.blink",
  /** 口部张开 0..1。 */
  mouthOpen: "portrait.params.mouth-open",
  /** 朝向视差 -1..1（负 = 朝左）。 */
  headTurn: "portrait.params.head-turn",
} as const;

export type SlotKey = keyof typeof SLOT;
export type SlotId = (typeof SLOT)[SlotKey];

export const DEFAULTS: Record<SlotId, number> = {
  [SLOT.breathe]: 0.5,
  [SLOT.blink]: 0,
  [SLOT.mouthOpen]: 0,
  [SLOT.headTurn]: 0,
};

export const RANGES: Partial<
  Record<SlotId, { readonly min: number; readonly max: number }>
> = {
  [SLOT.breathe]: { min: 0, max: 1 },
  [SLOT.blink]: { min: 0, max: 1 },
  [SLOT.mouthOpen]: { min: 0, max: 1 },
  [SLOT.headTurn]: { min: -1, max: 1 },
};

/** 主立绘在宿主纹理资源表中的键；组合根负责注册位图。 */
export const TEXTURE_ID = "portrait-primary";

/** 网格规模：列数 × 行数个控制点，行优先。 */
export const GRID_COLS = 7;
export const GRID_ROWS = 9;
