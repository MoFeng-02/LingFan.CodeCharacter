/**
 * 分层素材轨示范配方的槽位、层规格与形变常量：单一出处。
 *
 * 是什么：layered 配方全部槽位名、缺省与范围，层规格表（纹理、网格密度、
 *         深度、区域矩形、局部场类别），以及形变幅度常量。
 * 为什么：槽位是配方与编排者的唯一约定，层规格是绘制序与视差排序的唯一
 *         依据，集中一处避免拼写与顺序漂移。
 * 怎么用：节点、层装配与组合根都从这里引用；编排者用 SLOT 常量注入覆盖。
 * 注意事项：槽位名以「包.节点族.槽位」点分；纹理标识是宿主资源表的键，
 *          位图本体不进状态向量；LAYER_SPECS 的数组序即绘制序（后面的层
 *          后画、覆盖前面的层）。
 */

import type { TextureId } from "@lingfan-character/contracts";

/** 输入槽位：组合根与编排者写入的参数。 */
export const SLOT = {
  /** 呼吸起伏幅度 0..1。 */
  breathe: "layered.params.breathe",
  /** 眼睑闭合 0..1（1 = 全闭）。 */
  blink: "layered.params.blink",
  /** 视线横向 -1..1（负 = 看向左侧）。 */
  gazeX: "layered.params.gaze-x",
  /** 视线纵向 -1..1（负 = 向上看）。 */
  gazeY: "layered.params.gaze-y",
  /** 朝向 -1..1（负 = 朝左）；驱动整体平移与层间视差。 */
  headTurn: "layered.params.head-turn",
  /** 微笑 0..1；抬眉与嘴形跟随。 */
  smile: "layered.params.smile",
  /** 张口 0..1。 */
  mouthOpen: "layered.params.mouth-open",
  /** 风强度 0..1；驱动发层噪声抖动。 */
  wind: "layered.params.wind",
  /** 扰动起始时刻（毫秒）：拖动朝向滑杆时由组合根刷新。 */
  swingAt: "layered.motion.swing-at",
  /** 扰动幅度 0..1；缺省 0 表示没有进行中的扰动。 */
  swingAmp: "layered.motion.swing-amp",
  /** 扰动响应窗时长（毫秒）。 */
  swingMs: "layered.motion.swing-ms",
} as const;

export type SlotKey = keyof typeof SLOT;
export type SlotId = (typeof SLOT)[SlotKey];

export const DEFAULTS: Record<SlotId, number> = {
  [SLOT.breathe]: 0.4,
  [SLOT.blink]: 0,
  [SLOT.gazeX]: 0,
  [SLOT.gazeY]: 0,
  [SLOT.headTurn]: 0,
  [SLOT.smile]: 0.2,
  [SLOT.mouthOpen]: 0,
  [SLOT.wind]: 0,
  [SLOT.swingAt]: -1,
  [SLOT.swingAmp]: 0,
  [SLOT.swingMs]: 420,
};

export const RANGES: Partial<
  Record<SlotId, { readonly min: number; readonly max: number }>
> = {
  [SLOT.breathe]: { min: 0, max: 1 },
  [SLOT.blink]: { min: 0, max: 1 },
  [SLOT.gazeX]: { min: -1, max: 1 },
  [SLOT.gazeY]: { min: -1, max: 1 },
  [SLOT.headTurn]: { min: -1, max: 1 },
  [SLOT.smile]: { min: 0, max: 1 },
  [SLOT.mouthOpen]: { min: 0, max: 1 },
  [SLOT.wind]: { min: 0, max: 1 },
};

/** 形变场参数槽位：由参数节点算出，供各层外观节点读取。 */
export const FIELD_SLOT = {
  /** 呼吸均匀缩放系数（1 = 静止）。 */
  breathScale: "layered.field.breath-scale",
  /** 朝向整体平移量（归一化横坐标增量）。 */
  turnShift: "layered.field.turn-shift",
  /** 受控链条回摆偏移。 */
  swingOffset: "layered.field.swing-offset",
  /** 眼睑下移量（正 = 向下）。 */
  lidTravel: "layered.field.lid-travel",
  /** 视线横移量。 */
  gazeShiftX: "layered.field.gaze-shift-x",
  /** 视线纵移量。 */
  gazeShiftY: "layered.field.gaze-shift-y",
  /** 眉位移（负 = 抬起）。 */
  browLift: "layered.field.brow-lift",
  /** 嘴形张合量（围绕嘴部中心上下对称拉伸）。 */
  mouthShape: "layered.field.mouth-shape",
  /** 发层抖动横向量（含风强度与噪声相位）。 */
  windShiftX: "layered.field.wind-shift-x",
  /** 发层抖动纵向量。 */
  windShiftY: "layered.field.wind-shift-y",
} as const;

export type FieldSlotId = (typeof FIELD_SLOT)[keyof typeof FIELD_SLOT];

/** 参数节点标识：算形变场参数，不产基元。 */
export const FIELD_NODE_ID = "layered.field.params";

/** 层外观节点标识：每层一个节点，各产一条网格基元。 */
export const layerNodeId = (layerId: string): string =>
  `layered.appearance.${layerId}`;

/** 层区域矩形：归一化舞台坐标下的静止覆盖区（左上角 + 宽高）。 */
export interface LayerRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** 局部场类别：决定该层在共享场之上叠加的位移规则。 */
export type LayerKind =
  | "hair-back"
  | "face"
  | "eye-white"
  | "pupil"
  | "eyelid"
  | "brow"
  | "mouth"
  | "hair-front";

/** 层规格：静止几何、纹理、深度与局部场类别。 */
export interface LayerSpec {
  readonly id: string;
  readonly textureId: TextureId;
  /** 网格列数与行数（控制点数），均 ≥ 2。 */
  readonly cols: number;
  readonly rows: number;
  /** 深度 0..1：越大越靠近观察者，随朝向移动越多。 */
  readonly depth: number;
  readonly rect: LayerRect;
  readonly kind: LayerKind;
}

/**
 * 十二层规格：数组序即绘制序。
 * 后发在最底层（先画）、前发在最上层（最后画）；眼白→瞳孔→眼睑
 * 依次叠加，眼睑最后画才能真实遮住瞳孔。
 */
export const LAYER_SPECS: readonly LayerSpec[] = [
  {
    id: "hair-back",
    textureId: "layered-hair-back",
    cols: 10,
    rows: 12,
    depth: 0.15,
    rect: { x: 0.13, y: 0.05, width: 0.74, height: 0.88 },
    kind: "hair-back",
  },
  {
    id: "face",
    textureId: "layered-face",
    cols: 8,
    rows: 10,
    depth: 0.45,
    rect: { x: 0.2, y: 0.1, width: 0.6, height: 0.76 },
    kind: "face",
  },
  {
    id: "eye-white-l",
    textureId: "layered-eye-white-l",
    cols: 4,
    rows: 3,
    depth: 0.5,
    rect: { x: 0.315, y: 0.365, width: 0.135, height: 0.075 },
    kind: "eye-white",
  },
  {
    id: "eye-white-r",
    textureId: "layered-eye-white-r",
    cols: 4,
    rows: 3,
    depth: 0.5,
    rect: { x: 0.55, y: 0.365, width: 0.135, height: 0.075 },
    kind: "eye-white",
  },
  {
    id: "pupil-l",
    textureId: "layered-pupil-l",
    cols: 3,
    rows: 3,
    depth: 0.52,
    rect: { x: 0.365, y: 0.385, width: 0.045, height: 0.04 },
    kind: "pupil",
  },
  {
    id: "pupil-r",
    textureId: "layered-pupil-r",
    cols: 3,
    rows: 3,
    depth: 0.52,
    rect: { x: 0.59, y: 0.385, width: 0.045, height: 0.04 },
    kind: "pupil",
  },
  {
    id: "eyelid-l",
    textureId: "layered-eyelid-l",
    cols: 4,
    rows: 3,
    depth: 0.56,
    rect: { x: 0.305, y: 0.25, width: 0.15, height: 0.115 },
    kind: "eyelid",
  },
  {
    id: "eyelid-r",
    textureId: "layered-eyelid-r",
    cols: 4,
    rows: 3,
    depth: 0.56,
    rect: { x: 0.545, y: 0.25, width: 0.15, height: 0.115 },
    kind: "eyelid",
  },
  {
    id: "brow-l",
    textureId: "layered-brow-l",
    cols: 3,
    rows: 2,
    depth: 0.5,
    rect: { x: 0.315, y: 0.255, width: 0.14, height: 0.035 },
    kind: "brow",
  },
  {
    id: "brow-r",
    textureId: "layered-brow-r",
    cols: 3,
    rows: 2,
    depth: 0.5,
    rect: { x: 0.545, y: 0.255, width: 0.14, height: 0.035 },
    kind: "brow",
  },
  {
    id: "mouth",
    textureId: "layered-mouth",
    cols: 4,
    rows: 3,
    depth: 0.48,
    rect: { x: 0.415, y: 0.575, width: 0.17, height: 0.1 },
    kind: "mouth",
  },
  {
    id: "hair-front",
    textureId: "layered-hair-front",
    cols: 8,
    rows: 10,
    depth: 0.8,
    rect: { x: 0.17, y: 0.07, width: 0.66, height: 0.34 },
    kind: "hair-front",
  },
];

/** 按标识取层规格：测试与组合根定位单层用。 */
export const layerSpec = (id: string): LayerSpec => {
  const spec = LAYER_SPECS.find((candidate) => candidate.id === id);
  if (!spec) {
    throw new Error(`未知图层: ${id}`);
  }
  return spec;
};

/** 呼吸缩放原点：颈根部，让头随呼吸向上起伏而不是整体放大。 */
export const BREATH_ORIGIN = { x: 0.5, y: 0.78 } as const;

/** 视差枢轴深度：该深度的层不随朝向做层间位移。 */
export const PARALLAX_PIVOT = 0.45;

/** 单位深度差在满朝向下的横向视差量。 */
export const PARALLAX_GAIN = 0.02;

/** 满呼吸幅度下的均匀缩放增量。 */
export const BREATH_GAIN = 0.006;

/** 满朝向下的整体平移量。 */
export const TURN_SHIFT_GAIN = 0.012;

/**
 * 满眨眼时眼睑下移量：需从眼白上缘盖到瞳孔下缘。
 * 取值依据：眼睑静止上缘 0.30，瞳孔下缘约 0.425，故行程须大于 0.13；
 * 取 0.14 留少量余量，保证闭眼时瞳孔被完全遮住。
 */
export const LID_TRAVEL = 0.14;

/** 满视线偏移对应的横移量与纵移量。 */
export const GAZE_X_GAIN = 0.008;
export const GAZE_Y_GAIN = 0.005;

/** 微笑与张口各自带来的抬眉量。 */
export const BROW_SMILE_GAIN = 0.004;
export const BROW_OPEN_GAIN = 0.006;

/** 满张口时嘴部上下缘各扩张的幅度。 */
export const MOUTH_OPEN_GAIN = 0.012;

/** 发层抖动增益与链条摆动增益。 */
export const WIND_GAIN = 0.012;
export const SWING_GAIN = 0.03;

/** 发层湍流：三个倍频程的平滑值噪声。 */
export const WIND_NOISE = {
  octaves: 3,
  frequency: 0.0016,
  lacunarity: 2,
  gain: 0.5,
} as const;

/** 呼吸节律周期（毫秒）：上升段 + 反向抵消段构成无静息偏移的脉冲。 */
export const BREATH_PERIOD_MS = 4200;
