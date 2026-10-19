import type {
  NodeDeclaration,
  PathCommand,
  RenderPrimitive,
} from "@lingfan-character/contracts";
import { NODE_ID } from "../nodes";
import { SLOT } from "../shared";
import { ellipse, fillPath, multiply, pt, translate } from "./geometry";
import { headTransform } from "./headMotion";
import { PALETTE } from "./palette";

/**
 * 嘴部节点：闭嘴是唇线，说话时上下唇分离露出口腔内衬。
 * 开口度（口型驱动节点产出）决定唇距与口腔高度，微笑保持嘴角上挑与加宽，
 * 转头按五官档位扫动，呼吸经头部变换传导起伏。基元顺序即层叠顺序：
 * 口腔在最底，上下唇盖边——闭嘴时口腔薄条被唇带完全覆盖，无需分支。
 */
export const mouthNode: NodeDeclaration = {
  id: NODE_ID.mouth,
  reads: [SLOT.openWave, SLOT.smileWave, SLOT.headTurn, SLOT.breathWave],
  writes: [],
  step: (inputs) => {
    const open = inputs.values[SLOT.openWave] ?? 0;
    const smile = inputs.values[SLOT.smileWave] ?? 0;
    const turn = inputs.values[SLOT.headTurn] ?? 0;
    const breath = inputs.values[SLOT.breathWave] ?? 0;
    const head = headTransform(turn, breath);
    const mouth = multiply(head, translate(turn * 0.024, 0));

    const cx = 0.5;
    const half = 0.035 + smile * 0.008;
    const lipY = 0.575 - smile * 0.012;
    const gap = open * 0.03;
    const bulge = 0.006 + smile * 0.004;

    const primitives: RenderPrimitive[] = [
      ellipse(
        NODE_ID.mouth,
        pt(cx, lipY + gap * 0.5 + 0.002),
        half * 0.85,
        0.002 + open * 0.018,
        mouth,
        PALETTE.mouthDark,
      ),
      fillPath(
        NODE_ID.mouth,
        lipBand(lipY - 0.004, lipY + 0.006 + open * 0.005, half, bulge),
        mouth,
        PALETTE.mouth,
      ),
      fillPath(
        NODE_ID.mouth,
        lipBand(lipY + gap, lipY + gap + 0.008 + open * 0.004, half, bulge),
        mouth,
        PALETTE.mouth,
      ),
    ];
    return { values: {}, primitives };
  },
};

/** 唇带：一条上缘平直、下缘外弓的月牙形闭合路径（唇厚的程序表达）。 */
function lipBand(
  yTop: number,
  yBottom: number,
  half: number,
  bulge: number,
): PathCommand[] {
  const cx = 0.5;
  return [
    { kind: "moveTo", point: pt(cx - half, yTop) },
    {
      kind: "bezierCurveTo",
      control1: pt(cx - half * 0.45, yBottom + bulge),
      control2: pt(cx + half * 0.45, yBottom + bulge),
      point: pt(cx + half, yTop),
    },
    {
      kind: "bezierCurveTo",
      control1: pt(cx + half * 0.45, yTop + 0.002),
      control2: pt(cx - half * 0.45, yTop + 0.002),
      point: pt(cx - half, yTop),
    },
    { kind: "closePath" },
  ];
}
