/**
 * 网格形变数学：素材立绘的四通道顶点位移。
 *
 * 是什么：静止网格生成 + 呼吸/眨眼/口型/朝向四通道的区域位移合成，
 *         输出 MeshPrimitive 的顶点表。
 * 为什么：素材管画、程序管动——位图质感由宿主纹理提供，动作全部
 *         表现为归一化网格顶点的纯函数位移，逐字节可求值可指纹。
 * 怎么用：restGrid() 生成静止网格；deformGrid(inputs, t) 产出形变顶点，
 *         供 portrait 配方的外观节点写入 MeshPrimitive。
 * 注意事项：区域权重用抛物线衰减（纯四则，不用超越函数）；
 *          通道之间线性叠加，叠加后仍落在合法域内（各通道幅度有界）；
 *          顶点行优先排列，长度 = cols×rows。
 */

import type { CurveExpr, NormalizedPoint } from "@lingfan-character/contracts";
import { evaluateCurve } from "@lingfan-character/primitives";
import { GRID_COLS, GRID_ROWS, SLOT } from "./shared";

/** 单顶点四通道输入：求值期的参数快照。 */
export interface DeformInputs {
  readonly breathPhase: number;
  readonly blink: number;
  readonly mouthOpen: number;
  readonly headTurn: number;
  /** 呼吸起伏总幅度 0..1。 */
  readonly breatheAmp: number;
}

/** 呼吸节律：4.2 秒周期，上升段与反向抵消段构成无静息偏移的脉冲。 */
const BREATH_CYCLE: CurveExpr = {
  kind: "sum",
  parts: [
    {
      kind: "cycle",
      periodMs: 4200,
      base: {
        kind: "easing",
        easing: "smoothstep",
        fromMs: 0,
        toMs: 2100,
        fromValue: 0,
        toValue: 1,
      },
    },
    {
      kind: "cycle",
      periodMs: 4200,
      base: {
        kind: "easing",
        easing: "smoothstep",
        fromMs: 2100,
        toMs: 4200,
        fromValue: 0,
        toValue: -1,
      },
    },
  ],
};

/** 静止网格：全图均匀 cols×rows 控制点，0..1 归一化，行优先。 */
export function restGrid(): NormalizedPoint[] {
  const points: NormalizedPoint[] = [];
  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let col = 0; col < GRID_COLS; col += 1) {
      points.push({
        x: col / (GRID_COLS - 1),
        y: row / (GRID_ROWS - 1),
      });
    }
  }
  return points;
}

/** 抛物线衰减：d 归一化偏差，r 作用半径，区域内 1→0 平滑归零。 */
function falloff(
  dx: number,
  dy: number,
  radiusX: number,
  radiusY: number,
): number {
  const nx = dx / radiusX;
  const ny = dy / radiusY;
  const q = 1 - nx * nx - ny * ny;
  return q > 0 ? q : 0;
}

/**
 * 形变顶点表：四通道位移线性叠加。
 * 呼吸作用于躯干带（y 越大位移越大），眨眼与口型作用于各自区域，
 * 朝向按垂直中带加权做水平视差。
 */
export function deformGrid(
  inputs: DeformInputs,
  tMs: number,
): NormalizedPoint[] {
  const breath = evaluateCurve(BREATH_CYCLE, tMs) * inputs.breatheAmp * 0.01;
  const points = restGrid();
  return points.map((point) => {
    let { x, y } = point;

    // 呼吸：肩胸带（y > 0.55）随呼吸相位整体起伏，越靠下越明显。
    const trunk = Math.max(0, point.y - 0.55) / 0.45;
    y += breath * trunk;

    // 眨眼：眼区顶点向下压（上睑闭合观感）。
    const eye = falloff(point.x - 0.5, point.y - 0.4, 0.22, 0.09);
    y += eye * inputs.blink * 0.012;

    // 口型：上唇微升、下颌区下移，形成张口观感。
    const mouth = falloff(point.x - 0.5, point.y - 0.62, 0.13, 0.07);
    if (point.y < 0.62) {
      y -= mouth * inputs.mouthOpen * 0.004;
    } else {
      y += mouth * inputs.mouthOpen * 0.012;
    }

    // 朝向：水平视差，垂直中带位移大、上下边缘小，整图随朝向平移。
    const midBand = 1 - Math.abs(point.y * 2 - 1);
    x += inputs.headTurn * (0.006 + 0.008 * midBand);

    return { x, y };
  });
}

/** 编排入口的槽位快照键集合（供节点 reads 声明与求值取值共用）。 */
export const DEFORM_SLOT_KEYS = [
  SLOT.breathe,
  SLOT.blink,
  SLOT.mouthOpen,
  SLOT.headTurn,
] as const;
