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
import { humanoidPack, SLOT } from "@lingfan-character/pack-humanoid";
import { buildDrawPlan, draw } from "@lingfan-character/renderer-canvas2d";

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

/** 五个输入槽挂滑杆：值实时写入 overrides，渲染循环天然感知。 */
function wireControls(): void {
  const inputs = document.querySelectorAll<HTMLInputElement>("#panel input");
  for (const input of inputs) {
    const slot = input.dataset.param as SlotName | undefined;
    if (!slot) continue;
    const apply = () => {
      const value = Number.parseFloat(input.value);
      overrides[slot] = Number.isFinite(value) ? value : 0;
    };
    input.addEventListener("input", apply);
    apply();
  }
}

let epoch: number | null = null;

async function frame(now: number): Promise<void> {
  if (epoch === null) {
    epoch = now;
  }
  const tMs = now - epoch;
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

// 首帧同步绘制：页面加载立即可见；后续帧由 requestAnimationFrame 驱动，
// 后台标签页被节流时画面静置但不会全空。
void frame(performance.now());
requestAnimationFrame(frame);
