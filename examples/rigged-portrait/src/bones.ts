/**
 * 骨骼变换：把四个动作通道翻译成每根骨骼的二维仿射变换。
 *
 * 是什么：对 BONE_ORDER 中每根骨骼算出「绕锚点旋转 + 平移」的仿射矩阵，
 *         蒙皮阶段按权重把这些矩阵混合到顶点上。
 * 为什么：骨骼是动作的载体——同一张画里，「头部动」与「裙摆动」的差别
 *         只在于哪根骨骼的变换不同。把通道翻译成语义明确的骨骼变换，
 *         权重表就能独立调参，两件事互不干扰。
 * 怎么用：配方节点每帧调一次 boneTransforms，得到与 BONE_ORDER 同长的
 *         矩阵表，交给 skinVertices 与静止网格、权重表一起求值。
 * 注意事项：位移全部来自曲线、解析链与噪声的确定值；旋转用 polySin/polyCos
 *          多项式三角函数，不调用 Math.sin/cos——后者跨引擎末位不一致。
 */

import type { AffineTransform } from "@lingfan-character/contracts";
import type { RandomSubstream } from "@lingfan-character/contracts";
import type { ChainSpec, SpringPulse } from "@lingfan-character/primitives";
import {
  chainOffsets,
  evaluateNoise,
  polyCos,
  polySin,
} from "@lingfan-character/primitives";
import {
  BONE,
  BONE_ANCHOR,
  BONE_ORDER,
  BREATH_LIFT,
  CHEST_SWING,
  HEAD_SWING,
  HEAD_TILT_RAD,
  JAW_DROP,
  SKIRT_SWING,
  WIND_NOISE,
  type BoneId,
} from "./shared";

/** 骨骼变换的输入快照：求值期的参数与节律相位。 */
export interface BoneInputs {
  /** 呼吸相位 -1..1（周期曲线求值结果）。 */
  readonly breathPhase: number;
  /** 呼吸幅度 0..1。 */
  readonly breathe: number;
  /** 朝向 -1..1。 */
  readonly headTurn: number;
  /** 张嘴 0..1（驱动下颌）。 */
  readonly mouthOpen: number;
  /** 风强 0..1。 */
  readonly wind: number;
  /** 摆动脉冲锚点：时刻 / 幅度 / 时长。 */
  readonly swingAt: number;
  readonly swingAmplitude: number;
  readonly swingMs: number;
}

/** 单骨骼的运动：绕锚点的旋转角与平移量，都由通道值算出。 */
interface BoneMotion {
  readonly rot: number;
  readonly dx: number;
  readonly dy: number;
}

/** 摆动脉冲：把「时刻/幅度/时长」三槽组装成解析链声明。 */
function swingChain(inputs: BoneInputs, segments: number): ChainSpec {
  const pulse: SpringPulse = {
    t0: inputs.swingAt,
    rest: 0,
    amplitude: inputs.swingAmplitude,
    durationMs: inputs.swingMs,
    cycles: 1,
  };
  return { pulse, segments, delayMs: 96, decay: 0.62 };
}

/** 风造成的持续轻摆：低频噪声取 -1..1，幅度随朝向与风强缩放。 */
function windDrift(
  inputs: BoneInputs,
  tMs: number,
  substream: RandomSubstream,
): number {
  const raw = evaluateNoise(WIND_NOISE, tMs, substream) * 2 - 1;
  return raw * inputs.wind * 0.006;
}

/**
 * 单骨骼运动：按骨骼语义从通道值取旋转与平移。
 * 延迟与衰减都在链条里表达——发梢比发根晚，裙摆比胯晚。
 */
function motionOf(
  bone: BoneId,
  inputs: BoneInputs,
  offsets: {
    readonly hair: readonly number[];
    readonly skirt: readonly number[];
    readonly sleeve: readonly number[];
  },
  wind: number,
): BoneMotion {
  const breath = inputs.breathPhase * inputs.breathe;
  switch (bone) {
    case BONE.root:
      return { rot: 0, dx: 0, dy: 0 };
    case BONE.chest:
      // 胸廓：随呼吸抬升、随朝向小幅横移，是「近层」的第二梯队。
      return {
        rot: 0,
        dx: inputs.headTurn * CHEST_SWING,
        dy: -breath * BREATH_LIFT,
      };
    case BONE.waist:
      // 腰：只承接呼吸与朝向的一半，避免上半身整体平移读成硬卡片。
      return {
        rot: 0,
        dx: inputs.headTurn * CHEST_SWING * 0.45,
        dy: -breath * BREATH_LIFT * 0.4,
      };
    case BONE.head:
      // 头：朝向的主要承载者，位移最大并带极小倾斜增加立体感。
      return {
        rot: inputs.headTurn * HEAD_TILT_RAD,
        dx: inputs.headTurn * HEAD_SWING,
        dy: -breath * BREATH_LIFT * 0.6 + wind * 0.4,
      };
    case BONE.jaw:
      // 下颌：张嘴时下移，闭口时归零；带一点朝向平移跟随头部。
      return {
        rot: 0,
        dx: inputs.headTurn * HEAD_SWING * 0.85,
        dy: inputs.mouthOpen * JAW_DROP - breath * BREATH_LIFT * 0.4,
      };
    case BONE.hairLeft:
      return {
        rot: offsets.hair[0]! * 0.35,
        dx:
          inputs.headTurn * HEAD_SWING * 0.55 + offsets.hair[0]! * 0.55 + wind,
        dy: offsets.hair[0]! * 0.2,
      };
    case BONE.hairRight:
      return {
        rot: -offsets.hair[0]! * 0.35,
        dx:
          inputs.headTurn * HEAD_SWING * 0.55 + offsets.hair[0]! * 0.55 + wind,
        dy: offsets.hair[0]! * 0.2,
      };
    case BONE.sleeveLeft:
      return {
        rot: offsets.sleeve[0]! * 0.3,
        dx:
          inputs.headTurn * CHEST_SWING * 0.8 +
          offsets.sleeve[0]! * 0.5 +
          wind * 0.6,
        dy: -breath * BREATH_LIFT * 0.5 + offsets.sleeve[0]! * 0.15,
      };
    case BONE.sleeveRight:
      return {
        rot: -offsets.sleeve[0]! * 0.3,
        dx:
          inputs.headTurn * CHEST_SWING * 0.8 -
          offsets.sleeve[0]! * 0.5 +
          wind * 0.6,
        dy: -breath * BREATH_LIFT * 0.5 + offsets.sleeve[0]! * 0.15,
      };
    case BONE.skirtCenter:
      return {
        rot: offsets.skirt[2]! * 0.12,
        dx:
          inputs.headTurn * SKIRT_SWING + offsets.skirt[2]! * 0.4 + wind * 0.35,
        dy: offsets.skirt[2]! * 0.1,
      };
    case BONE.skirtLeft:
      return {
        rot: offsets.skirt[1]! * 0.2,
        dx:
          inputs.headTurn * SKIRT_SWING * 0.8 +
          offsets.skirt[1]! * 0.45 +
          wind * 0.5,
        dy: offsets.skirt[1]! * 0.12,
      };
    case BONE.skirtRight:
      return {
        rot: -offsets.skirt[1]! * 0.2,
        dx:
          inputs.headTurn * SKIRT_SWING * 0.8 +
          offsets.skirt[1]! * 0.45 +
          wind * 0.5,
        dy: offsets.skirt[1]! * 0.12,
      };
    default:
      return { rot: 0, dx: 0, dy: 0 };
  }
}

/** 绕锚点旋转并平移，组装成契约矩阵（a,b,c,d,e,f）。 */
function toAffine(
  motion: BoneMotion,
  anchor: { x: number; y: number },
): AffineTransform {
  const cos = polyCos(motion.rot);
  const sin = polySin(motion.rot);
  // 点 p 先绕锚点旋转，再叠加平移：p' = R·(p − anchor) + anchor + t
  return {
    a: cos,
    b: sin,
    c: -sin,
    d: cos,
    e: anchor.x - cos * anchor.x + sin * anchor.y + motion.dx,
    f: anchor.y - sin * anchor.x - cos * anchor.y + motion.dy,
  };
}

/**
 * 计算全部骨骼的仿射矩阵，顺序与 BONE_ORDER 一致。
 * 链段数固定为 3：发与袖两段、裙摆三段——第三段最晚触发，读作拖尾。
 */
export function boneTransforms(
  inputs: BoneInputs,
  tMs: number,
  substream: RandomSubstream,
): readonly AffineTransform[] {
  const hair = chainOffsets(swingChain(inputs, 2), tMs);
  const sleeve = chainOffsets(swingChain(inputs, 2), tMs);
  const skirt = chainOffsets(swingChain(inputs, 3), tMs);
  const wind = windDrift(inputs, tMs, substream);
  const offsets = { hair, skirt, sleeve };

  return BONE_ORDER.map((bone) =>
    toAffine(motionOf(bone, inputs, offsets, wind), BONE_ANCHOR[bone]),
  );
}
