/**
 * 帧循环与启动引导：每个动画帧由 computeAt 现场求值 state(t)，
 * 立体模式先经 2D 采样器编译回既有指令流，渲染器逐条执行。
 * 这里只做编排——状态、接线与驱动源都在兄弟模块。
 */

import { sampleState } from "@lingfan-character/renderer-soft-raster";
import { buildDrawPlan, draw } from "@lingfan-character/renderer-canvas2d";
import { mouthDriveSource, tickMouthDrive, wireAudio } from "./audio";
import { ensureEpoch, nowTMs } from "./clock";
import { wireExpressions } from "./expressions";
import {
  adoptPortraitImage,
  applyStageView,
  currentMode,
  ensurePlaceholderTexture,
  needsTexture,
  registerRiggedTextures,
  resolveTexture,
  runtimeFor,
  wireModes,
} from "./modes";
import {
  overrides,
  tickTransitions,
  wireControls,
} from "./overrides";
import { ensureLayeredTextures } from "./placeholderLayers";
import { createRiggedTexture } from "./placeholderRigged";
import { ctx, drawingTarget, stage, status } from "./stage";

async function frame(now: number): Promise<void> {
  ensureEpoch(now);
  const tMs = nowTMs();
  tickTransitions(tMs);
  tickMouthDrive();
  const mode = currentMode();
  let state = await runtimeFor(mode).computeAt(tMs, overrides);
  if (mode === "bust3d") {
    // 立体模式：几何求值后经 2D 采样器编译成既有指令流——执行层与
    // 指纹机器零改动，转头效果来自视角重采样而非平面位移。
    state = sampleState(state);
  }
  // 画幅与素材宽高比一致：归一化方域 [0,1]² 按画布宽高分轴缩放。
  // 单标量缩放下非方形素材会被拉成方形，分轴后横纵比例才等于素材本身。
  const view = { width: stage.width, height: stage.height };

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, stage.width, stage.height);
  const plan = buildDrawPlan(state, view);
  draw(
    drawingTarget,
    plan,
    needsTexture(mode) ? resolveTexture : undefined,
  );
  if (status) {
    status.textContent = `t=${tMs}ms · 绘制指令 ${plan.commands.length} 条 · 嘴驱动=${mouthDriveSource()}`;
  }

  requestAnimationFrame(frame);
}

/** 单图蒙皮的占位立绘：只在首次引导时绘制一次，开眼闭眼成对登记。 */
function ensureRiggedTexture(): void {
  registerRiggedTextures(createRiggedTexture());
}

/**
 * 引导默认立绘：本机有 out/assets/portrait.webp 时自动接管，
 * 让「素材立绘 / 单图蒙皮」一进来就是真人画。
 *
 * 为什么静默失败：out/ 整个目录不进版本库，新克隆必然没有这张图，
 * 此时必须优雅退回程序占位图，不能因为缺资产让页面白屏。
 */
async function loadDefaultPortrait(): Promise<void> {
  try {
    const response = await fetch("./assets/portrait.webp");
    if (!response.ok) return;
    const bitmap = await createImageBitmap(await response.blob());
    adoptPortraitImage({
      image: bitmap,
      width: bitmap.width,
      height: bitmap.height,
    });
  } catch {
    // 素材不存在或解码失败：保留占位图，用户仍可从面板自选图片。
  }
}

/** 组合根引导：接好全部面板与驱动源，首帧同步绘制后进入帧循环。 */
export function boot(): void {
  wireControls();
  wireExpressions();
  wireAudio();
  wireModes();
  ensurePlaceholderTexture();
  ensureLayeredTextures();
  ensureRiggedTexture();
  applyStageView();

  // 默认立绘在后台加载：先让程序占位图出现在首帧，图片就绪后下一帧
  // 自然换图并同步画幅（applyStageView 已在 adoptPortraitImage 内调用）。
  void loadDefaultPortrait();

  // 首帧同步绘制：页面加载立即可见；后续帧由 requestAnimationFrame 驱动，
  // 后台标签页被节流时画面静置但不会全空。
  void frame(performance.now());
  requestAnimationFrame(frame);
}
