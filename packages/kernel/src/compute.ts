/**
 * 状态求值：按拓扑序跑节点、钳制约束、聚合 state(t)。
 *
 * 是什么：createCharacterRuntime(pack) → computeAt / computeRange——对外毫秒进状态出。
 * 为什么：同 t 恒同 state(t) 是跨实现重合的根基——节点子流种子由包与节点标识派生，
 *         参数三级继承（显式覆盖 > 槽位缺省 > 零基线）与钳制口径全部固定在此唯一实现。
 * 怎么用：组合根创建运行时后按需绑定参数得到 ComputeAt，或按网格取 computeRange。
 * 注意事项：节点写入以声明 writes 为白名单，声明外键忽略；输出超范围钳制并记录，
 *          显式参数超范围同样钳制、报告挂该槽的首个读取者；求值无跨调用状态。
 */

import type {
  CharacterPack,
  CharacterState,
  ConstraintReport,
  NodeState,
  SampleGrid,
  SlotName,
  TimeMs,
} from "@lingfan-character/contracts";
import { createSubstream, deriveSeed } from "@lingfan-character/primitives";
import { compile, type CompiledGraph } from "./compile";
import { ComputeError } from "./errors";

/** 内核声明的当前唯一坐标系：图层局部归一化坐标加显式锚点。 */
export const CHARACTER_COORDINATE_SPACE = "character.layer-local.v1";

const IDENTITY = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } as const;

/** 角色运行时：编译一次、按帧求值；运行时无内部可变状态。 */
export interface CharacterRuntime {
  readonly computeAt: (
    tMs: TimeMs,
    overrides?: Readonly<Record<SlotName, number>>,
  ) => Promise<CharacterState>;
  readonly computeRange: (
    fromMs: TimeMs,
    toMs: TimeMs,
    grid: SampleGrid,
    overrides?: Readonly<Record<SlotName, number>>,
  ) => Promise<readonly CharacterState[]>;
}

/** 创建运行时：先编译域包，声明不合法在创建时即抛类型化错误。 */
export const createCharacterRuntime = (
  pack: CharacterPack,
): CharacterRuntime => {
  const graph = compile(pack);
  return {
    computeAt: (tMs, overrides) =>
      Promise.resolve(evaluateAt(graph, tMs, overrides ?? {})),
    computeRange: (fromMs, toMs, grid, overrides) => {
      if (!Number.isFinite(grid.stepMs) || grid.stepMs <= 0) {
        return Promise.reject(
          new ComputeError(
            "invalid-grid",
            `采样步长必须为正数毫秒：${String(grid.stepMs)}`,
            {
              stepMs: String(grid.stepMs),
            },
          ),
        );
      }
      if (toMs < fromMs) {
        return Promise.reject(
          new ComputeError(
            "invalid-grid",
            `区间终点早于起点：${String(toMs)} < ${String(fromMs)}`,
            {
              fromMs: String(fromMs),
              toMs: String(toMs),
            },
          ),
        );
      }
      const frames: CharacterState[] = [];
      for (let tMs = fromMs; tMs < toMs; tMs += grid.stepMs) {
        frames.push(evaluateAt(graph, tMs, overrides ?? {}));
      }
      frames.push(evaluateAt(graph, toMs, overrides ?? {}));
      return Promise.resolve(frames);
    },
  };
};

const clampToRange = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

const evaluateAt = (
  graph: CompiledGraph,
  tMs: TimeMs,
  overrides: Readonly<Record<SlotName, number>>,
): CharacterState => {
  const { pack, slots, order, firstReader, edgeTargets } = graph;

  // 耦合传播：目标槽是源槽的实时镜像，读取时逐级解析；链式边自然支持。
  const readSlot = (slotName: SlotName): number => {
    const source = edgeTargets.get(slotName);
    return source === undefined
      ? (slotValues.get(slotName) ?? 0)
      : readSlot(source);
  };

  const reports = new Map<string, ConstraintReport[]>();
  const collect = (nodeId: string, report: ConstraintReport): void => {
    const list = reports.get(nodeId) ?? [];
    list.push(report);
    reports.set(nodeId, list);
  };

  // 参数三级继承：零基线 → 槽位缺省 → 显式覆盖；随后按声明范围钳制输入槽。
  const slotValues = new Map<SlotName, number>();
  for (const slot of pack.slots) {
    let value = 0;
    if (slot.direction === "input") {
      value = slot.defaultValue ?? 0;
      const override = overrides[slot.name];
      if (override !== undefined) {
        if (!Number.isFinite(override)) {
          throw new ComputeError(
            "invalid-override",
            `显式参数必须为有限数值：${slot.name}`,
            {
              slot: slot.name,
              value: String(override),
            },
          );
        }
        value = override;
      }
    }
    if (slot.range !== undefined) {
      const applied = clampToRange(value, slot.range.min, slot.range.max);
      if (applied !== value) {
        const owner =
          slot.direction === "input" ? firstReader.get(slot.name) : undefined;
        if (owner !== undefined) {
          collect(owner, {
            nodeId: owner,
            slot: slot.name,
            requested: value,
            applied,
            clamped: true,
          });
        }
      }
      value = applied;
    }
    slotValues.set(slot.name, value);
  }

  const nodes: Record<string, NodeState> = {};
  for (const nodeId of order) {
    const node = pack.nodes.find((candidate) => candidate.id === nodeId);
    if (node === undefined) {
      continue;
    }

    const inputs: Record<SlotName, number> = {};
    for (const slotName of node.reads) {
      inputs[slotName] = readSlot(slotName);
    }

    const substream = createSubstream(deriveSeed(pack.declaration.id, node.id));
    const outputs = node.step({ values: inputs }, tMs, substream);

    const written: Record<SlotName, number> = {};
    for (const slotName of node.writes) {
      const requested = outputs.values[slotName];
      if (requested === undefined) {
        continue;
      }
      const slot = slots.get(slotName);
      let applied = requested;
      if (slot?.range !== undefined) {
        const clamped = clampToRange(applied, slot.range.min, slot.range.max);
        if (clamped !== applied) {
          collect(nodeId, {
            nodeId,
            slot: slotName,
            requested: applied,
            applied: clamped,
            clamped: true,
          });
        }
        applied = clamped;
      }
      slotValues.set(slotName, applied);
      written[slotName] = applied;
    }

    nodes[nodeId] = {
      transform: outputs.transform ?? IDENTITY,
      params: written,
      constraints: reports.get(nodeId) ?? [],
      primitives: outputs.primitives ?? [],
    };
  }

  return {
    tMs,
    coordinateSpace: CHARACTER_COORDINATE_SPACE,
    zOrder: pack.nodes.map((node) => node.id),
    nodes,
  };
};
