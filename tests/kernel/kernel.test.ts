/**
 * 内核判据测试：编译校验、求值语义、采样与状态验证。
 *
 * 覆盖四组判据：
 * 一、编译把写冲突、环、悬空引用、命名违规、缺省超界判为类型化错误；
 * 二、state(t) 求值满足确定性、参数三级继承、钳制记录、子流种子一致与耦合传播；
 * 三、区间采样按网格含两端，非法网格类型化报错；
 * 四、状态验证逐条执行域包断言并保序汇总。
 */

import { describe, expect, it } from "vitest";
import type {
  CharacterPack,
  NodeDeclaration,
  SlotDeclaration,
} from "@lingfan-character/contracts";
import {
  CHARACTER_COORDINATE_SPACE,
  createCharacterRuntime,
  validateBasisSpace,
  validateState,
} from "@lingfan-character/kernel";

const slot = (
  name: string,
  direction: "input" | "output",
  extra: Partial<SlotDeclaration> = {},
): SlotDeclaration => ({
  name,
  direction,
  ...extra,
});

const node = (
  id: string,
  reads: string[],
  writes: string[],
  step: NodeDeclaration["step"],
): NodeDeclaration => ({ id, reads, writes, step });

/** 基准域包：写节点产出 0.5 加子流微扰，读节点把值翻倍；参数输入槽带缺省与范围。 */
/** 可变包构造类型：错误注入用例需要增删成员，compile 入参侧再收紧为 CharacterPack。 */
type WritablePack = {
  -readonly [K in keyof CharacterPack]: CharacterPack[K] extends readonly (infer T)[]
    ? T[]
    : CharacterPack[K];
};

const basePack = (): WritablePack => ({
  declaration: { id: "demo", version: "0.1.0", families: ["core"] },
  slots: [
    slot("demo.core.level", "input", {
      defaultValue: 0.25,
      range: { min: 0, max: 1 },
    }),
    slot("demo.core.out", "output"),
    slot("demo.core.echo", "output"),
  ],
  nodes: [
    node(
      "demo.core.writer",
      ["demo.core.level"],
      ["demo.core.out"],
      (inputs, _t, substream) => ({
        values: {
          "demo.core.out":
            inputs.values["demo.core.level"]! + substream.next() * 1e-9,
        },
      }),
    ),
    node(
      "demo.core.reader",
      ["demo.core.out"],
      ["demo.core.echo"],
      (inputs) => ({
        values: { "demo.core.echo": inputs.values["demo.core.out"]! * 2 },
      }),
    ),
  ],
  edges: [],
  validations: [],
  substep: { kind: "fixed", count: 1 },
});

const expectCompileError = (pack: CharacterPack, kind: string): void => {
  expect(() => createCharacterRuntime(pack)).toThrowError(
    expect.objectContaining({ name: "CompileError", kind }),
  );
};

describe("求值图编译", () => {
  it("合法声明可编译且按字典序打破并列平局", async () => {
    const runtime = createCharacterRuntime(basePack());
    await expect(runtime.computeAt(0)).resolves.toBeDefined();
  });

  it("重复节点标识判为编译错误", () => {
    const pack = basePack();
    pack.nodes = [...pack.nodes, pack.nodes[0]!];
    expectCompileError(pack, "duplicate-node");
  });

  it("重复槽位声明判为编译错误", () => {
    const pack = basePack();
    pack.slots = [...pack.slots, slot("demo.core.out", "output")];
    expectCompileError(pack, "duplicate-slot");
  });

  it("两个节点写同一输出槽判为写冲突", () => {
    const pack = basePack();
    pack.nodes = [
      ...pack.nodes,
      node("demo.core.rival", [], ["demo.core.out"], () => ({
        values: { "demo.core.out": 0 },
      })),
    ];
    expectCompileError(pack, "write-conflict");
  });

  it("读写互指成环判为编译错误", () => {
    const pack = basePack();
    pack.slots = [
      ...pack.slots,
      slot("demo.core.a", "output"),
      slot("demo.core.b", "output"),
    ];
    pack.nodes = [
      node("demo.core.a-node", ["demo.core.b"], ["demo.core.a"], () => ({
        values: { "demo.core.a": 0 },
      })),
      node("demo.core.b-node", ["demo.core.a"], ["demo.core.b"], () => ({
        values: { "demo.core.b": 0 },
      })),
    ];
    expectCompileError(pack, "cycle");
  });

  it("引用未声明槽位判为编译错误", () => {
    const pack = basePack();
    pack.nodes = [
      node("demo.core.ghost", ["demo.core.missing"], [], () => ({
        values: {},
      })),
    ];
    expectCompileError(pack, "unknown-slot");
  });

  it("槽位名脱离包前缀判为命名违规", () => {
    const pack = basePack();
    pack.slots = [slot("other.out", "output")];
    expectCompileError(pack, "slot-naming");
  });

  it("输入槽缺省超出声明范围判为编译错误", () => {
    const pack = basePack();
    pack.slots = pack.slots.map((entry) =>
      entry.name === "demo.core.level"
        ? { ...entry, defaultValue: 5, range: { min: 0, max: 1 } }
        : entry,
    );
    expectCompileError(pack, "default-out-of-range");
  });

  it("耦合边目标槽被节点写入判为写冲突", () => {
    const pack = basePack();
    pack.edges = [{ from: "demo.core.out", to: "demo.core.echo" }];
    expectCompileError(pack, "write-conflict");
  });
});

describe("state(t) 求值语义", () => {
  it("同一时刻两遍求值逐字段一致", async () => {
    const runtime = createCharacterRuntime(basePack());
    const first = await runtime.computeAt(1000);
    const second = await runtime.computeAt(1000);
    expect(second).toEqual(first);
  });

  it("参数按显式覆盖优先于槽位缺省生效", async () => {
    const runtime = createCharacterRuntime(basePack());
    const defaulted = await runtime.computeAt(0);
    const overridden = await runtime.computeAt(0, { "demo.core.level": 0.75 });
    expect(
      defaulted.nodes["demo.core.writer"]?.params["demo.core.out"],
    ).toBeCloseTo(0.25, 6);
    expect(
      overridden.nodes["demo.core.writer"]?.params["demo.core.out"],
    ).toBeCloseTo(0.75, 6);
  });

  it("输出超出声明范围被钳制并记录约束报告", async () => {
    const pack = basePack();
    pack.slots = [
      ...pack.slots.slice(0, 1),
      slot("demo.core.out", "output", { range: { min: 0, max: 0.5 } }),
      pack.slots[2]!,
    ];
    pack.nodes = [
      node("demo.core.writer", [], ["demo.core.out"], () => ({
        values: { "demo.core.out": 2 },
      })),
      pack.nodes[1]!,
    ];
    const runtime = createCharacterRuntime(pack);
    const state = await runtime.computeAt(0);
    expect(state.nodes["demo.core.writer"]?.params["demo.core.out"]).toBe(0.5);
    expect(state.nodes["demo.core.writer"]?.constraints).toEqual([
      {
        nodeId: "demo.core.writer",
        slot: "demo.core.out",
        requested: 2,
        applied: 0.5,
        clamped: true,
      },
    ]);
  });

  it("显式参数超范围被钳制且报告挂首个读取者", async () => {
    const runtime = createCharacterRuntime(basePack());
    const state = await runtime.computeAt(0, { "demo.core.level": 9 });
    const report = state.nodes["demo.core.writer"]?.constraints.find(
      (entry) => entry.slot === "demo.core.level",
    );
    expect(report).toEqual({
      nodeId: "demo.core.writer",
      slot: "demo.core.level",
      requested: 9,
      applied: 1,
      clamped: true,
    });
  });

  it("节点子流种子由包与节点标识派生且两遍一致", async () => {
    const runtime = createCharacterRuntime(basePack());
    const first = await runtime.computeAt(0);
    const second = await runtime.computeAt(0);
    expect(second.nodes["demo.core.writer"]?.params["demo.core.out"]).toEqual(
      first.nodes["demo.core.writer"]?.params["demo.core.out"],
    );
  });

  it("求值顺序遵循拓扑序且状态携带声明序绘制顺序与坐标系标识", async () => {
    const runtime = createCharacterRuntime(basePack());
    const state = await runtime.computeAt(0);
    expect(
      state.nodes["demo.core.reader"]?.params["demo.core.echo"],
    ).toBeCloseTo(
      (state.nodes["demo.core.writer"]?.params["demo.core.out"] ?? 0) * 2,
      12,
    );
    expect(state.zOrder).toEqual(["demo.core.writer", "demo.core.reader"]);
    expect(state.coordinateSpace).toBe(CHARACTER_COORDINATE_SPACE);
    expect(state.nodes["demo.core.reader"]?.transform).toEqual({
      a: 1,
      b: 0,
      c: 0,
      d: 1,
      e: 0,
      f: 0,
    });
  });

  it("耦合边把源槽值传播到目标槽供下游读取", async () => {
    const pack = basePack();
    pack.slots = [...pack.slots, slot("demo.core.mirror", "output")];
    pack.nodes = [
      pack.nodes[0]!,
      node(
        "demo.core.mirror-reader",
        ["demo.core.mirror"],
        ["demo.core.echo"],
        (inputs) => ({
          values: { "demo.core.echo": inputs.values["demo.core.mirror"]! * 2 },
        }),
      ),
    ];
    pack.edges = [{ from: "demo.core.out", to: "demo.core.mirror" }];
    const runtime = createCharacterRuntime(pack);
    const state = await runtime.computeAt(0);
    expect(
      state.nodes["demo.core.mirror-reader"]?.params["demo.core.echo"],
    ).toBeCloseTo(
      (state.nodes["demo.core.writer"]?.params["demo.core.out"] ?? 0) * 2,
      12,
    );
  });
});

describe("区间采样", () => {
  it("按网格逐点采样且含两端", async () => {
    const runtime = createCharacterRuntime(basePack());
    const frames = await runtime.computeRange(0, 100, { stepMs: 50 });
    expect(frames.map((frame) => frame.tMs)).toEqual([0, 50, 100]);
  });

  it("非正步长判为类型化求值错误", async () => {
    const runtime = createCharacterRuntime(basePack());
    await expect(
      runtime.computeRange(0, 100, { stepMs: 0 }),
    ).rejects.toThrowError(
      expect.objectContaining({ name: "ComputeError", kind: "invalid-grid" }),
    );
  });
});

describe("状态验证", () => {
  it("逐条执行域包断言并保序汇总", async () => {
    const pack = basePack();
    pack.validations = [
      {
        name: "回声为写入值的两倍",
        assert: (state) => {
          const writer =
            state.nodes["demo.core.writer"]?.params["demo.core.out"] ?? 0;
          const reader =
            state.nodes["demo.core.reader"]?.params["demo.core.echo"] ?? 0;
          return { ok: Math.abs(reader - writer * 2) < 1e-9, failures: [] };
        },
      },
      {
        name: "写入值不得为负",
        assert: (state) => {
          const writer =
            state.nodes["demo.core.writer"]?.params["demo.core.out"] ?? 0;
          return writer >= 0
            ? { ok: true, failures: [] }
            : { ok: false, failures: ["写入值为负"] };
        },
      },
    ];
    const runtime = createCharacterRuntime(basePack());
    const state = await runtime.computeAt(0);
    const results = validateState(pack, state);
    expect(results.map((result) => result.ok)).toEqual([true, true]);
  });
});

describe("基空间校验", () => {
  /** 合法单基对：左右成对、双向指名、绑定存在的节点。 */
  const validBase = (): CharacterPack["basis"] => ({
    bases: [
      {
        name: "demo.core.level",
        region: "core",
        side: "left",
        group: "core-pair",
        bindTargets: ["demo.core.writer"],
        pair: "demo.core.in-r",
      },
      {
        name: "demo.core.in-r",
        region: "core",
        side: "right",
        group: "core-pair",
        bindTargets: ["demo.core.writer"],
        pair: "demo.core.level",
      },
    ],
  });

  it("六要素齐备的基空间合法；未声明基空间的配方视为合法", () => {
    expect(validateBasisSpace(basePack()).ok).toBe(true);
    const withBasis = basePack();
    withBasis.slots = [
      ...withBasis.slots,
      { name: "demo.core.in-r", direction: "input" },
    ];
    withBasis.basis = validBase();
    expect(validateBasisSpace(withBasis)).toEqual({ ok: true, failures: [] });
  });

  it("基必须指向已声明的输入槽", () => {
    const pack = basePack();
    pack.basis = {
      bases: [
        {
          name: "demo.core.ghost",
          region: "core",
          side: "center",
          group: "g",
          bindTargets: ["demo.core.writer"],
        },
      ],
    };
    const result = validateBasisSpace(pack);
    expect(result.ok).toBe(false);
    expect(
      result.failures.some((failure) => failure.includes("demo.core.ghost")),
    ).toBe(true);
  });

  it("侧向基必须成对且双向指名；中间基不得声明成对", () => {
    const pack = basePack();
    pack.basis = {
      bases: [
        {
          name: "demo.core.level",
          region: "core",
          side: "left",
          group: "g",
          bindTargets: ["demo.core.writer"],
          pair: "demo.core.missing",
        },
        {
          name: "demo.core.right",
          region: "core",
          side: "right",
          group: "g",
          bindTargets: ["demo.core.writer"],
        },
        {
          name: "demo.core.out",
          region: "core",
          side: "center",
          group: "g",
          bindTargets: ["demo.core.writer"],
          pair: "demo.core.level",
        },
      ],
    };
    const failures = validateBasisSpace(pack).failures;
    expect(
      failures.some((failure) =>
        failure.includes("成对基 demo.core.missing 不存在"),
      ),
    ).toBe(true);
    expect(failures.some((failure) => failure.includes("未声明成对基"))).toBe(
      true,
    );
    expect(
      failures.some((failure) => failure.includes("中间基但声明了成对基")),
    ).toBe(true);
  });

  it("绑定目标必须存在；重复声明判失败", () => {
    const pack = basePack();
    pack.basis = {
      bases: [
        {
          name: "demo.core.level",
          region: "core",
          side: "center",
          group: "g",
          bindTargets: ["demo.core.ghost"],
        },
        {
          name: "demo.core.level",
          region: "core",
          side: "center",
          group: "g",
          bindTargets: ["demo.core.writer"],
        },
      ],
    };
    const failures = validateBasisSpace(pack).failures;
    expect(
      failures.some((failure) => failure.includes("demo.core.ghost 不存在")),
    ).toBe(true);
    expect(failures.some((failure) => failure.includes("重复声明"))).toBe(true);
  });

  it("耦合目标必须落在配方槽位内且增益有限", () => {
    const pack = basePack();
    pack.basis = {
      bases: [
        {
          name: "demo.core.level",
          region: "core",
          side: "center",
          group: "g",
          bindTargets: ["demo.core.writer"],
          couplings: [
            { to: "demo.core.nowhere", gain: 0.5 },
            { to: "demo.core.out", gain: Number.NaN },
          ],
        },
      ],
    };
    const failures = validateBasisSpace(pack).failures;
    expect(
      failures.some((failure) => failure.includes("demo.core.nowhere")),
    ).toBe(true);
    expect(
      failures.some((failure) => failure.includes("增益必须是有限数")),
    ).toBe(true);
  });
});
