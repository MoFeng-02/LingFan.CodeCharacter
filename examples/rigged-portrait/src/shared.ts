/**
 * 单图权重蒙皮的常量与槽位声明。
 *
 * 是什么：rigged-portrait 配方的输入槽、缺省值、范围、网格密度与
 *         骨骼锚点的唯一声明处。
 * 为什么：权重蒙皮把「一张画」当作可形变的皮肤——顶点位移由若干骨骼
 *         变换加权混合而来，因此所有骨骼锚点与区域参数必须集中声明，
 *         便于按同一套数值调参而不散落在各处。
 * 怎么用：配方节点与蒙皮数学都从本模块取值；改观感只改这里的常量。
 * 注意事项：坐标一律图层局部归一化（0..1），与契约坐标系一致；
 *          网格密度是画质与填充率的权衡，见 GRID_COLS / GRID_ROWS 注释。
 */

/** 输入槽标识：参数四通道 + 摆动脉冲锚点三槽。 */
export const SLOT = {
  breathe: "rigged.params.breathe",
  headTurn: "rigged.params.head-turn",
  blink: "rigged.params.blink",
  mouthOpen: "rigged.params.mouth-open",
  wind: "rigged.params.wind",
  swingAt: "rigged.motion.swing-at",
  swingAmplitude: "rigged.motion.swing-amplitude",
  swingMs: "rigged.motion.swing-ms",
} as const;

/** 槽位名类型。 */
export type SlotId = (typeof SLOT)[keyof typeof SLOT];

/** 输入缺省值：静态观感即「呼吸中段、朝向居中、眼口自然」。 */
export const DEFAULTS: Readonly<Record<SlotId, number>> = {
  [SLOT.breathe]: 0.45,
  [SLOT.headTurn]: 0,
  [SLOT.blink]: 0,
  [SLOT.mouthOpen]: 0,
  [SLOT.wind]: 0.12,
  [SLOT.swingAt]: -1,
  [SLOT.swingAmplitude]: 0,
  [SLOT.swingMs]: 520,
};

/**
 * 输入范围：摆动三槽是「时刻 / 幅度 / 时长」，量纲不是 0..1，
 * 因此不声明 range（声明了就必须容纳缺省值，否则编译期报错）。
 */
export const RANGES: Readonly<
  Partial<Record<SlotId, { min: number; max: number }>>
> = {
  [SLOT.breathe]: { min: 0, max: 1 },
  [SLOT.headTurn]: { min: -1, max: 1 },
  [SLOT.blink]: { min: 0, max: 1 },
  [SLOT.mouthOpen]: { min: 0, max: 1 },
  [SLOT.wind]: { min: 0, max: 1 },
};

/**
 * 网格密度：列数 × 行数控制点。
 * 越高越贴合原画的轮廓与五官，代价是每帧逐单元贴图的填充次数
 * （单元数 = (cols−1)×(rows−1)）；36×54 在 512 画布上约两千次填充，
 * 是「轮廓平滑可辨」与「实时帧率」的平衡点。
 */
export const GRID_COLS = 36;
export const GRID_ROWS = 54;

/** 纹理标识：位图本体由宿主注册，状态向量只带这个字符串。 */
export const TEXTURE_ID = "rigged-portrait-primary";

/** 骨骼标识：每根骨骼承载一块区域，顶点按权重被多根骨骼共同牵引。 */
export const BONE = {
  root: "root",
  chest: "chest",
  waist: "waist",
  head: "head",
  jaw: "jaw",
  hairLeft: "hair-left",
  hairRight: "hair-right",
  sleeveLeft: "sleeve-left",
  sleeveRight: "sleeve-right",
  skirtCenter: "skirt-center",
  skirtLeft: "skirt-left",
  skirtRight: "skirt-right",
} as const;

/** 骨骼名类型。 */
export type BoneId = (typeof BONE)[keyof typeof BONE];

/** 骨骼顺序：权重表按此序存储，蒙皮时按序取变换。 */
export const BONE_ORDER: readonly BoneId[] = [
  BONE.root,
  BONE.chest,
  BONE.waist,
  BONE.head,
  BONE.jaw,
  BONE.hairLeft,
  BONE.hairRight,
  BONE.sleeveLeft,
  BONE.sleeveRight,
  BONE.skirtCenter,
  BONE.skirtLeft,
  BONE.skirtRight,
];

/**
 * 骨骼锚点：变换绕该点进行，也是权重区域的圆心。
 * 数值取自正面站姿的解剖比例——颈部在头与胸之间、腰在躯干中段、
 * 发帘锚在颈根（发从颈后垂下）、袖摆锚在肩、裙摆锚在胯。
 */
export const BONE_ANCHOR: Readonly<Record<BoneId, { x: number; y: number }>> = {
  [BONE.root]: { x: 0.5, y: 0.98 },
  [BONE.chest]: { x: 0.5, y: 0.235 },
  [BONE.waist]: { x: 0.5, y: 0.36 },
  [BONE.head]: { x: 0.5, y: 0.168 },
  [BONE.jaw]: { x: 0.5, y: 0.135 },
  [BONE.hairLeft]: { x: 0.29, y: 0.185 },
  [BONE.hairRight]: { x: 0.71, y: 0.185 },
  [BONE.sleeveLeft]: { x: 0.235, y: 0.245 },
  [BONE.sleeveRight]: { x: 0.765, y: 0.245 },
  [BONE.skirtCenter]: { x: 0.5, y: 0.44 },
  [BONE.skirtLeft]: { x: 0.3, y: 0.44 },
  [BONE.skirtRight]: { x: 0.7, y: 0.44 },
};

/**
 * 权重区域：椭圆半径（归一化）描述该骨骼「牵引力」的有效范围。
 * 区域重叠是必要的——重叠处权重按比例混合，形变才连续无缝；
 * 刻意不做硬边界，硬边界会在交界处撕开画面。
 */
export const BONE_RADIUS: Readonly<Record<BoneId, { rx: number; ry: number }>> =
  {
    [BONE.root]: { rx: 1, ry: 1 },
    [BONE.chest]: { rx: 0.2, ry: 0.145 },
    [BONE.waist]: { rx: 0.17, ry: 0.11 },
    [BONE.head]: { rx: 0.155, ry: 0.1 },
    [BONE.jaw]: { rx: 0.115, ry: 0.055 },
    [BONE.hairLeft]: { rx: 0.145, ry: 0.3 },
    [BONE.hairRight]: { rx: 0.145, ry: 0.3 },
    [BONE.sleeveLeft]: { rx: 0.115, ry: 0.15 },
    [BONE.sleeveRight]: { rx: 0.115, ry: 0.15 },
    [BONE.skirtCenter]: { rx: 0.34, ry: 0.3 },
    [BONE.skirtLeft]: { rx: 0.26, ry: 0.28 },
    [BONE.skirtRight]: { rx: 0.26, ry: 0.28 },
  };

/**
 * 根骨骼的基础权重：每个顶点都保留一点「不动」的分量。
 * 作用有二——总权重恒不为零（无需兜底分支），且形变幅度整体略收敛，
 * 边缘不会因为单根骨骼的极端位移而飞出画布。
 */
export const ROOT_BASE_WEIGHT = 0.06;

/** 呼吸节律：4.2 秒周期，上升段与反向抵消段构成无静息偏移的脉冲。 */
export const BREATH_PERIOD_MS = 4200;

/** 呼吸引起的躯干抬升量（归一化）：越小越像「静立微息」。 */
export const BREATH_LIFT = 0.0075;

/** 满朝向时的头部横移（归一化）：头部是近层，位移最大。 */
export const HEAD_SWING = 0.021;

/** 满朝向时的胸廓横移：远小于头部，形成前后层次。 */
export const CHEST_SWING = 0.0085;

/** 满朝向时的裙摆横移：拖在最后，位移最小但延迟最大。 */
export const SKIRT_SWING = 0.0035;

/** 满朝向时的头部微旋转（弧度）：单图大幅旋转会穿帮，只做极小倾斜。 */
export const HEAD_TILT_RAD = 0.018;

/** 眨眼：眼带纵向压缩比例上限（单图没有眼睑层，只能压缩眼区）。 */
export const BLINK_SQUEEZE = 0.55;

/** 眼带中心与半径：用于眨眼压缩的作用域。 */
export const EYE_BAND = { x: 0.492, y: 0.0965, rx: 0.088, ry: 0.0215 } as const;

/** 张嘴：下颌带下移量上限（归一化）。 */
export const JAW_DROP = 0.009;

/** 下颌带中心与半径。 */
export const JAW_BAND = { x: 0.492, y: 0.125, rx: 0.075, ry: 0.028 } as const;

/** 风场噪声：低频三段倍频程，让摆动带呼吸般的随机起伏。 */
export const WIND_NOISE = {
  octaves: 3,
  frequency: 0.0013,
  lacunarity: 2,
  gain: 0.5,
} as const;
