/**
 * 嘴部驱动源：合成包络（按钮开关）与音频文件（播放即驱动）互斥，
 * 音频播放优先——两者都只是场景→角色的入向 0..1 数据，角色配方
 * 不感知「说话」概念，也不知道驱动源是程序合成还是真实录音。
 */

import { SLOT } from "@lingfan-character/example-humanoid";
import { createSpeechEnvelope } from "@lingfan-character/example-humanoid/demo";
import { createAudioSource } from "../audioSource";
import { nowTMs } from "./clock";
import { overrides } from "./overrides";

const speech = createSpeechEnvelope("lip-sync-demo", 300_000);
const audio = createAudioSource();
let speaking = false;

function setSpeaking(value: boolean): void {
  speaking = value;
  const speakButton = document.querySelector<HTMLButtonElement>("#speak");
  if (speakButton) {
    speakButton.textContent = value ? "停止说话" : "开始说话";
  }
  if (!value) {
    delete overrides[SLOT.mouthDrive];
  }
}

/** 当前帧的嘴部驱动值；null 表示无驱动（由帧循环清掉覆盖）。 */
function mouthDriveValue(): number | null {
  const audioDrive = audio.driveValue();
  if (audioDrive !== null) {
    return audioDrive;
  }
  return speaking ? speech.at(nowTMs()) : null;
}

/** 状态行文案：当前嘴部驱动来自哪里。 */
export function mouthDriveSource(): string {
  if (audio.driveValue() !== null) {
    return "音频";
  }
  return speaking ? "合成" : "无";
}

/** 每帧把嘴部驱动写进覆盖表（无驱动时清除），供 mouthDrive 节点读取。 */
export function tickMouthDrive(): void {
  const drive = mouthDriveValue();
  if (drive !== null) {
    overrides[SLOT.mouthDrive] = drive;
  } else {
    delete overrides[SLOT.mouthDrive];
  }
}

/** 音频与说话按钮接线。 */
export function wireAudio(): void {
  const audioFile = document.querySelector<HTMLInputElement>("#audio-file");
  const audioPlay = document.querySelector<HTMLButtonElement>("#audio-play");

  audioFile?.addEventListener("change", async () => {
    const file = audioFile.files?.[0];
    if (!file || !audioPlay) return;
    audioPlay.disabled = true;
    try {
      await audio.load(file);
    } catch (error) {
      audioPlay.textContent = "解码失败";
      console.error(error);
      return;
    }
    audioPlay.disabled = false;
    audioPlay.textContent = "播放音频";
  });

  audio.onEnded(() => {
    if (audioPlay) {
      audioPlay.textContent = "播放音频";
    }
  });

  audioPlay?.addEventListener("click", () => {
    if (!audio.loadedName) return;
    setSpeaking(false);
    if (audio.driveValue() !== null) {
      audio.stop();
      audioPlay.textContent = "播放音频";
    } else {
      audio.play();
      audioPlay.textContent = "停止音频";
    }
  });

  document.querySelector<HTMLButtonElement>("#speak")?.addEventListener("click", () => {
    audio.stop();
    setSpeaking(!speaking);
  });
}
