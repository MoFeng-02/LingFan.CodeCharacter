/**
 * 场景联动契约：角色域与场景编排之间的单向接缝。
 *
 * 是什么：出向声明（场景可读的角色状态槽位）与入向声明（场景可写进角色域的输入槽位）。
 * 为什么：联动单向——场景可驱动角色、角色不反查场景；接缝是纯数据，
 *         与「接缝 = state(t)」的世界观一致。
 * 怎么用：域包或组合根声明 SceneLink；场景侧（如视频引擎）只通过声明过的槽位交换数据。
 * 注意事项：入向槽位典型如光照方向——场景侧布光作为角色域显式输入进入；
 *          角色域不得持有任何指向场景的引用或回调。
 */

import type { SlotName } from "./state";

/** 出向声明：这些槽位的值允许被场景读取。 */
export interface OutboundDeclaration {
  readonly slots: readonly SlotName[];
}

/** 入向声明：这些槽位允许由场景写入，作为角色求值的输入。 */
export interface InboundDeclaration {
  readonly slots: readonly SlotName[];
}

/** 场景联动声明：出向与入向的合体，方向单向（场景到角色为入，角色到场景为出）。 */
export interface SceneLink {
  readonly outbound: OutboundDeclaration;
  readonly inbound: InboundDeclaration;
}
