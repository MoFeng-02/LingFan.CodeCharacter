/**
 * 模式切换与纹理注册：四种配方共用同一求值循环，切换只改配方、
 * 采样分支与面板可见性。纹理注册表住组合根——纹理是宿主资源，
 * 不进状态向量；网格形变仍是纯函数（tests 已验收）。
 */

import { createCharacterRuntime } from "@lingfan-character/kernel";
import { humanoidPack } from "@lingfan-character/example-humanoid";
import {
  portraitPack,
  TEXTURE_ID as PORTRAIT_TEXTURE,
} from "@lingfan-character/example-portrait";
import { bust3dPack } from "@lingfan-character/example-bust3d";
import { layeredPack } from "@lingfan-character/example-layered";
import {
  CLOSED_TEXTURE_ID,
  EYE_SLITS,
  riggedPortraitPack,
} from "@lingfan-character/example-rigged-portrait";
import type {
  TextureResource,
  ViewSize,
} from "@lingfan-character/renderer-canvas2d";
import { buildClosedEyesTexture } from "./closedEyes";
import { RIGGED_TEXTURE_ID } from "./placeholderRigged";
import { setStageSize } from "./stage";

export type Mode = "humanoid" | "portrait" | "bust3d" | "layered" | "rigged";

const humanoidRuntime = createCharacterRuntime(humanoidPack);
const portraitRuntime = createCharacterRuntime(portraitPack);
const bust3dRuntime = createCharacterRuntime(bust3dPack);
const layeredRuntime = createCharacterRuntime(layeredPack);
const riggedRuntime = createCharacterRuntime(riggedPortraitPack);

let mode: Mode = "humanoid";

/** 当前活动模式（帧循环据此选配方与采样分支）。 */
export function currentMode(): Mode {
  return mode;
}

/** 当前模式对应的求值运行时。 */
export function runtimeFor(target: Mode): ReturnType<typeof createCharacterRuntime> {
  if (target === "portrait") {
    return portraitRuntime;
  }
  if (target === "bust3d") {
    return bust3dRuntime;
  }
  if (target === "layered") {
    return layeredRuntime;
  }
  if (target === "rigged") {
    return riggedRuntime;
  }
  return humanoidRuntime;
}

const textures = new Map<string, TextureResource>();

/** 纹理解析器：交给渲染执行层的可选第三参。 */
export function resolveTexture(id: string): TextureResource | undefined {
  return textures.get(id);
}

/** 登记一张宿主纹理：分层占位图与用户选图都经此入库。 */
export function registerTexture(id: string, resource: TextureResource): void {
  textures.set(id, resource);
}

/** 该纹理是否已登记：重复引导时跳过重绘。 */
export function textureRegistered(id: string): boolean {
  return textures.has(id);
}

/** 需要纹理解析的模式：素材轨配方产网格，执行层必须查资源表。 */
export function needsTexture(target: Mode): boolean {
  return target === "portrait" || target === "layered" || target === "rigged";
}

/** 画幅长边：短边按素材宽高比推导，保证不裁切也不留白。 */
const LONG_EDGE = 512;

/** 该模式对应的整图纹理标识：分层模式各层自带局部矩形，不参与画幅推导。 */
function wholeImageTextureId(target: Mode): string | undefined {
  if (target === "portrait") return PORTRAIT_TEXTURE;
  if (target === "rigged") return RIGGED_TEXTURE_ID;
  return undefined;
}

/**
 * 推导当前模式的画幅：整图纹理按素材宽高比取长边 512，
 * 其余模式（程序角色、立体半身、分层立绘、或纹理缺失）保持方形画幅。
 */
export function viewFor(target: Mode): ViewSize {
  const id = wholeImageTextureId(target);
  const resource = id ? textures.get(id) : undefined;
  if (!resource || resource.width <= 0 || resource.height <= 0) {
    return { width: LONG_EDGE, height: LONG_EDGE };
  }
  const aspect = resource.width / resource.height;
  if (aspect >= 1) {
    return { width: LONG_EDGE, height: Math.max(1, Math.round(LONG_EDGE / aspect)) };
  }
  return { width: Math.max(1, Math.round(LONG_EDGE * aspect)), height: LONG_EDGE };
}

/** 把当前模式的画幅落实到画布：换模式或换图后立刻生效。 */
export function applyStageView(): void {
  const view = viewFor(mode);
  setStageSize(view.width, view.height);
}

/** 程序占位立绘：未选择图片时的可视基线，离屏画布现场生成。 */
export function ensurePlaceholderTexture(): void {
  if (textures.has(PORTRAIT_TEXTURE)) return;
  const offscreen = document.createElement("canvas");
  offscreen.width = 512;
  offscreen.height = 512;
  const pen = offscreen.getContext("2d");
  if (!pen) return;
  const base = pen.createLinearGradient(0, 0, 0, 512);
  base.addColorStop(0, "#20262e");
  base.addColorStop(1, "#2c343e");
  pen.fillStyle = base;
  pen.fillRect(0, 0, 512, 512);
  pen.fillStyle = "#d9c4a5";
  pen.beginPath();
  pen.ellipse(256, 240, 96, 128, 0, 0, Math.PI * 2);
  pen.fill();
  pen.fillStyle = "#8fa3b8";
  pen.beginPath();
  pen.ellipse(256, 430, 150, 110, 0, 0, Math.PI * 2);
  pen.fill();
  pen.fillStyle = "#aab6c2";
  pen.font = "16px sans-serif";
  pen.textAlign = "center";
  pen.fillText("程序占位立绘 · 请选择图片", 256, 496);
  textures.set(PORTRAIT_TEXTURE, { image: offscreen, width: 512, height: 512 });
}

/**
 * 登记单图蒙皮的两张纹理：开眼图与由它派生的闭眼图。
 *
 * 为什么成对登记：配方按眨眼量在两层之间交叉淡入，缺任一张都会让另一态
 * 无法显示。闭眼图由开眼图派生，两张除眼区外逐像素相同，淡入只影响眼区。
 */
export function registerRiggedTextures(source: TextureResource): void {
  registerTexture(RIGGED_TEXTURE_ID, source);
  registerTexture(CLOSED_TEXTURE_ID, buildClosedEyesTexture(source, EYE_SLITS));
}

/**
 * 接管一张真实立绘：素材立绘与单图蒙皮共用同一张图。
 *
 * 为什么共用：两个模式都是「一张完整立绘 + 形变」，用户的直觉是
 * 「选了图，两个模式都换」。分层模式不能用——它按层提供局部矩形。
 */
export function adoptPortraitImage(resource: TextureResource): void {
  registerTexture(PORTRAIT_TEXTURE, resource);
  registerRiggedTextures(resource);
  applyStageView();
}

/** 模式按钮与各面板显隐接线，含立绘图片文件选择。 */
export function wireModes(): void {
  const modeButtons = document.querySelectorAll<HTMLButtonElement>("#modes button");
  const humanoidSections = [
    document.querySelector<HTMLElement>("#panel"),
    document.querySelector<HTMLElement>("#expressions"),
  ];

  function setMode(next: Mode): void {
    mode = next;
    for (const button of modeButtons) {
      button.classList.toggle("active", button.dataset.mode === next);
    }
    for (const section of humanoidSections) {
      section?.classList.toggle("hidden", next !== "humanoid");
    }
    document
      .querySelector<HTMLElement>("#panel-portrait")
      ?.classList.toggle("hidden", next !== "portrait");
    document
      .querySelector<HTMLElement>("#panel-bust3d")
      ?.classList.toggle("hidden", next !== "bust3d");
    document
      .querySelector<HTMLElement>("#panel-layered")
      ?.classList.toggle("hidden", next !== "layered");
    document
      .querySelector<HTMLElement>("#panel-rigged")
      ?.classList.toggle("hidden", next !== "rigged");
    applyStageView();
  }

  for (const button of modeButtons) {
    button.addEventListener("click", () => {
      const next = button.dataset.mode as Mode | undefined;
      if (next) setMode(next);
    });
  }

  wireImagePicker("#portrait-file");
  wireImagePicker("#rigged-file");
}

/** 图片选择框接线：解码成功后同时接管素材立绘与单图蒙皮两张纹理。 */
function wireImagePicker(selector: string): void {
  document
    .querySelector<HTMLInputElement>(selector)
    ?.addEventListener("change", async (event) => {
      const input = event.currentTarget as HTMLInputElement | null;
      const file = input?.files?.[0];
      if (!file) return;
      try {
        const bitmap = await createImageBitmap(file);
        adoptPortraitImage({
          image: bitmap,
          width: bitmap.width,
          height: bitmap.height,
        });
      } catch (error) {
        console.error("立绘解码失败", error);
      }
    });
}
