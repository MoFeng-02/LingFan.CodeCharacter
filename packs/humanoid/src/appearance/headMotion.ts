import type { AffineTransform } from "@lingfan-character/contracts";
import { multiply, rotateAround, scaleAround, translate } from "./geometry";

/**
 * 头部刚体运动：转头绕颈点旋转并带轻微平移视差，
 * 呼吸绕颈点做均匀缩放的体积起伏（各向同性，无单轴拉伸）。
 * 四个外观节点共用同一运动基准，保证层间步调一致；
 * 层间视差（发帘/后发的额外摆动）由各节点在此基准上继续叠加。
 */
export function headTransform(turn: number, breath: number): AffineTransform {
  const lift = (breath - 0.5) * 0.016;
  const sway = turn * 0.045;
  const tilt = turn * 0.14;
  return multiply(
    scaleAround(0.5, 0.78, 1 + lift, 1 + lift),
    multiply(rotateAround(0.5, 0.78, tilt), translate(sway, 0)),
  );
}
