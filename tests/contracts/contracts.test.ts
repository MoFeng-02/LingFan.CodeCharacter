/**
 * 契约层判据测试：类型可消费性冒烟。
 *
 * 契约层零运行时实现，本文件验证两件事：
 * 一、barrel 导出面完整——消费方按文档可 import 全部契约类型；
 * 二、样例状态与声明可按契约类型构造——类型形状与语义承诺一致。
 */

import { describe, expect, it } from "vitest";
import type {
  AffineTransform,
  CharacterPack,
  CharacterState,
  CurveExpr,
  NodeDeclaration,
  NoiseExpr,
  RenderPrimitive,
  SceneLink,
  SlotDeclaration,
  SubstepPolicy,
} from "@lingfan-character/contracts";

const identity: AffineTransform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

describe("state(t) 状态向量", () => {
  it("可按契约类型构造含渲染基元的完整状态", () => {
    const primitive: RenderPrimitive = {
      nodeId: "humanoid.face.head",
      shape: {
        kind: "ellipse",
        center: { x: 0.5, y: 0.5 },
        radiusX: 0.3,
        radiusY: 0.4,
      },
      transform: identity,
      tint: { r: 0.9, g: 0.8, b: 0.75, a: 1 },
      blend: "normal",
      opacity: 1,
    };
    const state: CharacterState = {
      tMs: 1200,
      coordinateSpace: "layer-local-normalized-v1",
      zOrder: ["humanoid.face.head"],
      nodes: {
        "humanoid.face.head": {
          transform: identity,
          params: { "humanoid.face.turn": 0 },
          constraints: [],
          primitives: [primitive],
        },
      },
    };
    expect(state.tMs).toBe(1200);
    expect(state.nodes["humanoid.face.head"]?.primitives).toHaveLength(1);
  });

  it("约束报告记录请求值与钳制后应用值", () => {
    const state: CharacterState = {
      tMs: 0,
      coordinateSpace: "layer-local-normalized-v1",
      zOrder: [],
      nodes: {
        n: {
          transform: identity,
          params: {},
          constraints: [
            {
              nodeId: "n",
              slot: "humanoid.face.turn",
              requested: 2,
              applied: 1,
              clamped: true,
            },
          ],
          primitives: [],
        },
      },
    };
    expect(state.nodes["n"]?.constraints[0]?.clamped).toBe(true);
  });
});

describe("曲线与噪声原语", () => {
  it("曲线表达式支持缓动、组合、时移与循环", () => {
    const breath: CurveExpr = {
      kind: "cycle",
      periodMs: 4000,
      base: {
        kind: "easing",
        fromMs: 0,
        toMs: 2000,
        fromValue: 0,
        toValue: 1,
        easing: "smoothstep",
      },
    };
    const combined: CurveExpr = {
      kind: "sum",
      parts: [
        { kind: "constant", value: 0.5 },
        { kind: "scale", factor: 0.1, base: breath },
        {
          kind: "timeShift",
          offsetMs: 500,
          base: { kind: "constant", value: 0 },
        },
      ],
    };
    expect(combined.parts).toHaveLength(3);
  });

  it("噪声声明包含倍频程与频率倍率", () => {
    const noise: NoiseExpr = {
      octaves: 3,
      frequency: 0.001,
      lacunarity: 2,
      gain: 0.5,
    };
    expect(noise.octaves).toBe(3);
  });
});

describe("域包端口与场景联动", () => {
  it("域包端口可声明槽位、节点、子步进与验证断言", () => {
    const substep: SubstepPolicy = { kind: "fixed", count: 1 };
    const slot: SlotDeclaration = {
      name: "humanoid.face.turn",
      direction: "input",
      defaultValue: 0,
      range: { min: -1, max: 1 },
    };
    const node: NodeDeclaration = {
      id: "humanoid.face.head",
      reads: ["humanoid.face.turn"],
      writes: ["humanoid.face.head.pose"],
      step: (inputs, tMs) => ({
        values: {
          "humanoid.face.head.pose":
            (inputs.values["humanoid.face.turn"] ?? 0) * tMs,
        },
      }),
    };
    const pack: CharacterPack = {
      declaration: {
        id: "humanoid",
        version: "0.1.0",
        families: ["face", "hair"],
      },
      slots: [slot],
      nodes: [node],
      edges: [{ from: "humanoid.face.turn", to: "humanoid.face.head.pose" }],
      validations: [],
      substep,
    };
    expect(pack.slots[0]?.name).toBe("humanoid.face.turn");
    expect(
      pack.nodes[0]?.step({ values: {} }, 1000, { next: () => 0, seed: 1 })
        .values,
    ).toEqual({
      "humanoid.face.head.pose": 0,
    });
  });

  it("场景联动声明出向与入向槽位", () => {
    const link: SceneLink = {
      outbound: { slots: ["humanoid.face.head.pose"] },
      inbound: { slots: ["humanoid.light.direction"] },
    };
    expect(link.inbound.slots).toContain("humanoid.light.direction");
  });
});
