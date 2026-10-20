/**
 * 3D 几何契约：角色的立体形体表示与采样视角。
 *
 * 是什么：立体几何的最小描述——顶点表、三角形面索引、明暗色带与采样视角，
 *         作为形状基元进状态向量；位图网格形变（mesh）承载素材，
 *         solid3d 承载「几何本身就是算出来的」的立体路线。
 * 为什么：2D 表象 = 对 3D 几何任意视角的采样，2D 景深与侧脸信息是投影的
 *         天然产物；视角是采样参数（与「fps 是采样密度」同构），
 *         由配方参数驱动进状态，采样器据此编译出 2D 指令流。
 * 怎么用：配方节点生成顶点（参数化几何）并声明面索引与色带，视角由参数
 *         槽驱动；渲染端把 solid3d 编译为 2D 形状基元后按常规管线执行。
 * 注意事项：顶点位于局部单位域（各分量 −1..1），采样器负责把投影结果
 *          映射回图层局部归一化坐标 0..1；面顶点按「从外部看逆时针」
 *          排列，法线朝外供背面剔除与着色使用；全部运算为矩阵四则与
 *          多项式三角，保证跨设备逐字节一致。
 */

import type { RgbaColor } from "./state";

/** 三维点：局部单位域坐标（各分量 −1..1）。 */
export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** 三角形面：按「从外部看逆时针」排列的三个顶点索引。 */
export interface Face3 {
  readonly a: number;
  readonly b: number;
  readonly c: number;
}

/**
 * 采样视角：欧拉角（弧度）描述观察方向。
 * yaw 绕竖直轴（转头）、pitch 绕水平轴（点头）、roll 绕视线轴（歪头）；
 * 角度值由配方参数驱动进状态，是可编程的采样参数。
 */
export interface ViewAngle {
  readonly yaw: number;
  readonly pitch: number;
  readonly roll: number;
}

/**
 * 立体几何基元：三角形网格 + 明暗色带 + 采样视角。
 * 顶点与面索引描述形体（形变由配方逐帧重算顶点表），
 * 色带从亮到暗有序排列，采样器按面朝向离散取色（卡通着色）。
 */
export interface SolidPrimitive {
  readonly kind: "solid3d";
  /** 顶点表，长度 ≥ 4。 */
  readonly vertices: readonly Vec3[];
  /** 三角形面索引，索引必须落在顶点表内。 */
  readonly faces: readonly Face3[];
  /** 明暗色带（亮 → 暗），长度 ≥ 2；采样器按朝向离散取色。 */
  readonly shading: readonly RgbaColor[];
  /** 本批几何的采样视角。 */
  readonly view: ViewAngle;
}
