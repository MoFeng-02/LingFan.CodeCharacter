/**
 * 层局部位移场：只作用于本层内部结构的运动规则。
 *
 * 是什么：朝向视差、眼睑下移、视线偏移、眉位移、嘴张合、发层摆动与风抖。
 * 为什么：层是「重叠的贴图」而不是「拼接的拼图」——局部位移只在层内部
 *         移动内容，层与层之间由共享场保证不相对漂移；发层用受控链条
 *         与平滑值噪声产生自然摆动，全部为纯函数解析值。
 * 怎么用：deformLayer 在共享分量之上叠加本函数返回的局部分量。
 * 注意事项：视差量按「深度 − 枢轴深度」分级，深度相同必然同位移；
 *          发层抖动量由参数节点算好后传进来，本函数不做噪声求值——
 *          噪声需要节点子流种子，属于节点层职责。
 */

import type { NormalizedPoint } from "@lingfan-character/contracts";
import { PARALLAX_GAIN, PARALLAX_PIVOT } from "../shared";

/** 局部场参数：由参数节点算出。 */
export interface LocalParams {
  /** 朝向 -1..1。 */
  readonly headTurn: number;
  /** 眼睑下移量（正 = 向下）。 */
  readonly lidTravel: number;
  /** 视线横移与纵移量。 */
  readonly gazeShiftX: number;
  readonly gazeShiftY: number;
  /** 眉位移（负 = 抬起）。 */
  readonly browLift: number;
  /** 嘴张合量（正 = 上下缘反向扩张）。 */
  readonly mouthShape: number;
  /** 受控链条回摆偏移。 */
  readonly swingOffset: number;
  /** 发层抖动横向量（已含风强度与噪声相位）。 */
  readonly windShiftX: number;
  /** 发层抖动纵向量。 */
  readonly windShiftY: number;
  /** 嘴部中心纵坐标：张口时上下缘围绕它对称扩张。 */
  readonly mouthCenterY: number;
}

/**
 * 朝向视差：深度大于枢轴的层向转向侧移动更多，小于枢轴的层相对后退。
 * 只依赖深度与朝向——同深度的层必然得到同一视差，不会相对漂移。
 */
export function parallaxShift(depth: number, headTurn: number): number {
  return headTurn * (depth - PARALLAX_PIVOT) * (PARALLAX_GAIN * 2.2);
}

/**
 * 层内局部位移：按层类别分派。
 * 每种规则只改变本层内容的位置，不改变层与层的相对关系。
 */
export function localDisplacement(
  point: NormalizedPoint,
  kind: string,
  params: LocalParams,
  depth: number,
): NormalizedPoint {
  const parallax = parallaxShift(depth, params.headTurn);
  switch (kind) {
    case "pupil":
      // 眼球不随眼睑移动：眨眼是眼睑滑过静止的眼球。若眼球跟着下沉，
      // 眼睑永远追不上，视觉上就闭不上眼。
      return {
        x: parallax + params.gazeShiftX,
        y: params.gazeShiftY,
      };
    case "eye-white":
      return {
        x: parallax + params.gazeShiftX * 0.4,
        y: 0,
      };
    case "eyelid":
      return { x: parallax, y: params.lidTravel };
    case "brow":
      return { x: parallax + params.gazeShiftX * 0.25, y: params.browLift };
    case "mouth": {
      const lower = point.y > params.mouthCenterY;
      return { x: parallax, y: lower ? params.mouthShape : -params.mouthShape };
    }
    case "hair-front":
      return {
        x: parallax + params.swingOffset + params.windShiftX,
        y: params.windShiftY,
      };
    case "hair-back":
      return {
        x: parallax + params.swingOffset * 0.7 + params.windShiftX * 0.8,
        y: params.windShiftY * 0.8,
      };
    case "face":
    default:
      return { x: parallax, y: 0 };
  }
}
