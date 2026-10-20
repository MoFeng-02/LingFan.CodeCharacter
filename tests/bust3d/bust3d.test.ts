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

function solidOf(state: CharacterState, index: number): SolidPrimitive {
  const head = state.nodes["appearance.head"];
  if (!head) throw new Error("立体节点缺失");
  const solid = head.primitives[index]?.shape;
  if (!solid || solid.kind !== "solid3d") throw new Error("立体基元缺失");
  return solid;
}

describe("bust3d 配方", () => {
  it("求值产出头骨与发壳两个立体基元，网格完备且发壳有剔除", async () => {
    const runtime = createCharacterRuntime(bust3dPack);
    const state = await runtime.computeAt(0);
    const skull = solidOf(state, 0);
    const hair = solidOf(state, 1);
    // 12×16 细分：顶点 = 两极 + 11 环 × 16，面 = 双帽 + 10 环带 × 2
    expect(skull.vertices.length).toBe(1 + 11 * 16 + 1);
    expect(skull.faces.length).toBe(2 * 16 + 10 * 16 * 2);
    expect(hair.vertices.length).toBeGreaterThan(10);
    // 完整壳面数 = 6 环带 × 16 × 2 + 16 帽；发际线剔除后必然变少但不为空
    expect(hair.faces.length).toBeGreaterThan(0);
    expect(hair.faces.length).toBeLessThan(6 * 16 * 2 + 16);
    for (const solid of [skull, hair]) {
      for (const face of solid.faces) {
        expect(face.a).toBeLessThan(solid.vertices.length);
        expect(face.b).toBeLessThan(solid.vertices.length);
        expect(face.c).toBeLessThan(solid.vertices.length);
      }
    }
  });

  it("五官形变把脸前顶点推出椭球半径", async () => {
    const runtime = createCharacterRuntime(bust3dPack);
    const state = await runtime.computeAt(0, { [SLOT.breath]: 0 });
    const skull = solidOf(state, 0);
    const maxZ = Math.max(...skull.vertices.map((v) => v.z));
    expect(maxZ).toBeGreaterThan(0.75);
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
    expect(spread(solidOf(full, 0).vertices)).toBeGreaterThan(
      spread(solidOf(rest, 0).vertices),
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
