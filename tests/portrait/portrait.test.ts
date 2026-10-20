import type { CharacterState } from "@lingfan-character/contracts";
import { createCharacterRuntime } from "@lingfan-character/kernel";
import {
  buildDrawPlan,
  draw,
  fingerprint,
  type DrawingContext,
  type DrawPlan,
} from "@lingfan-character/renderer-canvas2d";
import { SLOT, portraitPack } from "@lingfan-character/example-portrait";
import { describe, expect, it } from "vitest";

/**
 * 素材轨配方判据：网格顶点是输入的纯函数，指纹与程序配方同一套机器。
 * 位图本体不进状态向量——渲染端纹理解析的缺失语义也在此验收。
 */

const SCALE = 512;

/** 记录式画布替身：验证执行层的单元贴图行为。 */
class Probe implements DrawingContext {
  readonly drawnImages: string[] = [];
  globalCompositeOperation = "";
  globalAlpha = 1;
  fillStyle = "";
  setTransform(): void {}
  beginPath(): void {}
  moveTo(): void {}
  lineTo(): void {}
  bezierCurveTo(): void {}
  closePath(): void {}
  ellipse(): void {}
  fill(): void {}
  clip(): void {}
  save(): void {}
  restore(): void {}
  transform(): void {}
  rect(): void {}
  drawImage(
    _image: CanvasImageSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void {
    this.drawnImages.push(`${sx},${sy},${sw},${sh} -> ${dx},${dy},${dw},${dh}`);
  }
}

function meshOf(plan: DrawPlan) {
  const shape = plan.commands[0]?.shape;
  if (!shape || shape.kind !== "mesh") {
    throw new Error("素材配方的绘制计划应以网格指令开头");
  }
  return shape;
}

async function stateAt(
  t: number,
  overrides?: Partial<Record<string, number>>,
): Promise<CharacterState> {
  const runtime = createCharacterRuntime(portraitPack);
  return runtime.computeAt(t, overrides);
}

describe("素材轨 portrait 配方", () => {
  it("同参数两遍求值编译，指纹逐字节一致", async () => {
    const first = fingerprint(buildDrawPlan(await stateAt(1234), SCALE));
    const second = fingerprint(buildDrawPlan(await stateAt(1234), SCALE));
    expect(first).toBe(second);
  });

  it("网格指令携带宿主纹理标识与全量顶点", async () => {
    const mesh = meshOf(buildDrawPlan(await stateAt(0), SCALE));
    expect(mesh.textureId).toBe("portrait-primary");
    expect(mesh.vertices.length).toBe(mesh.cols * mesh.rows);
    expect(mesh.cols).toBeGreaterThan(1);
    expect(mesh.rows).toBeGreaterThan(1);
  });

  it("眨眼驱动眼区顶点位移", async () => {
    const rest = meshOf(buildDrawPlan(await stateAt(100), SCALE)).vertices;
    const closed = meshOf(
      buildDrawPlan(await stateAt(100, { [SLOT.blink]: 1 }), SCALE),
    ).vertices;
    expect(closed).not.toEqual(rest);
  });

  it("朝向驱动水平视差", async () => {
    const center = meshOf(buildDrawPlan(await stateAt(100), SCALE)).vertices;
    const turned = meshOf(
      buildDrawPlan(await stateAt(100, { [SLOT.headTurn]: 1 }), SCALE),
    ).vertices;
    expect(turned[24]?.[0]).toBeGreaterThan(center[24]?.[0] ?? 0);
  });

  it("呼吸节律随时间变化且按周期回归", async () => {
    const at0 = meshOf(buildDrawPlan(await stateAt(0), SCALE)).vertices;
    const atHalf = meshOf(buildDrawPlan(await stateAt(2100), SCALE)).vertices;
    const atCycle = meshOf(buildDrawPlan(await stateAt(4200), SCALE)).vertices;
    expect(atHalf).not.toEqual(at0);
    expect(atCycle).toEqual(at0);
  });

  it("纹理解析缺失时执行层报错而非静默", async () => {
    const plan = buildDrawPlan(await stateAt(0), SCALE);
    expect(() => draw(new Probe(), plan)).toThrow();
  });

  it("提供纹理解析后逐单元贴图", async () => {
    const plan = buildDrawPlan(await stateAt(0), SCALE);
    const mesh = meshOf(plan);
    const probe = new Probe();
    draw(probe, plan, () => ({
      image: {} as CanvasImageSource,
      width: 320,
      height: 480,
    }));
    expect(probe.drawnImages.length).toBe((mesh.cols - 1) * (mesh.rows - 1));
  });
});
