/**
 * 共享形变场：所有层共同调用的同一套位移规则。
 *
 * 是什么：呼吸均匀缩放 + 朝向整体平移 + 层内深度视差与深度缩放，输出与
 *         「层」无关的位移分量。
 * 为什么：层间撕裂的根源是各层各自算位移——同一点在不同层得到不同结果，
 *         接缝就裂开。把共享位移收敛成「只由坐标与参数决定」的函数，
 *         任何层在同一坐标必然得到逐字节相同的位移，撕裂在数学上不可能发生。
 *         层内深度项也放在这里：它只依赖坐标，因此同样满足层无关性，却能
 *         让一整张薄片内部读出连续体积，而不是整层刚体平移。
 * 怎么用：deformLayer 先对静止点调用本函数取共享分量，再叠加层局部分量。
 * 注意事项：本函数不接受层信息（无层标识、无深度、无密度）——任何层相关
 *          的量都必须留在局部场；缩放原点固定在颈根部，保证呼吸是起伏
 *          而不是整体放大；参数一律以「已归一化的标量」传入，避免同一
 *          换算在节点与测试里各写一份。
 */

import type { NormalizedPoint } from "@lingfan-character/contracts";
import { BREATH_GAIN, BREATH_ORIGIN, TURN_SHIFT_GAIN } from "../shared";
import {
  INTRA_PARALLAX_GAIN,
  PROFILE_PIVOT,
  depthProfile,
  depthScale,
} from "./depth";

/** 共享场原始输入：配方节点的输入参数。 */
export interface SharedInput {
  /** 呼吸节律相位 -1..1（周期曲线求值结果）。 */
  readonly breathPhase: number;
  /** 呼吸幅度 0..1。 */
  readonly breathe: number;
  /** 朝向 -1..1。 */
  readonly headTurn: number;
}

/** 共享场归一化参数：进槽位的标量，各层读取后直接使用。 */
export interface SharedParams {
  /** 绕颈根部的均匀缩放系数（1 = 静止）。 */
  readonly breathScale: number;
  /** 朝向整体平移量（归一化横坐标增量）。 */
  readonly turnShift: number;
  /** 朝向 -1..1：层内深度视差与深度缩放都要用到。 */
  readonly headTurn: number;
}

/** 原始输入换算成共享场参数：全仓唯一换算点。 */
export function resolveShared(input: SharedInput): SharedParams {
  return {
    breathScale: 1 + BREATH_GAIN * input.breathPhase * input.breathe,
    turnShift: input.headTurn * TURN_SHIFT_GAIN,
    headTurn: input.headTurn,
  };
}

/** 共享位移：绕颈根部的缩放、朝向平移、层内深度视差与深度缩放。 */
export function sharedDisplacement(
  point: NormalizedPoint,
  params: SharedParams,
): NormalizedPoint {
  // 层内深度视差：鼻尖朝向侧移动得多，轮廓边缘移动得少——一张薄片内部
  // 因此产生连续起伏；只依赖坐标与朝向，任何层在同一点必然同值。
  const depthX =
    params.headTurn *
    (depthProfile(point) - PROFILE_PIVOT) *
    INTRA_PARALLAX_GAIN;

  // 深度缩放：前侧略微放大、后侧略微缩小，读作近大远小而非整体推拉。
  const scale = params.breathScale * depthScale(point, params.headTurn);
  const growth = scale - 1;

  return {
    x: (point.x - BREATH_ORIGIN.x) * growth + params.turnShift + depthX,
    y: (point.y - BREATH_ORIGIN.y) * growth,
  };
}

/** 共享场作用后的坐标：静止点 + 共享位移。 */
export function applyShared(
  point: NormalizedPoint,
  params: SharedParams,
): NormalizedPoint {
  const delta = sharedDisplacement(point, params);
  return { x: point.x + delta.x, y: point.y + delta.y };
}
