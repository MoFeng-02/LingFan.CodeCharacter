/**
 * 表情预设：基系数向量——演示基空间的组合表达，一键写入一组基槽覆盖。
 * 预设只是组合示例，不构成「表情名列表」语义；连续微调仍走基滑杆。
 * 应用走锚点过渡，预设间切换值连续。
 */

import type { SlotName } from "@lingfan-character/contracts";
import {
  BASIS_SLOT_KEYS,
  DEFAULTS,
  SLOT,
  type SlotId,
} from "@lingfan-character/example-humanoid";
import { beginTransition } from "./overrides";

const EXPRESSIONS: Record<string, Partial<Record<SlotName, number>>> = {
  惊讶: {
    [SLOT.browRaiseL]: 1,
    [SLOT.browRaiseR]: 1,
    [SLOT.eyeOpenL]: 1,
    [SLOT.eyeOpenR]: 1,
    [SLOT.jawOpen]: 0.7,
    [SLOT.pupilDilate]: 0.6,
  },
  将笑未笑: {
    [SLOT.mouthCornerL]: 0.55,
    [SLOT.mouthCornerR]: 0.45,
    [SLOT.cheekRaiseL]: 0.5,
    [SLOT.cheekRaiseR]: 0.4,
  },
  皱眉: {
    [SLOT.browFurrowL]: 0.9,
    [SLOT.browFurrowR]: 0.9,
    [SLOT.mouthCornerL]: -0.4,
    [SLOT.mouthCornerR]: -0.4,
    [SLOT.lipCompress]: 0.5,
  },
  单挑眉: {
    [SLOT.browRaiseL]: 1,
    [SLOT.eyeOpenL]: 0.85,
    [SLOT.eyeOpenR]: 0.5,
  },
};

let activeExpression: string | null = null;

/** 应用预设：新旧预设涉及的槽全部走锚点过渡；null 表示全部回缺省。 */
export function applyExpression(name: string | null): void {
  const involved = new Set<SlotName>(
    Object.keys(EXPRESSIONS[activeExpression ?? ""] ?? {}) as SlotName[],
  );
  activeExpression = name;
  const next = EXPRESSIONS[name ?? ""] ?? {};
  for (const slot of Object.keys(next) as SlotName[]) {
    involved.add(slot);
  }
  for (const slot of involved) {
    beginTransition(slot, next[slot] ?? DEFAULTS[slot as SlotId] ?? 0);
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    "#expressions button[data-expression]",
  )) {
    button.classList.toggle("active", button.dataset.expression === name);
  }
}

/** 表情预设与复位按钮接线：同按钮再点即取消。 */
export function wireExpressions(): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    "#expressions button[data-expression]",
  )) {
    const name = button.dataset.expression;
    if (!name) continue;
    button.addEventListener("click", () =>
      applyExpression(name === activeExpression ? null : name),
    );
  }
  document
    .querySelector<HTMLButtonElement>("#expressions .reset")
    ?.addEventListener("click", () => {
      applyExpression(null);
      for (const key of BASIS_SLOT_KEYS) {
        beginTransition(SLOT[key], DEFAULTS[SLOT[key]] ?? 0);
      }
    });
}
