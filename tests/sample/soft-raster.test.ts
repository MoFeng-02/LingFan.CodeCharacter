import type {
  CharacterState,
  NodeState,
  RenderPrimitive,
  SolidPrimitive,
} from "@lingfan-character/contracts";
import { CHARACTER_COORDINATE_SPACE } from "@lingfan-character/kernel";
import { sampleState } from "@lingfan-character/renderer-soft-raster";
import { describe, expect, it } from "vitest";

/** 单位立方体顶点（局部单位域 −1..1，y 向下、z 朝观察者）。 */
const CUBE: ReadonlyArray<[number, number, number]> = [
  [-1, -1, -1],
  [1, -1, -1],
  [1, 1, -1],
  [-1, 1, -1],
  [-1, -1, 1],
  [1, -1, 1],
  [1, 1, 1],
  [-1, 1, 1],
];

/** 每面一个三角形，顶点按「从外部看逆时针」排列（法线朝外）。 */
const CUBE_FACES: ReadonlyArray<readonly [number, number, number]> = [
  [4, 5, 6],
  [0, 2, 1],
  [5, 2, 6],
  [0, 4, 3],
  [3, 6, 2],
  [0, 1, 5],
];

const IDENTITY = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
const BANDS = [
  { r: 0.95, g: 0.9, b: 0.8, a: 1 },
  { r: 0.6, g: 0.5, b: 0.4, a: 1 },
  { r: 0.25, g: 0.2, b: 0.15, a: 1 },
];

function makeSolid(overrides?: Partial<SolidPrimitive>): SolidPrimitive {
  return {
    kind: "solid3d",
    vertices: CUBE.map(([x, y, z]) => ({ x, y, z })),
    faces: CUBE_FACES.map(([a, b, c]) => ({ a, b, c })),
    shading: BANDS,
    view: { yaw: 0, pitch: 0, roll: 0 },
    ...overrides,
  };
}

function makeState(
  solid: SolidPrimitive,
  extra?: RenderPrimitive[],
): CharacterState {
  const primitives: RenderPrimitive[] = [
    {
      nodeId: "n.head",
      shape: solid,
      transform: IDENTITY,
      tint: BANDS[0]!,
      blend: "normal",
      opacity: 1,
    },
    ...(extra ?? []),
  ];
  const node: NodeState = {
    transform: IDENTITY,
    params: {},
    constraints: [],
    primitives,
  };
  return {
    tMs: 0,
    coordinateSpace: CHARACTER_COORDINATE_SPACE,
    zOrder: ["n.head"],
    nodes: { "n.head": node },
  };
}

/**
 * 3D 采样器：立体几何到 2D 状态向量的纯函数编译。
 * 断言使用手工构造的立方体——每个面的法线与投影坐标都可手算锚定。
 */
describe("3D 采样器", () => {
  it("正对视角只保留朝向观察者的面，投影坐标落在归一化平面", () => {
    const [face] = sampleState(makeState(makeSolid())).nodes["n.head"]!
      .primitives;
    expect(face).toBeDefined();
    const commands = face!.shape.kind === "path" ? face!.shape.commands : [];
    expect(commands).toHaveLength(4);
    // y 翻转：几何 y=−1 在图像平面映射为 1（数学空间向上、图像向下）
    expect(commands[0]).toEqual({ kind: "moveTo", point: { x: 0, y: 1 } });
    expect(commands[1]).toEqual({ kind: "lineTo", point: { x: 1, y: 1 } });
    expect(commands[2]).toEqual({ kind: "lineTo", point: { x: 1, y: 0 } });
    expect(commands[3]).toEqual({ kind: "closePath" });
  });

  it("斜视角剔除背面并按远到近排序", () => {
    const sampled = sampleState(
      makeState(makeSolid({ view: { yaw: 0, pitch: Math.PI / 6, roll: 0 } })),
    );
    const faces = sampled.nodes["n.head"]!.primitives;
    expect(faces).toHaveLength(2);
    const first = faces[0]!;
    const second = faces[1]!;
    expect(first.shape.kind).toBe("path");
    expect(second.shape.kind).toBe("path");
    if (first.shape.kind !== "path" || second.shape.kind !== "path") return;
    const firstY =
      first.shape.commands[0]!.kind === "moveTo"
        ? first.shape.commands[0]!.point.y
        : NaN;
    const secondY =
      second.shape.commands[0]!.kind === "moveTo"
        ? second.shape.commands[0]!.point.y
        : NaN;
    expect(firstY).toBeLessThan(secondY);
  });

  it("面朝向决定色带档位：正对光最亮、偏转取中间档", () => {
    const sampled = sampleState(
      makeState(makeSolid({ view: { yaw: Math.PI / 4, pitch: 0, roll: 0 } })),
    );
    const tints = sampled.nodes["n.head"]!.primitives.map(
      (primitive) => primitive.tint,
    );
    expect(tints).toHaveLength(2);
    expect(tints).toContainEqual(BANDS[0]);
    expect(tints).toContainEqual(BANDS[1]);
  });

  it("非立体基元原样透传", () => {
    const pathPrimitive: RenderPrimitive = {
      nodeId: "n.head",
      shape: {
        kind: "ellipse",
        center: { x: 0.5, y: 0.5 },
        radiusX: 0.2,
        radiusY: 0.2,
      },
      transform: IDENTITY,
      tint: BANDS[0]!,
      blend: "normal",
      opacity: 1,
    };
    const state = makeState(makeSolid(), [pathPrimitive]);
    const sampled = sampleState(state);
    const primitives = sampled.nodes["n.head"]!.primitives;
    expect(primitives).toHaveLength(2);
    expect(primitives[1]).toBe(pathPrimitive);
  });

  it("同一状态两遍采样逐字节一致", () => {
    const state = makeState(
      makeSolid({ view: { yaw: 0.3, pitch: 0.2, roll: 0.1 } }),
    );
    expect(JSON.stringify(sampleState(state))).toBe(
      JSON.stringify(sampleState(state)),
    );
  });

  it("面索引越界与非法色带、顶点不足一律报错", () => {
    const badIndex = makeState(makeSolid({ faces: [{ a: 0, b: 1, c: 99 }] }));
    expect(() => sampleState(badIndex)).toThrow(/超出顶点表/);
    const fewVertices = makeState(
      makeSolid({
        vertices: CUBE.slice(0, 3).map(([x, y, z]) => ({ x, y, z })),
      }),
    );
    expect(() => sampleState(fewVertices)).toThrow(/至少为 4/);
    const fewBands = makeState(makeSolid({ shading: [BANDS[0]!] }));
    expect(() => sampleState(fewBands)).toThrow(/至少为 2/);
  });

  it("采样输出仍是通过契约结构的状态向量", () => {
    const sampled = sampleState(makeState(makeSolid()));
    expect(sampled.coordinateSpace).toBe(CHARACTER_COORDINATE_SPACE);
    expect(sampled.zOrder).toEqual(["n.head"]);
    expect(sampled.nodes["n.head"]!.primitives[0]!.shape.kind).toBe("path");
  });
});
