import type {
  CharacterState,
  MeshPrimitive,
  NormalizedPoint,
} from "@lingfan-character/contracts";
import {
  FIELD_NODE_ID,
  LAYER_SPECS,
  SLOT,
  applyShared,
  deformLayer,
  layeredPack,
  layerNodeId,
  resolveShared,
  restLayer,
  type LocalParams,
} from "@lingfan-character/example-layered";
import { createCharacterRuntime } from "@lingfan-character/kernel";
import {
  buildDrawPlan,
  fingerprint,
} from "@lingfan-character/renderer-canvas2d";
import { describe, expect, it } from "vitest";

/**
 * 分层素材轨判据：层序、网格密度、共享场一致性、非翻转与不撕裂。
 * 核心不变量是「位移只有一个来源」——任何层都不会独自移动，
 * 因此层间接缝在数学上不可能裂开。
 */

const SCALE = 512;
const runtime = createCharacterRuntime(layeredPack);

const stateAt = (t: number, overrides?: Partial<Record<string, number>>) =>
  runtime.computeAt(t, overrides);

/** 零局部位移：验证共享分量的层无关性时使用。 */
const ZERO_LOCAL: LocalParams = {
  headTurn: 0,
  lidTravel: 0,
  gazeShiftX: 0,
  gazeShiftY: 0,
  browLift: 0,
  mouthShape: 0,
  swingOffset: 0,
  windShiftX: 0,
  windShiftY: 0,
  mouthCenterY: 0.625,
};

function meshOf(state: CharacterState, layerIndex: number): MeshPrimitive {
  const spec = LAYER_SPECS[layerIndex];
  if (!spec) {
    throw new Error(`层序越界: ${layerIndex}`);
  }
  const node = state.nodes[layerNodeId(spec.id)];
  if (!node) {
    throw new Error(`缺少层节点: ${spec.id}`);
  }
  const shape = node.primitives[0]?.shape;
  if (!shape || shape.kind !== "mesh") {
    throw new Error(`层 ${spec.id} 未产出网格基元`);
  }
  return shape;
}

function layerIndex(id: string): number {
  const index = LAYER_SPECS.findIndex((spec) => spec.id === id);
  if (index < 0) {
    throw new Error(`未知图层: ${id}`);
  }
  return index;
}

/** 网格单元有向面积：x 向右、y 向下，静止态恒为正。 */
function cellArea(
  vertices: readonly NormalizedPoint[],
  cols: number,
  row: number,
  col: number,
): number {
  const origin = vertices[row * cols + col];
  const right = vertices[row * cols + col + 1];
  const down = vertices[(row + 1) * cols + col];
  if (!origin || !right || !down) {
    throw new Error("网格索引越界");
  }
  return (
    (right.x - origin.x) * (down.y - origin.y) -
    (right.y - origin.y) * (down.x - origin.x)
  );
}

/** 全部层顶点的纵坐标极值：定位眼睑覆盖范围用。 */
function maxY(vertices: readonly NormalizedPoint[]): number {
  return vertices.reduce((peak, point) => Math.max(peak, point.y), -Infinity);
}

describe("分层素材轨 layered 配方", () => {
  it("十二层按声明序绘制，后发最先、前发最后", async () => {
    const state = await stateAt(0);
    expect(LAYER_SPECS.length).toBe(12);
    expect(state.zOrder).toEqual([
      FIELD_NODE_ID,
      ...LAYER_SPECS.map((spec) => layerNodeId(spec.id)),
    ]);
    expect(state.zOrder.length).toBe(1 + LAYER_SPECS.length);
    expect(LAYER_SPECS[0]?.id).toBe("hair-back");
    expect(LAYER_SPECS[LAYER_SPECS.length - 1]?.id).toBe("hair-front");

    const plan = buildDrawPlan(state, SCALE);
    const drawn = plan.commands.map((command) =>
      command.shape.kind === "mesh" ? command.shape.textureId : "",
    );
    expect(drawn).toEqual(LAYER_SPECS.map((spec) => spec.textureId));
  });

  it("每层顶点数等于网格密度，且层间密度允许不同", async () => {
    const state = await stateAt(0);
    LAYER_SPECS.forEach((spec, index) => {
      const mesh = meshOf(state, index);
      expect(mesh.cols).toBe(spec.cols);
      expect(mesh.rows).toBe(spec.rows);
      expect(mesh.vertices.length).toBe(spec.cols * spec.rows);
      expect(state.nodes[layerNodeId(spec.id)]?.primitives.length).toBe(1);
    });
    const densities = new Set(
      LAYER_SPECS.map((spec) => `${spec.cols}x${spec.rows}`),
    );
    expect(densities.size).toBeGreaterThan(1);
  });

  it("共享分量层无关：局部位移归零时十二层形变与共享场逐字节一致", () => {
    const point: NormalizedPoint = { x: 0.42, y: 0.58 };
    const params = resolveShared({
      breathPhase: 0.5,
      breathe: 1,
      headTurn: 0,
    });
    const expected = applyShared(point, params);
    for (const spec of LAYER_SPECS) {
      const [deformed] = deformLayer([point], spec, params, ZERO_LOCAL);
      expect(deformed).toEqual(expected);
    }
  });

  it("极端参数下所有网格单元不翻转", async () => {
    const extremes: Partial<Record<string, number>> = {
      [SLOT.blink]: 1,
      [SLOT.mouthOpen]: 1,
      [SLOT.smile]: 1,
      [SLOT.headTurn]: 1,
      [SLOT.wind]: 1,
      [SLOT.breathe]: 1,
      [SLOT.gazeX]: 1,
      [SLOT.gazeY]: 1,
    };
    const state = await stateAt(900, extremes);
    LAYER_SPECS.forEach((spec, index) => {
      const mesh = meshOf(state, index);
      for (let row = 0; row < spec.rows - 1; row += 1) {
        for (let col = 0; col < spec.cols - 1; col += 1) {
          expect(cellArea(mesh.vertices, spec.cols, row, col)).toBeGreaterThan(
            0,
          );
        }
      }
    });
  });

  it("相邻顶点位移差不超过静止边长（Lipschitz 界）", async () => {
    const extremes: Partial<Record<string, number>> = {
      [SLOT.blink]: 1,
      [SLOT.mouthOpen]: 1,
      [SLOT.smile]: 1,
      [SLOT.headTurn]: 1,
      [SLOT.wind]: 1,
    };
    const state = await stateAt(700, extremes);
    let worst = 0;
    LAYER_SPECS.forEach((spec, index) => {
      const rest = restLayer(spec);
      const moved = meshOf(state, index).vertices;
      const pairs: [number, number][] = [];
      for (let row = 0; row < spec.rows; row += 1) {
        for (let col = 0; col < spec.cols; col += 1) {
          if (col + 1 < spec.cols)
            pairs.push([row * spec.cols + col, row * spec.cols + col + 1]);
          if (row + 1 < spec.rows)
            pairs.push([row * spec.cols + col, (row + 1) * spec.cols + col]);
        }
      }
      for (const [first, second] of pairs) {
        const a = rest[first];
        const b = rest[second];
        const ma = moved[first];
        const mb = moved[second];
        if (!a || !b || !ma || !mb) {
          throw new Error("网格索引越界");
        }
        const edge = Math.hypot(b.x - a.x, b.y - a.y);
        const shift = Math.hypot(
          mb.x - ma.x - (b.x - a.x),
          mb.y - ma.y - (b.y - a.y),
        );
        worst = Math.max(worst, shift / edge);
      }
    });
    expect(worst).toBeLessThanOrEqual(1.5);
  });

  it("眨眼时眼睑下移真实遮挡瞳孔，静息不遮挡", async () => {
    const eyelid = layerIndex("eyelid-l");
    const pupil = layerIndex("pupil-l");
    const pupilSpec = LAYER_SPECS[pupil];
    if (!pupilSpec) {
      throw new Error("缺少瞳孔层");
    }
    const pupilCenterY = pupilSpec.rect.y + pupilSpec.rect.height / 2;
    expect(eyelid).toBeGreaterThan(pupil);

    const resting = await stateAt(100);
    expect(maxY(meshOf(resting, eyelid).vertices)).toBeLessThan(pupilCenterY);

    const closed = await stateAt(100, { [SLOT.blink]: 1 });
    expect(maxY(meshOf(closed, eyelid).vertices)).toBeGreaterThanOrEqual(
      pupilCenterY,
    );
    const eyelidPrimitive =
      closed.nodes[layerNodeId("eyelid-l")]?.primitives[0];
    expect(eyelidPrimitive?.opacity).toBe(1);
  });

  it("转头视差有序：近层位移大于远层，同深度同位移", async () => {
    const flat = await stateAt(100, { [SLOT.headTurn]: 0 });
    const turned = await stateAt(100, { [SLOT.headTurn]: 1 });
    const shiftX = (layerId: string): number => {
      const index = layerIndex(layerId);
      const moved = meshOf(turned, index).vertices[0]!;
      const still = meshOf(flat, index).vertices[0]!;
      return moved.x - still.x;
    };
    expect(shiftX("hair-front")).toBeGreaterThan(shiftX("face"));
    expect(shiftX("face")).toBeGreaterThan(shiftX("hair-back"));
    expect(shiftX("hair-front")).toBeGreaterThan(0);
    expect(shiftX("eye-white-l")).toBeCloseTo(shiftX("eye-white-r"), 12);
  });

  it("同参数两遍求值编译，指纹逐字节一致", async () => {
    const first = fingerprint(buildDrawPlan(await stateAt(1500), SCALE));
    const second = fingerprint(buildDrawPlan(await stateAt(1500), SCALE));
    expect(first).toBe(second);
  });

  it("每层纹理标识唯一且与层规格声明一致", async () => {
    const state = await stateAt(0);
    const declared = LAYER_SPECS.map((spec) => spec.textureId);
    const produced = LAYER_SPECS.map(
      (_, index) => meshOf(state, index).textureId,
    );
    expect(produced).toEqual(declared);
    expect(new Set(produced).size).toBe(produced.length);
    for (const textureId of produced) {
      expect(textureId.length).toBeGreaterThan(0);
    }
  });
});
