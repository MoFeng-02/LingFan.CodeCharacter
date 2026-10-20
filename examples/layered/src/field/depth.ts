/**
 * 深度场：舞台坐标到「该点离观察者多近」的连续标量映射。
 *
 * 是什么：一个只由坐标决定的场，值域 0..1——鼻尖最靠近观察者，脸颊次之，
 *         轮廓最远；关于中轴对称，极点之外单调衰减。
 * 为什么：层是一整张薄片，若整层同深度，转头时整层做刚体平移，观感是
 *         「纸片在挪」而不像「头在转」。真实头部是连续曲面：鼻尖朝转向侧
 *         移动得多，耳侧移动得少。把深度写成坐标的函数，同一张薄片内部
 *         就有了连续起伏，一个层也能读出体积。
 * 怎么用：parallaxShift 与 depthScale 都以本剖面为基础；层基准深度仍由层
 *         规格给定，本文件只提供层内的相对起伏。
 * 注意事项：只用四则运算（无超越函数），跨引擎逐字节一致；剖面关于中轴
 *          对称，左右同名层在镜像点上必然得到相同的位移；层内起伏的幅度
 *          必须小于「相邻层的基准深度差」所能造成的差距量级，才不至于
 *          颠倒层间视差次序。
 */

import type { NormalizedPoint } from "@lingfan-character/contracts";

/** 剖面极点：鼻尖位置，深度取最大值处。 */
const PROFILE_CENTER = { x: 0.5, y: 0.48 } as const;

/** 剖面半径：横纵方向的衰减尺度，决定「脸有多深」。 */
const PROFILE_RADIUS_X = 0.42;
const PROFILE_RADIUS_Y = 0.44;

/** 鼻梁突起的权重：越大则中轴相对两颊越靠前，鼻梁越挺。 */
const NOSE_WEIGHT = 0.45;

/** 剖面枢轴：高于它的点视为前侧、低于它的点视为后侧。 */
export const PROFILE_PIVOT = 0.5;

/** 单轴数值收敛到 0..1。 */
function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * 层内深度剖面：0 = 该层最远边缘，1 = 鼻尖。
 * 穹顶项让深度随离极点的距离平滑衰减；鼻梁项在极点附近再叠加一层凸起，
 * 使中轴比两颊更靠前——两者都是距离平方的有理式与多项式，无超越函数。
 */
export function depthProfile(point: NormalizedPoint): number {
  const dx = (point.x - PROFILE_CENTER.x) / PROFILE_RADIUS_X;
  const dy = (point.y - PROFILE_CENTER.y) / PROFILE_RADIUS_Y;
  const radius2 = dx * dx + dy * dy;

  // 穹顶：距离平方的有理式，极点处为 1，远处单调趋近 0。
  const dome = 1 / (1 + radius2);
  // 鼻梁：极点处为 1，出半径即归零的平滑窗。
  const ridge = (1 - Math.min(1, radius2)) ** 2;
  return clamp01(dome * (1 - NOSE_WEIGHT) + ridge * NOSE_WEIGHT);
}

/**
 * 深度透视收缩：转向时前侧略微放大、后侧略微缩小，模拟近大远小。
 * 只依赖坐标与朝向，不含层信息——同一坐标在任何层必然得到同一系数，
 * 层与层之间因此不会因缩放而相对漂移。
 */
export function depthScale(point: NormalizedPoint, headTurn: number): number {
  return (
    1 + headTurn * (depthProfile(point) - PROFILE_PIVOT) * DEPTH_SCALE_GAIN
  );
}

/** 满朝向、剖面满幅时的缩放幅度（±4%），保持在不会读成「推拉镜头」的量级。 */
export const DEPTH_SCALE_GAIN = 0.08;

/** 满朝向、剖面满幅时的横向视差量（归一化），层内起伏的主要来源。 */
export const INTRA_PARALLAX_GAIN = 0.05;
