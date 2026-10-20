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
import { riggedPortraitPack } from "@lingfan-character/example-rigged-portrait";
import type { TextureResource } from "@lingfan-character/renderer-canvas2d";

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
  }

  for (const button of modeButtons) {
    button.addEventListener("click", () => {
      const next = button.dataset.mode as Mode | undefined;
      if (next) setMode(next);
    });
  }

  document
    .querySelector<HTMLInputElement>("#portrait-file")
    ?.addEventListener("change", async (event) => {
      const input = event.currentTarget as HTMLInputElement | null;
      const file = input?.files?.[0];
      if (!file) return;
      try {
        const bitmap = await createImageBitmap(file);
        registerTexture(PORTRAIT_TEXTURE, {
          image: bitmap,
          width: bitmap.width,
          height: bitmap.height,
        });
      } catch (error) {
        console.error("立绘解码失败", error);
      }
    });
}
