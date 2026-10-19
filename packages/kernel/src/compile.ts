/**
 * 求值图编译：把域包端口编译为可求值的确定性依赖图。
 *
 * 是什么：compile(pack) → CompiledGraph——槽位索引、拓扑序、耦合传播与各槽首个读取者。
 * 为什么：写冲突、环与悬空引用必须在求值前判为编译错误（fail-fast）；
 *         拓扑序含字典序平局规则，保证同一图同一输入的求值顺序跨实现恒定。
 * 怎么用：内核入口先 compile 再创建运行时；域包声明不合法直接抛 CompileError。
 * 注意事项：依赖图 = 槽位读写边 + 耦合传播边（读传播目标槽的节点排在写源槽的节点之后）；
 *          耦合边的目标槽不得被任何节点写入（它只做镜像传播），否则判写冲突。
 */

import type {
  CharacterPack,
  SlotDeclaration,
} from "@lingfan-character/contracts";
import type {
  NodeId,
  SlotName,
  TopologicalOrder,
} from "@lingfan-character/contracts";
import { CompileError } from "./errors";

/** 编译产物：域包与推导出的求值顺序及索引。 */
export interface CompiledGraph {
  readonly pack: CharacterPack;
  readonly slots: ReadonlyMap<SlotName, SlotDeclaration>;
  readonly order: TopologicalOrder;
  /** 各槽按拓扑序的首个读取者；输入钳制报告挂到它名下。 */
  readonly firstReader: ReadonlyMap<SlotName, NodeId>;
  /** 耦合传播表：目标槽 → 源槽；求值期目标槽为源槽的实时镜像。 */
  readonly edgeTargets: ReadonlyMap<SlotName, SlotName>;
}

/** 编译域包：全部校验通过返回编译图，任一失败抛类型化 CompileError。 */
export const compile = (pack: CharacterPack): CompiledGraph => {
  const slotIndex = new Map<SlotName, SlotDeclaration>();
  for (const slot of pack.slots) {
    assertSlotNaming(pack, slot);
    if (slotIndex.has(slot.name)) {
      throw new CompileError("duplicate-slot", `槽位重复声明：${slot.name}`, {
        slot: slot.name,
      });
    }
    slotIndex.set(slot.name, slot);
  }

  const nodeIndex = new Set<NodeId>();
  for (const node of pack.nodes) {
    if (nodeIndex.has(node.id)) {
      throw new CompileError("duplicate-node", `节点重复声明：${node.id}`, {
        node: node.id,
      });
    }
    nodeIndex.add(node.id);
  }

  const writers = new Map<SlotName, NodeId>();
  for (const node of pack.nodes) {
    for (const slotName of [...node.reads, ...node.writes]) {
      if (!slotIndex.has(slotName)) {
        throw new CompileError(
          "unknown-slot",
          `节点 ${node.id} 引用未声明槽位：${slotName}`,
          {
            node: node.id,
            slot: slotName,
          },
        );
      }
    }
    for (const slotName of node.writes) {
      const previous = writers.get(slotName);
      if (previous !== undefined) {
        throw new CompileError(
          "write-conflict",
          `两个节点写同一输出槽：${slotName}（${previous} 与 ${node.id}）`,
          { slot: slotName, first: previous, second: node.id },
        );
      }
      writers.set(slotName, node.id);
    }
  }

  const edgeTargets = new Map<SlotName, SlotName>();
  for (const edge of pack.edges) {
    for (const slotName of [edge.from, edge.to]) {
      if (!slotIndex.has(slotName)) {
        throw new CompileError(
          "unknown-slot",
          `耦合边引用未声明槽位：${slotName}`,
          { slot: slotName },
        );
      }
    }
    const targetWriter = writers.get(edge.to);
    if (targetWriter !== undefined) {
      throw new CompileError(
        "write-conflict",
        `耦合边目标槽 ${edge.to} 同时被节点 ${targetWriter} 写入，传播与写入冲突`,
        { slot: edge.to, node: targetWriter },
      );
    }
    if (edgeTargets.has(edge.to)) {
      throw new CompileError(
        "write-conflict",
        `多个耦合边传播到同一目标槽：${edge.to}`,
        {
          slot: edge.to,
        },
      );
    }
    edgeTargets.set(edge.to, edge.from);
  }

  for (const slot of pack.slots) {
    if (slot.defaultValue === undefined) {
      continue;
    }
    if (slot.direction !== "input") {
      throw new CompileError(
        "slot-naming",
        `输出槽不得声明内置缺省：${slot.name}`,
        { slot: slot.name },
      );
    }
    if (
      slot.range !== undefined &&
      (slot.defaultValue < slot.range.min || slot.defaultValue > slot.range.max)
    ) {
      throw new CompileError(
        "default-out-of-range",
        `槽位缺省值超出声明范围：${slot.name}`,
        {
          slot: slot.name,
          value: String(slot.defaultValue),
        },
      );
    }
  }

  const order = topologicalOrder(pack, writers);

  const firstReader = new Map<SlotName, NodeId>();
  for (const nodeId of order) {
    const node = pack.nodes.find((candidate) => candidate.id === nodeId);
    if (node === undefined) {
      continue;
    }
    for (const slotName of node.reads) {
      if (!firstReader.has(slotName)) {
        firstReader.set(slotName, nodeId);
      }
    }
  }

  return { pack, slots: slotIndex, order, firstReader, edgeTargets };
};

const assertSlotNaming = (pack: CharacterPack, slot: SlotDeclaration): void => {
  const prefix = `${pack.declaration.id}.`;
  if (!slot.name.startsWith(prefix) || slot.name.split(".").length < 3) {
    throw new CompileError(
      "slot-naming",
      `槽位名必须以包标识开头的点分路径命名：${slot.name}`,
      {
        slot: slot.name,
        pack: pack.declaration.id,
      },
    );
  }
};

/** 依赖边：写者 → 读者。耦合边（from 传播到 to）等效于「写 from 者 → 读 to 者」。 */
const topologicalOrder = (
  pack: CharacterPack,
  writers: ReadonlyMap<SlotName, NodeId>,
): TopologicalOrder => {
  const readers = new Map<SlotName, NodeId[]>();
  for (const node of pack.nodes) {
    for (const slotName of node.reads) {
      const list = readers.get(slotName) ?? [];
      list.push(node.id);
      readers.set(slotName, list);
    }
  }

  const incoming = new Map<NodeId, number>();
  const outgoing = new Map<NodeId, NodeId[]>();
  for (const node of pack.nodes) {
    incoming.set(node.id, 0);
    outgoing.set(node.id, []);
  }

  const depend = (writer: NodeId, reader: NodeId): void => {
    outgoing.get(writer)?.push(reader);
    incoming.set(reader, (incoming.get(reader) ?? 0) + 1);
  };

  for (const [slotName, writer] of writers) {
    for (const reader of readers.get(slotName) ?? []) {
      if (reader !== writer) {
        depend(writer, reader);
      }
    }
  }
  for (const edge of pack.edges) {
    const writer = writers.get(edge.from);
    if (writer === undefined) {
      continue;
    }
    for (const reader of readers.get(edge.to) ?? []) {
      if (reader !== writer) {
        depend(writer, reader);
      }
    }
  }

  const ready = pack.nodes
    .filter((node) => incoming.get(node.id) === 0)
    .map((node) => node.id)
    .sort();
  const order: NodeId[] = [];
  while (ready.length > 0) {
    const nodeId = ready.shift() as NodeId;
    order.push(nodeId);
    for (const reader of outgoing.get(nodeId) ?? []) {
      const remaining = (incoming.get(reader) ?? 0) - 1;
      incoming.set(reader, remaining);
      if (remaining === 0) {
        const index = ready.findIndex((candidate) => candidate > reader);
        if (index === -1) {
          ready.push(reader);
        } else {
          ready.splice(index, 0, reader);
        }
      }
    }
  }

  if (order.length !== pack.nodes.length) {
    const stuck = pack.nodes
      .map((node) => node.id)
      .filter((id) => !order.includes(id))
      .sort();
    throw new CompileError(
      "cycle",
      `依赖图存在环，涉及节点：${stuck.join("、")}`,
      { cycle: stuck.join(",") },
    );
  }
  return order;
};
