import type {
  MeshPrimitive,
  NormalizedPoint,
} from "@lingfan-character/contracts";
import {
  BONE,
  BONE_ANCHOR,
  BONE_ORDER,
  BONE_RADIUS,
  EYE_BAND,
  GRID_COLS,
  GRID_ROWS,
  SLOT,
  TEXTURE_ID,
  boneTransforms,
  buildWeightTable,
  restGrid,
  riggedPortraitPack,
  skinVertices,
  squeezeEyeBand,
  surfaceNode,
  type SlotId,
} from "@lingfan-character/example-rigged-portrait";
import { createCharacterRuntime } from "@lingfan-character/kernel";
import {
  buildDrawPlan,
  fingerprint,
} from "@lingfan-character/renderer-canvas2d";
import { describe, expect, it } from "vitest";

/**
 * 单图蒙皮判据：恒等性、权重归一、区域分离、链段延迟与确定性。
 * 核心不变量是「一张图只有一份像素」——顶点怎么动，贴图都按网格
 * 线性变形，因此形变连续、不会出现分层方案里的层间裂缝；
 * 代价是失去层间解耦（闭眼只能压缩眼区）。
 */

const SCALE = 512;
const runtime = createCharacterRuntime(riggedPortraitPack);
const VERTEX_COUNT = GRID_COLS * GRID_ROWS;

/** 静止网格：用于比较位移。 */
const REST = restGrid();

/** 把归一化纵向坐标换成最近的行号：行距 1/(GRID_ROWS−1)。 */
const rowAt = (y: number): number =>
  Math.max(0, Math.min(GRID_ROWS - 1, Math.round(y * (GRID_ROWS - 1))));

/** 把归一化横向坐标换成最近的列号：列距 1/(GRID_COLS−1)。 */
const colAt = (x: number): number =>
  Math.max(0, Math.min(GRID_COLS - 1, Math.round(x * (GRID_COLS - 1))));

/** 头部采样行：锚点 y 处（解剖中心），下标由锚点推导而非手写行号。 */
const HEAD_ROW = rowAt(BONE_ANCHOR[BONE.head].y);
/** 胸廓采样行：胸骨骼锚点处，呼吸抬升在此处最明显。 */
const CHEST_ROW = rowAt(BONE_ANCHOR[BONE.chest].y);
/** 裙摆采样行：裙骨骼下缘附近，远离胸廓，不应承接呼吸。 */
const SKIRT_ROW = rowAt(
  BONE_ANCHOR[BONE.skirtCenter].y + BONE_RADIUS[BONE.skirtCenter].ry * 0.85,
);
/** 躯干中线列：锚点 x 处（人不居中，不能取画布正中）。 */
const MID_COL = colAt(BONE_ANCHOR[BONE.chest].x);

/** 静息参数：全部通道归零，摆动锚点设在过去（已平息）。 */
const STILL: Partial<Record<SlotId, number>> = {
  [SLOT.breathe]: 0,
  [SLOT.headTurn]: 0,
  [SLOT.blink]: 0,
  [SLOT.mouthOpen]: 0,
  [SLOT.wind]: 0,
  [SLOT.swingAt]: -1,
  [SLOT.swingAmplitude]: 0,
  [SLOT.swingMs]: 520,
};

const stateAt = (t: number, overrides?: Partial<Record<string, number>>) =>
  runtime.computeAt(t, overrides);

/** 取该时刻网格顶点：配方只有一个外观节点、一条基元。 */
async function verticesAt(
  t: number,
  overrides?: Partial<Record<string, number>>,
): Promise<readonly NormalizedPoint[]> {
  const state = await stateAt(t, overrides);
  const node = state.nodes[surfaceNode.id]!;
  const primitive = node.primitives[0]!;
  const shape = primitive.shape as MeshPrimitive;
  expect(shape.kind).toBe("mesh");
  return shape.vertices;
}

/** 行优先索引：第 row 行第 col 列。 */
const at = (points: readonly NormalizedPoint[], row: number, col: number) =>
  points[row * GRID_COLS + col]!;

describe("单图权重蒙皮", () => {
  it("网格规模与纹理标识符合声明", async () => {
    const state = await stateAt(1200, STILL);
    const node = state.nodes[surfaceNode.id]!;
    const shape = node.primitives[0]!.shape as MeshPrimitive;
    expect(shape.kind).toBe("mesh");
    expect(shape.cols).toBe(GRID_COLS);
    expect(shape.rows).toBe(GRID_ROWS);
    expect(shape.vertices).toHaveLength(VERTEX_COUNT);
    expect(shape.textureId).toBe(TEXTURE_ID);
  });

  it("静息参数下蒙皮是恒等变换", async () => {
    // 全部骨骼变换退化为恒等时，权重混合应还原静止坐标；
    // 只允许浮点累加误差（权重归一化的除法不是精确幂次）。
    const vertices = await verticesAt(1200, STILL);
    let maxDrift = 0;
    for (let index = 0; index < REST.length; index += 1) {
      const rest = REST[index]!;
      const moved = vertices[index]!;
      maxDrift = Math.max(
        maxDrift,
        Math.abs(moved.x - rest.x),
        Math.abs(moved.y - rest.y),
      );
    }
    expect(maxDrift).toBeLessThan(1e-12);
  });

  it("权重表每行非负且求和为一", () => {
    const table = buildWeightTable(REST);
    expect(table).toHaveLength(VERTEX_COUNT);
    for (const row of table) {
      expect(row).toHaveLength(BONE_ORDER.length);
      let total = 0;
      for (const weight of row) {
        expect(weight).toBeGreaterThanOrEqual(0);
        total += weight;
      }
      expect(Math.abs(total - 1)).toBeLessThan(1e-12);
    }
  });

  it("转头把头部与裙摆分开牵引", async () => {
    const still = await verticesAt(1200, STILL);
    const turned = await verticesAt(1200, { ...STILL, [SLOT.headTurn]: 1 });
    // 头部顶点（头部锚点所在行）横移应显著大于裙摆底部顶点。
    const headIndex = HEAD_ROW * GRID_COLS + MID_COL;
    const skirtIndex = SKIRT_ROW * GRID_COLS + MID_COL;
    const headShift = turned[headIndex]!.x - still[headIndex]!.x;
    const skirtShift = turned[skirtIndex]!.x - still[skirtIndex]!.x;
    expect(headShift).toBeGreaterThan(0.01);
    expect(headShift).toBeGreaterThan(skirtShift * 3);
  });

  it("呼吸抬升胸廓且不影响裙摆底部", async () => {
    // 呼吸相位是 0..1 的脉冲：半周期升到峰、半周期回落，接缝处归零。
    // 取相位峰与接缝两点比较，位移差才等于完整抬升量。
    const peak = await verticesAt(2100, { ...STILL, [SLOT.breathe]: 1 });
    const seam = await verticesAt(4200, { ...STILL, [SLOT.breathe]: 1 });
    const chestIndex = CHEST_ROW * GRID_COLS + MID_COL;
    // 抬升是负 y 方向（画布向下为正），两点差值应等于 BREATH_LIFT 量级。
    const chestRise = Math.abs(seam[chestIndex]!.y - peak[chestIndex]!.y);
    expect(chestRise).toBeGreaterThan(0.004);

    // 裙摆只被骨骼自身链条牵引，不承接呼吸——位移应远小于胸廓。
    const skirtIndex = SKIRT_ROW * GRID_COLS + MID_COL;
    const skirtShift = Math.abs(seam[skirtIndex]!.y - peak[skirtIndex]!.y);
    expect(skirtShift).toBeLessThan(chestRise * 0.2);
  });

  it("眨眼只压缩眼带内部，带外顶点不动", () => {
    // 纯函数验证：眼带外的顶点在压缩前后逐字节相同。
    const points = restGrid();
    const squeezed = squeezeEyeBand(points, 1, EYE_BAND, 0.55);
    const inside = (point: NormalizedPoint): boolean => {
      const dx = (point.x - EYE_BAND.x) / EYE_BAND.rx;
      const dy = (point.y - EYE_BAND.y) / EYE_BAND.ry;
      return 1 - dx * dx - dy * dy > 0;
    };
    let movedInside = 0;
    for (let index = 0; index < points.length; index += 1) {
      const point = points[index]!;
      const moved = squeezed[index]!;
      if (inside(point)) {
        const before = Math.abs(point.y - EYE_BAND.y);
        const after = Math.abs(moved.y - EYE_BAND.y);
        // 眼带内：向中线靠拢（压缩），横坐标不变。
        if (after < before - 1e-12) movedInside += 1;
        expect(moved.x).toBe(point.x);
      } else {
        expect(moved.y).toBe(point.y);
      }
    }
    expect(movedInside).toBeGreaterThan(0);
  });

  it("链段延迟：脉冲触发瞬间发已动、裙摆尚未响应", () => {
    // 发取第 0 段（无延迟），裙摆取第 2 段（延迟两个 96ms）。
    // 力矩在 t0 之后才累积，取 t0+10ms 比较：发已动、裙摆仍停在静止位。
    const t0 = 3000;
    const inputs = {
      breathPhase: 0,
      breathe: 0,
      headTurn: 0,
      mouthOpen: 0,
      wind: 0,
      swingAt: t0,
      swingAmplitude: 0.4,
      swingMs: 520,
    };
    const substream = { seed: 1, next: () => 0.5 };
    const indexOf = (bone: string): number => BONE_ORDER.indexOf(bone as never);

    const atTrigger = boneTransforms(inputs, t0 + 10, substream);
    const hairEarly = atTrigger[indexOf(BONE.hairLeft)]!;
    const skirtEarly = atTrigger[indexOf(BONE.skirtCenter)]!;
    expect(Math.abs(hairEarly.e)).toBeGreaterThan(0);

    // 裙摆中心骨骼无旋转、锚点居中：平移分量为零即静止位。
    expect(skirtEarly.e).toBeCloseTo(0, 12);
    expect(skirtEarly.f).toBeCloseTo(0, 12);

    // 等到脉冲走完，裙摆才被拖起来——延迟确实存在，不是永久静止。
    const settled = boneTransforms(inputs, t0 + inputs.swingMs, substream);
    const skirtSettled = settled[indexOf(BONE.skirtCenter)]!;
    expect(Math.abs(skirtSettled.e)).toBeGreaterThan(0);
  });

  it("同刻两遍求值与指纹逐字节一致", async () => {
    const overrides = {
      ...STILL,
      [SLOT.headTurn]: 0.6,
      [SLOT.breathe]: 0.8,
      [SLOT.blink]: 0.4,
    };
    const first = await stateAt(2600, overrides);
    const second = await stateAt(2600, overrides);
    expect(fingerprint(buildDrawPlan(first, SCALE))).toBe(
      fingerprint(buildDrawPlan(second, SCALE)),
    );
  });

  it("极端参数下顶点保持有限值", async () => {
    const extreme = {
      [SLOT.breathe]: 1,
      [SLOT.headTurn]: 1,
      [SLOT.blink]: 1,
      [SLOT.mouthOpen]: 1,
      [SLOT.wind]: 1,
      [SLOT.swingAt]: 1200,
      [SLOT.swingAmplitude]: 1,
      [SLOT.swingMs]: 200,
    };
    const vertices = await verticesAt(1400, extreme);
    for (const point of vertices) {
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
    }
    // 极端参数也不该把网格摊平：首末行纵向仍应有间距。
    const top = at(vertices, 0, 0).y;
    const bottom = at(vertices, GRID_ROWS - 1, 0).y;
    expect(bottom).toBeGreaterThan(top);
  });

  it("骨骼变换等价于逐点仿射（蒙皮与变换口径一致）", () => {
    // 蒙皮公式必须与 AffineTransform 的契约口径一致：
    // x' = a·x + c·y + e。此处用单骨骼权重（恒为 1）验证一次。
    const points = [{ x: 0.25, y: 0.75 }];
    const single = [[1]] as const;
    const transforms = [{ a: 2, b: 0, c: 0, d: 3, e: 0.1, f: -0.2 }] as const;
    const result = skinVertices(points, single, transforms);
    expect(result[0]!.x).toBeCloseTo(2 * 0.25 + 0.1, 12);
    expect(result[0]!.y).toBeCloseTo(3 * 0.75 - 0.2, 12);
  });
});
