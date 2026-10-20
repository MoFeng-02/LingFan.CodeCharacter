/**
 * 状态向量契约：state(t) 是角色域对外唯一接缝，纯数据、分辨率无关。
 *
 * 是什么：一个角色在时刻 t 的完整状态——各节点形变、参数值、约束结果与可渲染基元。
 * 为什么：渲染器只消费这份纯数据（渲染器只 import 契约），同一 t 的 state(t) 逐字节相同，
 *         更换渲染器不影响角色语义（替换判据的机械基础）。
 * 怎么用：内核求值产出 CharacterState，交给任何渲染器或场景编排者。
 * 注意事项：坐标一律图层局部归一化（0..1）加显式锚点；坐标系标识随状态携带，
 *          消费方据此解释坐标；本文件只放类型与语义承诺，零运行时实现。
 */

/** 时间单位：毫秒。角色域一切时间语义以毫秒为准，没有「第 n 帧」概念。 */
export type TimeMs = number;

/** 节点标识：包内稳定唯一，state(t) 按节点标识聚合。 */
export type NodeId = string;

/** 槽位名：以「包.节点族.槽位」点分路径命名，全仓唯一。 */
export type SlotName = string;

/** 图层局部归一化坐标点，分量取值 0..1。 */
export interface NormalizedPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * 坐标系标识：随 state(t) 携带，消费方据此解释全部坐标与尺寸。
 * 当前唯一取值由内核声明；新增坐标系属于契约增补，只增不改。
 */
export type CoordinateSpaceId = string;

/** 仿射变换矩阵，六个系数与 canvas2d setTransform 同序：a b c d e f。 */
export interface AffineTransform {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
}

/** 颜色：RGBA 四分量，取值 0..1。外观参数的一部分，进状态向量。 */
export interface RgbaColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

/** 混合模式：canvas2d 支持集的子集；渲染器对未知取值必须报错而非静默忽略。 */
export type BlendMode = "normal" | "multiply" | "screen" | "overlay";

/**
 * 矢量路径命令：坐标全部为图层局部归一化值。
 * 曲线控制点同样归一化；渲染器按自身分辨率映射到像素。
 */
export type PathCommand =
  | { readonly kind: "moveTo"; readonly point: NormalizedPoint }
  | { readonly kind: "lineTo"; readonly point: NormalizedPoint }
  | {
      readonly kind: "bezierCurveTo";
      readonly control1: NormalizedPoint;
      readonly control2: NormalizedPoint;
      readonly point: NormalizedPoint;
    }
  | { readonly kind: "closePath" };

/**
 * 纹理标识：素材位图在宿主资源表中的引用键。
 * 契约只携带标识与网格几何，位图本体不进状态向量——
 * 资源的解析与注册属于宿主与渲染端的装配语义，不属于 state(t)。
 */
export type TextureId = string;

import type { SolidPrimitive } from "./geometry";

/**
 * 网格形变基元：素材轨的承接面（程序管动、素材管画）。
 * cols×rows 个控制点构成 (cols−1)×(rows−1) 个四边形网格单元，行优先排列；
 * 顶点为图层局部归一化坐标，由基系数与曲线驱动形变——纯函数可求值可指纹。
 * 渲染端按 textureId 从宿主资源表解析位图，将纹理逐单元映射到形变网格；
 * 解析失败的语义由渲染端声明（canvas2d 适配器选择报错而非静默跳过）。
 */
export interface MeshPrimitive {
  readonly kind: "mesh";
  /** 网格列数与行数（控制点数），均 ≥ 2。 */
  readonly cols: number;
  readonly rows: number;
  /** 形变后控制点，行优先，长度 = cols×rows。 */
  readonly vertices: readonly NormalizedPoint[];
  /** 素材位图在宿主资源表中的引用键。 */
  readonly textureId: TextureId;
}

/**
 * 程序形状基元：外观节点的像素来源描述，分辨率无关。
 * v0 提供路径与椭圆；新增基元属于契约增补，只增不改。
 */
export type ShapePrimitive =
  | { readonly kind: "path"; readonly commands: readonly PathCommand[] }
  | {
      readonly kind: "ellipse";
      readonly center: NormalizedPoint;
      readonly radiusX: number;
      readonly radiusY: number;
    }
  | MeshPrimitive
  | SolidPrimitive;

/**
 * 可渲染基元：形状、形变与外观参数的合体，进 state(t)。
 * 渲染器据此光栅化——不得反查角色定义或剧本。
 */
export interface RenderPrimitive {
  /** 产出该基元的节点标识，用于追溯与测试定位。 */
  readonly nodeId: NodeId;
  readonly shape: ShapePrimitive;
  readonly transform: AffineTransform;
  readonly tint: RgbaColor;
  readonly blend: BlendMode;
  /** 不透明度 0..1，超出视为约束违反。 */
  readonly opacity: number;
}

/** 约束求值报告：请求值、钳制后应用值与是否发生钳制。 */
export interface ConstraintReport {
  readonly nodeId: NodeId;
  readonly slot: SlotName;
  readonly requested: number;
  readonly applied: number;
  readonly clamped: boolean;
}

/** 单节点状态：形变、参数值、约束报告与该节点产出的可渲染基元。 */
export interface NodeState {
  readonly transform: AffineTransform;
  readonly params: Readonly<Record<SlotName, number>>;
  readonly constraints: readonly ConstraintReport[];
  readonly primitives: readonly RenderPrimitive[];
}

/**
 * state(t)：纯数据状态向量。
 * zOrder 即合成语义中的绘制顺序（先声明先画，后声明覆盖其上）；
 * 同一 t 的两次求值必须产出逐字节相同的结果。
 */
export interface CharacterState {
  readonly tMs: TimeMs;
  readonly coordinateSpace: CoordinateSpaceId;
  readonly zOrder: readonly NodeId[];
  readonly nodes: Readonly<Record<NodeId, NodeState>>;
}
