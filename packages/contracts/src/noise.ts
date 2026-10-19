/**
 * 噪声原语契约：seeded 确定性平滑值噪声，有机感的唯一随机来源。
 *
 * 是什么：噪声参数声明（倍频程、基频、频率倍率、幅度衰减）、种子派生规则与求值签名。
 * 为什么：噪声算法与种子派生规则必须进契约——否则两个实现跑同一角色结果不重合。
 * 怎么用：需要有机感的节点（呼吸微扰、发丝摆动、高光微闪）声明 NoiseExpr，
 *         内核按派生规则从「角色标识 + 节点标识」得到整数种子。
 * 注意事项：噪声实现限定为平滑值噪声——整数格点哈希加平滑插值；
 *          倍频程求和公式固定为各倍频程幅度加权和，幅度按 gain 逐倍频程衰减、
 *          频率按 lacunarity 逐倍频程倍增；插值只允许多项式平滑（同确定性白名单）。
 */

import type { NodeId, TimeMs } from "./state";
import type { RandomSubstream } from "./node";

/** 种子派生：从角色标识与节点标识得到 32 位非负整数种子，算法固定，跨实现一致。 */
export type SeedDeriver = (roleId: string, nodeId: NodeId) => number;

/** 噪声参数声明：全部字段属于契约，缺省即违规。 */
export interface NoiseExpr {
  /** 倍频程数，至少 1。 */
  readonly octaves: number;
  /** 基频：单位为每毫秒周期数，随时间推进采样。 */
  readonly frequency: number;
  /** 频率倍率：每高一倍频程频率乘该值。 */
  readonly lacunarity: number;
  /** 幅度衰减：每高一倍频程幅度乘该值。 */
  readonly gain: number;
}

/** 噪声求值签名：同一 expr、t 与子流种子必须得到相同值。 */
export type NoiseEvaluator = (
  expr: NoiseExpr,
  tMs: TimeMs,
  substream: RandomSubstream,
) => number;
