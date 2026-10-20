/**
 * 共享形变场：所有层共同调用的同一套位移规则。
 *
 * 是什么：呼吸均匀缩放 + 朝向整体平移，输出与「层」无关的位移分量。
 * 为什么：层间撕裂的根源是各层各自算位移——同一点在不同层得到不同结果，
 *         接缝就裂开。把共享位移收敛成「只由坐标与参数决定」的函数，
 *         任何层在同一坐标必然得到逐字节相同的位移，撕裂在数学上不可能发生。
 * 怎么用：deformLayer 先对静止点调用本函数取共享分量，再叠加层局部分量。
 * 注意事项：本函数不接受层信息（无层标识、无深度、无密度）——任何层相关
 *          的量都必须留在局部场；缩放原点固定在颈根部，保证呼吸是起伏
 *          而不是整体放大；参数一律以「已归一化的标量」传入，避免同一
 *          换算在节点与测试里各写一份。
 */

import type { NormalizedPoint } from "@lingfan-character/contracts";
import { BREATH_GAIN, BREATH_ORIGIN, TURN_SHIFT_GAIN } from "../shared";

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
}

/** 原始输入换算成共享场参数：全仓唯一换算点。 */
export function resolveShared(input: SharedInput): SharedParams {
  return {
    breathScale: 1 + BREATH_GAIN * input.breathPhase * input.breathe,
    turnShift: input.headTurn * TURN_SHIFT_GAIN,
  };
}

/** 共享位移：绕颈根部均匀缩放的位移量 + 朝向整体平移。 */
export function sharedDisplacement(
  point: NormalizedPoint,
  params: SharedParams,
): NormalizedPoint {
  const growth = params.breathScale - 1;
  return {
    x: (point.x - BREATH_ORIGIN.x) * growth + params.turnShift,
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
