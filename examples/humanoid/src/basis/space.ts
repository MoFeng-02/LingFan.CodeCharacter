import type {
  BasisDeclaration,
  BasisSpace,
} from "@lingfan-character/contracts";
import { NODE_ID } from "../nodes";
import { SLOT } from "../shared";

/**
 * 基空间示范声明：19 个表情基的六要素元数据。
 *
 * 是什么：基 = 输入槽 + 本声明的区域/侧向/成对/绑定/耦合元数据；
 *         取值范围与缺省在槽位声明里（shared.ts），此处不重复。
 * 为什么：基空间契约要求配方声明基的组织方式，供校验与编排工具读取。
 * 怎么用：humanoidPack.basis 引用 humanoidBasis；改基时先改 shared.ts
 *         的槽位与键清单，再同步这里的元数据，校验器会把漏改暴露出来。
 * 注意事项：绑定目标只挂 face 与 mouth 两个外观节点（基形变的承接面）；
 *          本配方未声明耦合——宏观参数与基的正交叠加由 smileChain 节点承担。
 */

const FACE = NODE_ID.face;
const MOUTH = NODE_ID.mouth;

/** 左右成对基组合器：区域与正交组相同的一对基互相指名。 */
function regionPair(
  leftKey: keyof typeof SLOT,
  rightKey: keyof typeof SLOT,
  region: string,
  group: string,
  bindTargets: readonly string[],
): readonly BasisDeclaration[] {
  return [
    {
      name: SLOT[leftKey],
      region,
      side: "left",
      group,
      bindTargets,
      pair: SLOT[rightKey],
    },
    {
      name: SLOT[rightKey],
      region,
      side: "right",
      group,
      bindTargets,
      pair: SLOT[leftKey],
    },
  ];
}

/** 中间基：不可分侧的单一形变通道。 */
function centerBase(
  key: keyof typeof SLOT,
  region: string,
  group: string,
  bindTargets: readonly string[],
): BasisDeclaration {
  return { name: SLOT[key], region, side: "center", group, bindTargets };
}

/** humanoid 基空间：19 基 = 眉 4 + 眼 7 + 鼻 2 + 颊 2 + 唇 5（含下颌 1）。 */
export const humanoidBasis: BasisSpace = {
  bases: [
    ...regionPair("browRaiseL", "browRaiseR", "brow", "brow-raise", [FACE]),
    ...regionPair("browFurrowL", "browFurrowR", "brow", "brow-furrow", [FACE]),
    ...regionPair("eyeOpenL", "eyeOpenR", "eye", "eyelid", [FACE]),
    centerBase("gazeX", "eye", "gaze", [FACE]),
    centerBase("gazeY", "eye", "gaze", [FACE]),
    centerBase("pupilDilate", "eye", "pupil", [FACE]),
    ...regionPair("noseFlareL", "noseFlareR", "nose", "nose-flare", [FACE]),
    ...regionPair("cheekRaiseL", "cheekRaiseR", "cheek", "cheek-raise", [FACE]),
    ...regionPair("mouthCornerL", "mouthCornerR", "lip", "corner", [MOUTH]),
    centerBase("lipCurlUpper", "lip", "curl", [MOUTH]),
    centerBase("lipCurlLower", "lip", "curl", [MOUTH]),
    centerBase("lipCompress", "lip", "compress", [MOUTH]),
    centerBase("jawOpen", "jaw", "jaw", [MOUTH]),
  ],
};
