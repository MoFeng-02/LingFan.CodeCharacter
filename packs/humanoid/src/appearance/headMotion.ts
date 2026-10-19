import type { AffineTransform } from "@lingfan-character/contracts";
import { multiply, scaleAround, translate } from "./geometry";

/**
 * 头部刚体运动：转头平移叠加呼吸绕颈点的微缩放。
 * 四个外观节点共用同一运动基准，保证层间步调一致；
 * 层间视差（发帘/后发的额外摆动）由各节点在此基准上继续叠加。
 */
export function headTransform(turn: number, breath: number): AffineTransform {
  const lift = (breath - 0.5) * 0.012;
  const sway = turn * 0.055;
  return multiply(scaleAround(0.5, 0.7, 1, 1 + lift), translate(sway, 0));
}
