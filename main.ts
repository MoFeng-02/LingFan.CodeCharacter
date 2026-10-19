/**
 * v0 头像切片组合根（可视冒烟入口，不进自动化门禁）。
 *
 * 是什么：把内核、域包、渲染器接成一帧一算的实时循环——每个动画帧
 *         由 computeAt 现场求值 state(t)，渲染器把状态向量编译成像素
 *         指令流后逐条执行；五参数滑杆实时改写输入覆盖。
 * 怎么用：pnpm run visual 产出 out/main.js，浏览器打开 index.html。
 * 注意事项：本文件只做接线，不含角色语义；冒烟验收是人工的，指纹
 *          与状态判据已由 tests/ 自动验收。
 */

import type { SlotName } from "@lingfan-character/contracts";
import { createCharacterRuntime } from "@lingfan-character/kernel";
import {
  BASIS_SLOT_KEYS,
  humanoidPack,
  SLOT,
} from "@lingfan-character/example-humanoid";
import { createSpeechEnvelope } from "@lingfan-character/example-humanoid/demo";
import { buildDrawPlan, draw } from "@lingfan-character/renderer-canvas2d";
import {
  isTransitionDone,
  redirect,
  transitionValue,
  type Transition,
} from "./transition";

/** 画布固定正方形：归一化坐标乘短边即可铺满，无需处理非正方形留白。 */
const STAGE = 512;

const canvas = document.querySelector<HTMLCanvasElement>("#stage");
const context = canvas?.getContext("2d");
const status = document.querySelector<HTMLElement>("#status");
if (!canvas || !context) {
  throw new Error("找不到画布或 2d 上下文，请确认 index.html 结构完整");
}

const runtime = createCharacterRuntime(humanoidPack);

/** 输入覆盖：滑杆只写这里，每帧求值时读走，不做任何缓存。 */
const overrides: Partial<Record<SlotName, number>> = {};

/**
 * 切换锚点表（06 #23）：预设与复位不直接改写覆盖值，而是生成
 * 重定向锚点，每帧把插值写进覆盖——切换永远值连续、不突兀。
 * 组合根持有锚点表；角色域只看到随时间连续变化的输入覆盖。
 */
const transitions = new Map<SlotName, Transition>();

/** 角色时间轴上的当前时刻（与 frame 的 tMs 同源）。 */
function nowTMs(): number {
  return performance.now() - (epoch ?? performance.now());
}

/**
 * 生成一次切换：目标值来自新预设（或复位回内置缺省），起点 =
 * 旧过渡当前值或现覆盖值。手动滑杆不受影响——用户意图随时压制。
 */
function beginTransition(slot: SlotName, to: number): void {
  const previous = transitions.get(slot);
  const fallback = overrides[slot] ?? DEFAULTS[slot] ?? 0;
  transitions.set(slot, redirect(previous, fallback, to, nowTMs(), "smoothstep"));
}

/** 每帧推进：过渡窗内写插值，走完固化目标值并清锚点。 */
function tickTransitions(tMs: number): void {
  for (const [slot, tr] of transitions) {
    if (isTransitionDone(tr, tMs)) {
      overrides[slot] = tr.to;
      transitions.delete(slot);
    } else {
      overrides[slot] = transitionValue(tr, tMs);
    }
  }
}

/** 五个输入槽挂滑杆：手动拖动即时生效并压制该槽的过渡锚点。 */
function wireControls(): void {
  const inputs = document.querySelectorAll<HTMLInputElement>("#panel input");
  for (const input of inputs) {
    const slot = input.dataset.param as SlotName | undefined;
    if (!slot) continue;
    const apply = () => {
      const value = Number.parseFloat(input.value);
      transitions.delete(slot);
      overrides[slot] = Number.isFinite(value) ? value : 0;
    };
    input.addEventListener("input", apply);
    apply();
  }
}

/**
 * 表情预设：基系数向量——演示基空间的组合表达，一键写入一组基槽覆盖。
 * 预设只是组合示例，不构成「表情名列表」语义；连续微调仍走基滑杆。
 */
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
const expressionButtons = document.querySelectorAll<HTMLButtonElement>(
  "#expressions button[data-expression]",
);

/** 应用预设：新旧预设涉及的槽全部走锚点过渡；null 表示全部回缺省。 */
function applyExpression(name: string | null): void {
  const involved = new Set<SlotName>(
    Object.keys(EXPRESSIONS[activeExpression ?? ""] ?? {}) as SlotName[],
  );
  activeExpression = name;
  const next = EXPRESSIONS[name ?? ""] ?? {};
  for (const slot of Object.keys(next) as SlotName[]) {
    involved.add(slot);
  }
  for (const slot of involved) {
    beginTransition(slot, next[slot] ?? DEFAULTS[slot] ?? 0);
  }
  for (const button of expressionButtons) {
    button.classList.toggle("active", button.dataset.expression === name);
  }
}

/** 表情预设与复位按钮接线：同按钮再点即取消。 */
function wireExpressions(): void {
  for (const button of expressionButtons) {
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

let epoch: number | null = null;

/**
 * 说话开关：开启时每帧把包络值写进嘴部驱动槽，关闭时撤掉覆盖。
 * 驱动值是场景→角色的入向数据，角色配方不感知「说话」概念。
 */
const speakButton = document.querySelector<HTMLButtonElement>("#speak");
const speech = createSpeechEnvelope("lip-sync-demo", 300_000);
let speaking = false;
speakButton?.addEventListener("click", () => {
  speaking = !speaking;
  speakButton.textContent = speaking ? "停止说话" : "开始说话";
  if (!speaking) {
    delete overrides[SLOT.mouthDrive];
  }
});

async function frame(now: number): Promise<void> {
  if (epoch === null) {
    epoch = now;
  }
  const tMs = now - epoch;
  tickTransitions(tMs);
  if (speaking) {
    overrides[SLOT.mouthDrive] = speech.at(tMs);
  }
  const state = await runtime.computeAt(tMs, overrides);
  const scale = Math.min(canvas.width, canvas.height);

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  const plan = buildDrawPlan(state, scale);
  draw(context, plan);
  if (status) {
    status.textContent = `t=${tMs}ms · 绘制指令 ${plan.commands.length} 条`;
  }

  requestAnimationFrame(frame);
}

wireControls();
wireExpressions();

// 首帧同步绘制：页面加载立即可见；后续帧由 requestAnimationFrame 驱动，
// 后台标签页被节流时画面静置但不会全空。
void frame(performance.now());
requestAnimationFrame(frame);
