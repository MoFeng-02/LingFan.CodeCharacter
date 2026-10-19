import type {
  NodeDeclaration,
  PathCommand,
  RenderPrimitive,
} from "@lingfan-character/contracts";
import { lipDeform } from "../basis";
import { NODE_ID } from "../nodes";
import { SLOT } from "../shared";
import { ellipse, fillPath, multiply, pt, translate } from "./geometry";
import { headTransform } from "./headMotion";
import { PALETTE } from "./palette";

/**
 * 嘴部节点：闭嘴是唇线，说话时上下唇分离露出口腔内衬。
 * 开口度（口型驱动节点产出）与下颌基共同决定唇距与口腔高度——
 * 口型驱动接口不变（场景 0..1 开口度），下颌基是表情侧的开口来源。
 * 嘴角基左右独立（不对称微表情），唇缘卷曲加深月牙外弓弧，
 * 抿嘴收窄变薄；微笑保持嘴角上挑与加宽。基元顺序即层叠顺序：
 * 口腔在最底，上下唇盖边——闭嘴时口腔薄条被唇带完全覆盖，无需分支。
 */
export const mouthNode: NodeDeclaration = {
  id: NODE_ID.mouth,
  reads: [
    SLOT.openWave,
    SLOT.smileWave,
    SLOT.headTurn,
    SLOT.breathWave,
    SLOT.mouthCornerL,
    SLOT.mouthCornerR,
    SLOT.lipCurlUpper,
    SLOT.lipCurlLower,
    SLOT.lipCompress,
    SLOT.jawOpen,
  ],
  writes: [],
  step: (inputs) => {
    const read = (slot: keyof typeof SLOT): number =>
      inputs.values[SLOT[slot]] ?? 0;
    const open = read("openWave");
    const smile = read("smileWave");
    const turn = read("headTurn");
    const breath = read("breathWave");
    const jaw = read("jawOpen");
    const head = headTransform(turn, breath);
    const mouth = multiply(head, translate(turn * 0.024, 0));
    const lip = lipDeform(
      read("mouthCornerL"),
      read("mouthCornerR"),
      read("lipCurlUpper"),
      read("lipCurlLower"),
      read("lipCompress"),
    );

    const cx = 0.5;
    const half = (0.035 + smile * 0.008) * lip.widthScale;
    const lipY = 0.575 - smile * 0.012;
    const gap = open * 0.03 + jaw * 0.022;
    const bulge = (0.006 + smile * 0.004) * lip.thinScale;
    const yTopL = lipY - 0.004 + lip.cornerLiftL;
    const yTopR = lipY - 0.004 + lip.cornerLiftR;
    const upperGap = 0.006 + open * 0.005 + jaw * 0.004;
    const lowerGap = gap;

    const primitives: RenderPrimitive[] = [
      ellipse(
        NODE_ID.mouth,
        pt(cx, lipY + gap * 0.5 + 0.002),
        half * 0.85,
        0.002 + open * 0.018 + jaw * 0.012,
        mouth,
        PALETTE.mouthDark,
      ),
      fillPath(
        NODE_ID.mouth,
        lipBand(
          yTopL,
          yTopR,
          yTopL + upperGap,
          yTopR + upperGap,
          half,
          bulge * (1 + lip.curlUpper * 0.8),
        ),
        mouth,
        PALETTE.mouth,
      ),
      fillPath(
        NODE_ID.mouth,
        lipBand(
          lipY + lowerGap,
          lipY + lowerGap,
          lipY + lowerGap + 0.008 + open * 0.004 + jaw * 0.003,
          lipY + lowerGap + 0.008 + open * 0.004 + jaw * 0.003,
          half,
          bulge * (1 + lip.curlLower * 0.8),
        ),
        mouth,
        PALETTE.mouth,
      ),
    ];
    return { values: {}, primitives };
  },
};

/**
 * 唇带：上缘连左右端点（可各自升降表达不对称嘴角）、下缘外弓的
 * 月牙形闭合路径（唇厚的程序表达）。
 */
function lipBand(
  yTopL: number,
  yTopR: number,
  yBottomL: number,
  yBottomR: number,
  half: number,
  bulge: number,
): PathCommand[] {
  const cx = 0.5;
  return [
    { kind: "moveTo", point: pt(cx - half, yTopL) },
    {
      kind: "bezierCurveTo",
      control1: pt(cx - half * 0.45, yBottomL + bulge),
      control2: pt(cx + half * 0.45, yBottomR + bulge),
      point: pt(cx + half, yTopR),
    },
    {
      kind: "bezierCurveTo",
      control1: pt(cx + half * 0.45, yTopR + 0.002),
      control2: pt(cx - half * 0.45, yTopL + 0.002),
      point: pt(cx - half, yTopL),
    },
    { kind: "closePath" },
  ];
}
