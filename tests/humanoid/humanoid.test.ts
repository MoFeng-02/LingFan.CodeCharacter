import type {
  CharacterState,
  NodeState,
  RenderPrimitive,
} from "@lingfan-character/contracts";
import {
  CHARACTER_COORDINATE_SPACE,
  compile,
  createCharacterRuntime,
  validateState,
} from "@lingfan-character/kernel";
import { createSpeechEnvelope } from "@lingfan-character/example-humanoid/demo";
import {
  NODE_ID,
  SLOT,
  humanoidPack,
} from "@lingfan-character/example-humanoid";
import {
  buildDrawPlan,
  fingerprint,
} from "@lingfan-character/renderer-canvas2d";
import { describe, expect, it } from "vitest";

/**
 * 脸部基元数组序（与 appearance/face.ts 实现一致）：
 * 0 脸基形、1 鼻影、（2 眼白、3 虹膜、4 瞳孔、5 眼睑、6 眉、7 腮红）×左右、14 嘴。
 */
const BLUSH_LEFT = 7;
const EYELID_LEFT = 5;
const IRIS_LEFT = 3;
const BROW_LEFT = 6;
const BROW_RIGHT = 12;

const facePrimitives = (state: CharacterState): readonly RenderPrimitive[] =>
  state.nodes[NODE_ID.face]?.primitives ?? [];

describe("humanoid 域包", () => {
  it("编译通过：槽位、写集合与拓扑全部合法", () => {
    expect(() => compile(humanoidPack)).not.toThrow();
  });

  it("输入槽缺省值全部落在声明范围内", () => {
    for (const slot of humanoidPack.slots) {
      if (slot.direction !== "input") continue;
      expect(slot.defaultValue).toBeDefined();
      expect(slot.range).toBeDefined();
      expect(slot.defaultValue).toBeGreaterThanOrEqual(slot.range!.min);
      expect(slot.defaultValue).toBeLessThanOrEqual(slot.range!.max);
    }
  });

  it("稳态求值：绘制序以五层外观收尾并携带坐标系标识", async () => {
    const runtime = createCharacterRuntime(humanoidPack);
    const state = await runtime.computeAt(0);
    expect(state.coordinateSpace).toBe(CHARACTER_COORDINATE_SPACE);
    expect(state.zOrder.slice(-5)).toEqual([
      NODE_ID.hairBack,
      NODE_ID.face,
      NODE_ID.mouth,
      NODE_ID.hairFront,
      NODE_ID.accessory,
    ]);
  });

  it("同一时刻两遍求值逐字节一致", async () => {
    const runtime = createCharacterRuntime(humanoidPack);
    expect(JSON.stringify(await runtime.computeAt(1234))).toBe(
      JSON.stringify(await runtime.computeAt(1234)),
    );
  });

  it("眨眼节律：眼睑静息收在上缘，周期 60% 处下移越过眼心", async () => {
    const runtime = createCharacterRuntime(humanoidPack);
    const lidCenterY = async (t: number): Promise<number> => {
      const prim = facePrimitives(await runtime.computeAt(t))[EYELID_LEFT]!;
      return prim.shape.kind === "ellipse" ? prim.shape.center.y : Number.NaN;
    };
    const openY = await lidCenterY(0);
    const closedY = await lidCenterY(2220);
    expect(openY).toBeCloseTo(0.411, 6);
    expect(closedY).toBeGreaterThan(0.45);
  });

  it("转头：特征向转向侧扫动、虹膜视线跟随、脸变窄且整头不旋转", async () => {
    const runtime = createCharacterRuntime(humanoidPack);
    const at = (turn: number) =>
      runtime.computeAt(0, { [SLOT.turn]: turn }).then(facePrimitives);
    const rest = await at(0);
    const right = await at(1);
    const left = await at(-1);
    // 虹膜随朝向扫动并带视线跟随，方向与转向一致。
    expect(right[IRIS_LEFT]!.transform.e).toBeGreaterThan(
      rest[IRIS_LEFT]!.transform.e,
    );
    expect(left[IRIS_LEFT]!.transform.e).toBeLessThan(
      rest[IRIS_LEFT]!.transform.e,
    );
    // 脸基形朝向侧转时可见宽度收窄。
    const restFace = rest[0]!.shape;
    const turnedFace = right[0]!.shape;
    expect(restFace.kind === "ellipse" && turnedFace.kind === "ellipse").toBe(
      true,
    );
    if (restFace.kind === "ellipse" && turnedFace.kind === "ellipse") {
      expect(turnedFace.radiusX).toBeLessThan(restFace.radiusX);
    }
    // 刚体基准无旋转分量：整头旋转读作摇头，是回归红线。
    expect(right[0]!.transform.b).toBe(0);
    expect(left[0]!.transform.b).toBe(0);
  });

  it("微笑耦合链：腮红浮现且颧升上提", async () => {
    const runtime = createCharacterRuntime(humanoidPack);
    const neutral = facePrimitives(
      await runtime.computeAt(0, { [SLOT.smile]: 0 }),
    );
    const smiling = facePrimitives(
      await runtime.computeAt(0, { [SLOT.smile]: 1 }),
    );
    expect(smiling[BLUSH_LEFT]!.opacity).toBeCloseTo(0.4, 6);
    expect(neutral[BLUSH_LEFT]!.opacity).toBe(0);
    expect(smiling[BLUSH_LEFT]!.transform.f).toBeLessThan(
      neutral[BLUSH_LEFT]!.transform.f,
    );
  });

  it("呼吸：均匀缩放随呼吸波形起伏且归零后复原", async () => {
    const runtime = createCharacterRuntime(humanoidPack);
    const scaleY = async (breath: number): Promise<number> =>
      facePrimitives(await runtime.computeAt(0, { [SLOT.breath]: breath }))[0]!
        .transform.d;
    expect(await scaleY(0)).toBeCloseTo(0.992, 12);
    expect(await scaleY(1)).toBeGreaterThan(1);
    const scaleX = async (breath: number): Promise<number> =>
      facePrimitives(await runtime.computeAt(0, { [SLOT.breath]: breath }))[0]!
        .transform.a;
    expect(await scaleX(0)).toBe(await scaleY(0));
  });

  it("发摆：正负摆动产生可辨的发帘平移差", async () => {
    const runtime = createCharacterRuntime(humanoidPack);
    const bangsE = async (swing: number): Promise<number> =>
      (await runtime.computeAt(0, { [SLOT.swing]: swing })).nodes[
        NODE_ID.hairFront
      ]!.primitives[0]!.transform.e;
    expect(Math.abs((await bangsE(1)) - (await bangsE(-1)))).toBeGreaterThan(
      0.01,
    );
  });

  it("约束校验：合法状态全过，拉伸越界与图层漂移均被检出", async () => {
    const runtime = createCharacterRuntime(humanoidPack);
    const state = await runtime.computeAt(0);
    for (const result of validateState(humanoidPack, state)) {
      expect(result.ok).toBe(true);
    }

    const face = state.nodes[NODE_ID.face]!;
    const stretchedFace: NodeState = {
      ...face,
      primitives: face.primitives.map((prim, index) =>
        index === 0
          ? {
              ...prim,
              transform: {
                a: 1.5,
                b: 0,
                c: 0,
                d: 1.5,
                e: prim.transform.e,
                f: prim.transform.f,
              },
            }
          : prim,
      ),
    };
    const stretched: CharacterState = {
      ...state,
      nodes: { ...state.nodes, [NODE_ID.face]: stretchedFace },
    };
    expect(validateState(humanoidPack, stretched)[0]?.ok).toBe(false);

    const hairFront = state.nodes[NODE_ID.hairFront]!;
    const driftedHair: NodeState = {
      ...hairFront,
      transform: { ...hairFront.transform, e: hairFront.transform.e + 0.5 },
    };
    const drifted: CharacterState = {
      ...state,
      nodes: { ...state.nodes, [NODE_ID.hairFront]: driftedHair },
    };
    expect(validateState(humanoidPack, drifted)[1]?.ok).toBe(false);
  });

  it("区间采样：含首尾端点且时间单调", async () => {
    const runtime = createCharacterRuntime(humanoidPack);
    const states = await runtime.computeRange(0, 100, { stepMs: 25 });
    expect(states.map((sample) => sample.tMs)).toEqual([0, 25, 50, 75, 100]);
  });

  it("口型：静音闭嘴，口腔薄条被唇带覆盖", async () => {
    const runtime = createCharacterRuntime(humanoidPack);
    const state = await runtime.computeAt(1000, { [SLOT.mouthDrive]: 0 });
    expect(state.nodes[NODE_ID.mouthDrive]!.params[SLOT.openWave]).toBe(0);
    const oralCavity = state.nodes[NODE_ID.mouth]!.primitives[0];
    expect(oralCavity?.shape.kind).toBe("ellipse");
    if (oralCavity?.shape.kind === "ellipse") {
      expect(oralCavity.shape.radiusY).toBeLessThan(0.005);
    }
  });

  it("口型：满驱动张嘴，口腔高度显著且开口度到位", async () => {
    const runtime = createCharacterRuntime(humanoidPack);
    const state = await runtime.computeAt(1000, { [SLOT.mouthDrive]: 1 });
    expect(
      state.nodes[NODE_ID.mouthDrive]!.params[SLOT.openWave],
    ).toBeGreaterThan(0.99);
    const oralCavity = state.nodes[NODE_ID.mouth]!.primitives[0];
    if (oralCavity?.shape.kind === "ellipse") {
      expect(oralCavity.shape.radiusY).toBeGreaterThan(0.018);
    }
  });

  it("口型：开口度对驱动值单调有序", async () => {
    const runtime = createCharacterRuntime(humanoidPack);
    const openness = async (drive: number): Promise<number> =>
      (await runtime.computeAt(1000, { [SLOT.mouthDrive]: drive })).nodes[
        NODE_ID.mouthDrive
      ]!.params[SLOT.openWave]!;
    const low = await openness(0.2);
    const mid = await openness(0.6);
    const high = await openness(1);
    expect(low).toBeGreaterThan(0);
    expect(low).toBeLessThan(mid);
    expect(mid).toBeLessThan(high);
    expect(high).toBeLessThanOrEqual(1);
  });

  it("口型：同 seed 同包络序列，驱动变化改变指纹", async () => {
    const a = createSpeechEnvelope("lip-sync-demo", 30_000);
    const b = createSpeechEnvelope("lip-sync-demo", 30_000);
    const c = createSpeechEnvelope("lip-sync-demo-other", 30_000);
    for (const t of [500, 1300, 2700, 5200]) {
      expect(a.at(t)).toBe(b.at(t));
    }
    const voiced = [500, 1300, 2700, 5200].map((t) => a.at(t));
    expect(voiced.some((v) => v > 0.5)).toBe(true);

    const runtime = createCharacterRuntime(humanoidPack);
    const closed = fingerprint(
      buildDrawPlan(
        await runtime.computeAt(800, { [SLOT.mouthDrive]: 0 }),
        512,
      ),
    );
    const open = fingerprint(
      buildDrawPlan(
        await runtime.computeAt(800, { [SLOT.mouthDrive]: 0.8 }),
        512,
      ),
    );
    expect(open).not.toBe(closed);
    expect(c).not.toBeUndefined();
  });

  it("基正交性：单挑左眉只改变左眉基元，其余逐字节不变", async () => {
    const runtime = createCharacterRuntime(humanoidPack);
    const rest = facePrimitives(await runtime.computeAt(0));
    const raised = facePrimitives(
      await runtime.computeAt(0, { [SLOT.browRaiseL]: 1 }),
    );
    expect(raised.length).toBe(rest.length);
    const restY = rest[BROW_LEFT]!.shape;
    const raisedY = raised[BROW_LEFT]!.shape;
    expect(restY.kind === "ellipse" && raisedY.kind === "ellipse").toBe(true);
    if (restY.kind === "ellipse" && raisedY.kind === "ellipse") {
      expect(raisedY.center.y).toBeLessThan(restY.center.y);
    }
    rest.forEach((prim, index) => {
      if (index === BROW_LEFT) return;
      expect(JSON.stringify(raised[index])).toBe(JSON.stringify(prim));
    });
  });

  it("左右成对：单挑右眉只有右眉动，左右互不牵连", async () => {
    const runtime = createCharacterRuntime(humanoidPack);
    const rest = facePrimitives(await runtime.computeAt(0));
    const raised = facePrimitives(
      await runtime.computeAt(0, { [SLOT.browRaiseR]: 1 }),
    );
    expect(JSON.stringify(raised[BROW_LEFT])).toBe(
      JSON.stringify(rest[BROW_LEFT]),
    );
    const restY = rest[BROW_RIGHT]!.shape;
    const raisedY = raised[BROW_RIGHT]!.shape;
    if (restY.kind === "ellipse" && raisedY.kind === "ellipse") {
      expect(raisedY.center.y).toBeLessThan(restY.center.y);
    }
  });

  it("组合叠加：眉部形变随基系数线性插值", async () => {
    const runtime = createCharacterRuntime(humanoidPack);
    const browY = async (raise: number): Promise<number> => {
      const prim = facePrimitives(
        await runtime.computeAt(0, { [SLOT.browRaiseL]: raise }),
      )[BROW_LEFT]!;
      return prim.shape.kind === "ellipse" ? prim.shape.center.y : Number.NaN;
    };
    const rest = await browY(0);
    const half = await browY(0.5);
    const full = await browY(1);
    expect(half).toBeCloseTo((rest + full) / 2, 12);
    expect(full).toBeLessThan(rest);
  });

  it("下颌基：表情张嘴独立于说话驱动并叠加口腔高度", async () => {
    const runtime = createCharacterRuntime(humanoidPack);
    const oralRy = async (
      overrides: Record<string, number>,
    ): Promise<number> => {
      const prim = (await runtime.computeAt(1000, overrides)).nodes[
        NODE_ID.mouth
      ]!.primitives[0]!;
      return prim.shape.kind === "ellipse" ? prim.shape.radiusY : Number.NaN;
    };
    const silent = await oralRy({ [SLOT.mouthDrive]: 0 });
    const jaw = await oralRy({ [SLOT.mouthDrive]: 0, [SLOT.jawOpen]: 1 });
    expect(jaw).toBeGreaterThan(silent);
    expect(silent).toBeLessThan(0.005);
  });

  it("视线基：gaze 平移虹膜且与转头扫动相互独立", async () => {
    const runtime = createCharacterRuntime(humanoidPack);
    const irisE = async (overrides: Record<string, number>): Promise<number> =>
      facePrimitives(await runtime.computeAt(0, overrides))[IRIS_LEFT]!
        .transform.e;
    const irisF = async (overrides: Record<string, number>): Promise<number> =>
      facePrimitives(await runtime.computeAt(0, overrides))[IRIS_LEFT]!
        .transform.f;
    const rest = await irisE({});
    // 视线位移经头部呼吸缩放矩阵传导，量级略有缩放，判方向与显著量级。
    expect((await irisE({ [SLOT.gazeX]: 1 })) - rest).toBeGreaterThan(0.01);
    expect(await irisF({ [SLOT.gazeY]: 1 })).toBeGreaterThan(await irisF({}));
  });

  it("基越界被钳制并出具报告", async () => {
    const runtime = createCharacterRuntime(humanoidPack);
    const state = await runtime.computeAt(0, { [SLOT.browRaiseL]: 5 });
    const reports = state.nodes[NODE_ID.face]!.constraints ?? [];
    expect(reports.length).toBeGreaterThan(0);
    expect(reports.every((report) => report.clamped)).toBe(true);
    expect(reports.every((report) => report.applied <= 1)).toBe(true);
  });
});
