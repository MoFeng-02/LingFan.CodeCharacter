/**
 * 确定性随机：种子派生与节点子流。
 *
 * 是什么：从「角色标识 + 节点标识」到 32 位整数种子的派生算法（FNV-1a），
 *         以及由种子驱动的子流（mulberry32）。
 * 为什么：每个节点的随机性必须跨实现一致——同角色同节点永远同序列；
 *         算法固定于此，禁止另写哈希或伪随机实现。
 * 怎么用：内核为每个节点调 deriveSeed(packId, nodeId) 得种子，
 *         再以 createSubstream(seed) 生成求值期传入节点 step 的子流。
 * 注意事项：种子派生与子流均无跨调用状态；子流每次从头开始，
 *          同一节点在同一 t 的任意两次求值得到相同的 next 序列。
 */

import type { RandomSubstream } from "@lingfan-character/contracts";

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const SEED_SEPARATOR = "\u001f";

/** FNV-1a 32 位哈希：角色标识与节点标识以单元分隔符拼接后逐字节折叠。 */
export const deriveSeed = (roleId: string, nodeId: string): number => {
  const bytes = new TextEncoder().encode(roleId + SEED_SEPARATOR + nodeId);
  let hash = FNV_OFFSET_BASIS;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash >>> 0;
};

/** 由种子创建子流：mulberry32，输出 0..1，序列完全由种子决定。 */
export const createSubstream = (seed: number): RandomSubstream => {
  let state = seed >>> 0;
  return {
    seed,
    next(): number {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
};
