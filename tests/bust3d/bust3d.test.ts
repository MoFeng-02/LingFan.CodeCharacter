import type {
  CharacterState,
  SolidPrimitive,
} from "@lingfan-character/contracts";
import { createCharacterRuntime } from "@lingfan-character/kernel";
import { sampleState } from "@lingfan-character/renderer-soft-raster";
import { bust3dPack, SLOT } from "@lingfan-character/example-bust3d";
import { describe, expect, it } from "vitest";

/**
 * 立体半身像配方判据：核心主张是「转头出真实侧脸」——视角变化重采样
 * 同一几何得到不同 2D 轮廓，而非平面拉伸。
 */

function solidOf(state: CharacterState): SolidPrimitive {
  const head = state.nodes["appearance.head"];
  if (!head) throw new Error("头骨节点缺失");
  const solid = head.primitives[0]?.shape;
  if (!solid || solid.kind !== "solid3d") throw new Error("立体基元缺失");
  return solid;
}

describe("bust3d 配方", () => {
  it("求值产出一个立体几何基元，几何顶点表与面索引完备", async () => {
    const runtime = createCharacterRuntime(bust3dPack);
    const state = await runtime.computeAt(0);
    const solid = solidOf(state);
    expect(solid.vertices.length).toBeGreaterThan(10);
    expect(solid.faces.length).toBeGreaterThan(10);
    for (const face of solid.faces) {
      expect(face.a).toBeLessThan(solid.vertices.length);
      expect(face.b).toBeLessThan(solid.vertices.length);
      expect(face.c).toBeLessThan(solid.vertices.length);
    }
  });

  it("转头改变采样视角：同一几何投影出不同的 2D 轮廓", async () => {
    const runtime = createCharacterRuntime(bust3dPack);
    const front = await runtime.computeAt(0, { [SLOT.headTurn]: 0 });
    const side = await runtime.computeAt(0, { [SLOT.headTurn]: 1 });
    const frontPlan = JSON.stringify(sampleState(front));
    const sidePlan = JSON.stringify(sampleState(side));
    expect(frontPlan).not.toBe(sidePlan);
  });

  it("呼吸等比缩放几何半径", async () => {
    const runtime = createCharacterRuntime(bust3dPack);
    const rest = await runtime.computeAt(0, { [SLOT.breath]: 0 });
    const full = await runtime.computeAt(0, { [SLOT.breath]: 1 });
    const spread = (vertices: readonly { x: number }[]): number =>
      Math.max(...vertices.map((v) => Math.abs(v.x)));
    expect(spread(solidOf(full).vertices)).toBeGreaterThan(
      spread(solidOf(rest).vertices),
    );
  });

  it("同参数两遍采样逐字节一致", async () => {
    const runtime = createCharacterRuntime(bust3dPack);
    const a = sampleState(
      await runtime.computeAt(120, { [SLOT.headTurn]: 0.6 }),
    );
    const b = sampleState(
      await runtime.computeAt(120, { [SLOT.headTurn]: 0.6 }),
    );
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("参数越界被钳制并留报告", async () => {
    const runtime = createCharacterRuntime(bust3dPack);
    const state = await runtime.computeAt(0, { [SLOT.headTurn]: 5 });
    const reports = Object.values(state.nodes).flatMap(
      (node) => node.constraints,
    );
    expect(reports.some((report) => report.clamped)).toBe(true);
  });
});
