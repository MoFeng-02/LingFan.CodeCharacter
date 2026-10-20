/**
 * 契约层唯一出口：全部对外类型与签名从这里转发。
 *
 * 是什么：@lingfan-character/contracts 的 barrel。
 * 为什么：消费方只准从包根 import，禁止深入包内部路径（原子化纪律）。
 * 怎么用：import type { CharacterState } from "@lingfan-character/contracts"。
 * 注意事项：本包零运行时实现——只增补类型与签名，不添加可执行逻辑；
 *          转发顺序按主题分组，新增契约文件时在对应分组补一行。
 */

export type {
  AffineTransform,
  BlendMode,
  CharacterState,
  ConstraintReport,
  CoordinateSpaceId,
  NodeId,
  NodeState,
  NormalizedPoint,
  PathCommand,
  RenderPrimitive,
  RgbaColor,
  ShapePrimitive,
  SlotName,
  TimeMs,
} from "./state";

export type {
  DependencyEdge,
  NodeDeclaration,
  NodeStep,
  NodeStepInputs,
  NodeStepOutputs,
  RandomSubstream,
  TopologicalOrder,
} from "./node";

export type {
  CharacterPack,
  PackDeclaration,
  PackValidation,
  SlotDeclaration,
  SlotRange,
  ValidationResult,
} from "./pack";

export type {
  CurveExpr,
  CurveEvaluator,
  EasingName,
  EasingSegment,
} from "./curve";

export type { NoiseExpr, NoiseEvaluator, SeedDeriver } from "./noise";

export type {
  ComputeAt,
  ComputeRange,
  SampleGrid,
  SubstepPolicy,
} from "./sample";

export type {
  BasisCoupling,
  BasisDeclaration,
  BasisSide,
  BasisSpace,
} from "./basis";

export type {
  InboundDeclaration,
  OutboundDeclaration,
  SceneLink,
} from "./link";
