/**
 * 立体半身像配方装配：求值节点、槽位声明与域包组装。
 *
 * 是什么：一个外观节点读取转头/点头/呼吸三个参数槽，现场生成立体头骨
 *         几何与采样视角，产出一个立体几何基元；无输出槽、无耦合边。
 * 为什么：最小验证配方——证明「转头出真实侧脸」的完整链路
 *         （参数 → 视角 → 几何采样 → 2D 指令流）可以只靠既有契约运转。
 * 怎么用：createCharacterRuntime(bust3dPack) → computeAt(t, overrides)
 *         → sampleState → 2D 渲染器编译与绘制。
 * 注意事项：视角由参数直接映射，无缓动层；呼吸缩放在几何生成内完成，
 *          节点输出每帧重算，无任何跨调用状态。
 */

import type {
  AffineTransform,
  NodeStepInputs,
  NodeStepOutputs,
  RenderPrimitive,
} from "@lingfan-character/contracts";
import { buildHead } from "./geometry";
import { DEFAULTS, PITCH_RANGE, RANGES, SLOT, YAW_RANGE } from "./shared";

const IDENTITY: AffineTransform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

const SKIN_BANDS = [
  { r: 0.95, g: 0.82, b: 0.68, a: 1 },
  { r: 0.85, g: 0.68, b: 0.52, a: 1 },
  { r: 0.62, g: 0.45, b: 0.34, a: 1 },
] as const;

const NODE_ID = {
  head: "appearance.head",
} as const;

function headStep(inputs: NodeStepInputs, _tMs: number): NodeStepOutputs {
  const turn = inputs.values[SLOT.headTurn] ?? 0;
  const tilt = inputs.values[SLOT.headTilt] ?? 0;
  const breath = inputs.values[SLOT.breath] ?? 0;
  const { vertices, faces } = buildHead(breath);
  const primitive: RenderPrimitive = {
    nodeId: NODE_ID.head,
    shape: {
      kind: "solid3d",
      vertices,
      faces,
      shading: SKIN_BANDS,
      view: { yaw: turn * YAW_RANGE, pitch: tilt * PITCH_RANGE, roll: 0 },
    },
    transform: IDENTITY,
    tint: SKIN_BANDS[0],
    blend: "normal",
    opacity: 1,
  };
  return { values: {}, primitives: [primitive] };
}

export const bust3dPack = {
  declaration: { id: "bust3d", version: "0.1.0", families: ["appearance"] },
  slots: [
    {
      name: SLOT.headTurn,
      direction: "input",
      defaultValue: DEFAULTS[SLOT.headTurn],
      range: RANGES[SLOT.headTurn],
    },
    {
      name: SLOT.headTilt,
      direction: "input",
      defaultValue: DEFAULTS[SLOT.headTilt],
      range: RANGES[SLOT.headTilt],
    },
    {
      name: SLOT.breath,
      direction: "input",
      defaultValue: DEFAULTS[SLOT.breath],
      range: RANGES[SLOT.breath],
    },
  ],
  nodes: [
    {
      id: NODE_ID.head,
      reads: [SLOT.headTurn, SLOT.headTilt, SLOT.breath],
      writes: [],
      step: headStep,
    },
  ],
  edges: [],
  validations: [],
  substep: { kind: "fixed", count: 1 },
} as const;

export { NODE_ID, SLOT, DEFAULTS, RANGES };
