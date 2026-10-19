import type { AffineTransform } from "@lingfan-character/contracts";
import { multiply, scaleAround, translate } from "./geometry";

/**
 * 头部刚体运动基准。转头是朝向变化而非旋转——整头旋转读作摇头，
 * 刚体层只带轻微水平随动；朝向的透视感由各外观特征在自身节点内
 * 按深度做分档视差表达（鼻 > 五官 > 脸缘，转向侧位移略大）。
 * 呼吸绕颈点做均匀缩放的体积起伏（各向同性，无单轴拉伸）。
 * 四个外观节点共用同一运动基准，保证层间步调一致。
 */
export function headTransform(turn: number, breath: number): AffineTransform {
  const lift = (breath - 0.5) * 0.016;
  const sway = turn * 0.02;
  return multiply(
    scaleAround(0.5, 0.78, 1 + lift, 1 + lift),
    translate(sway, 0),
  );
}
