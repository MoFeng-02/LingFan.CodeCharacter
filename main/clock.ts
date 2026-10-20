/**
 * 角色时间轴：epoch 是首帧时间戳，此后一切时刻 = now − epoch。
 * 组合根唯一的时钟状态；FPS 主权在调度方，这里只提供毫秒读数。
 */

let epoch: number | null = null;

/** 首帧建立时间基准；后续调用为幂等操作。 */
export function ensureEpoch(now: number): void {
  if (epoch === null) {
    epoch = now;
  }
}

/** 角色时间轴上的当前时刻（毫秒），与帧循环的 tMs 同源。 */
export function nowTMs(): number {
  return performance.now() - (epoch ?? performance.now());
}
