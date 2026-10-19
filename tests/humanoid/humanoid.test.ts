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
import { NODE_ID, SLOT, humanoidPack } from "@lingfan-character/pack-humanoid";
import { describe, expect, it } from "vitest";

/**
 * 脸部基元数组序（与 appearance/face.ts 实现一致）：
 * 0 脸基形、1 鼻影、（2 眼白、3 瞳、4 眉、5 腮红）×左右、10 嘴。
 */
const BLUSH_LEFT = 5;

const facePrimitives = (state: CharacterState): readonly RenderPrimitive[] =>
  state.nodes[NODE_ID.face].primitives;

describe("humanoid 域包", () => {
  it("编译通过：槽位、写集合与拓扑全部合法", () => {
    expect(() => compile(humanoidPack)).not.toThrow();
  });

  it("输入槽缺省值全部落在声明范围内", () => {
    for (const slot of humanoidPack.slots) {
      if (slot.direction !== "input") continue;
      expect(slot.defaultValue).toBeDefined();
      expect(slot.range).toBeDefined();
      expect(slot.defaultValue).toBeGreaterThanOrEqual(slot.range.min);
      expect(slot.defaultValue).toBeLessThanOrEqual(slot.range.max);
    }
  });

  it("稳态求值：绘制序以四层外观收尾并携带坐标系标识", async () => {
    const runtime = createCharacterRuntime(humanoidPack);
    const state = await runtime.computeAt(0);
    expect(state.coordinateSpace).toBe(CHARACTER_COORDINATE_SPACE);
    expect(state.zOrder.slice(-4)).toEqual([
      NODE_ID.hairBack,
      NODE_ID.face,
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

  it("眨眼节律：静息全开、周期 60% 处闭峰", async () => {
    const runtime = createCharacterRuntime(humanoidPack);
    const eyeRadiusY = async (t: number): Promise<number> => {
      const prim = facePrimitives(await runtime.computeAt(t))[2];
      return prim.shape.kind === "ellipse" ? prim.shape.radiusY : Number.NaN;
    };
    const openY = await eyeRadiusY(0);
    const closedY = await eyeRadiusY(2220);
    expect(openY).toBeCloseTo(0.02, 6);
    expect(closedY).toBeLessThan(openY / 5);
  });

  it("微笑耦合链：腮红浮现且颧升上提", async () => {
    const runtime = createCharacterRuntime(humanoidPack);
    const neutral = facePrimitives(
      await runtime.computeAt(0, { [SLOT.smile]: 0 }),
    );
    const smiling = facePrimitives(
      await runtime.computeAt(0, { [SLOT.smile]: 1 }),
    );
    expect(smiling[BLUSH_LEFT].opacity).toBeCloseTo(0.4, 6);
    expect(neutral[BLUSH_LEFT].opacity).toBe(0);
    expect(smiling[BLUSH_LEFT].transform.f).toBeLessThan(
      neutral[BLUSH_LEFT].transform.f,
    );
  });

  it("呼吸：胸腔缩放随呼吸波形起伏且归零后复原", async () => {
    const runtime = createCharacterRuntime(humanoidPack);
    const scaleY = async (breath: number): Promise<number> =>
      facePrimitives(await runtime.computeAt(0, { [SLOT.breath]: breath }))[0]
        .transform.d;
    expect(await scaleY(0)).toBeCloseTo(0.994, 12);
    expect(await scaleY(1)).toBeGreaterThan(1);
  });

  it("发摆：正负摆动产生可辨的发帘平移差", async () => {
    const runtime = createCharacterRuntime(humanoidPack);
    const bangsE = async (swing: number): Promise<number> =>
      (await runtime.computeAt(0, { [SLOT.swing]: swing })).nodes[
        NODE_ID.hairFront
      ].primitives[0].transform.e;
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

    const face = state.nodes[NODE_ID.face];
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

    const hairFront = state.nodes[NODE_ID.hairFront];
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
});
