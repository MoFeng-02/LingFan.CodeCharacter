import { applyEasing } from "@lingfan-character/primitives";
import type { SpeechEnvelope } from "./speechEnvelope";

/**
 * 音频能量包络：把真实音频的 PCM 采样变换成 0..1 开口度驱动值序列。
 * 与合成包络（speechEnvelope）同形——同样以 at(tMs) 回答「此刻嘴张多大」，
 * 角色域不感知驱动源是程序合成还是真实录音。
 *
 * 是什么：分帧 RMS 能量 → 峰值归一化 → 弱语音增强 → 分段线性包络。
 * 怎么用：createAudioEnvelope(samples, sampleRate) 一次建表，循环里 at(tMs) 查询；
 *         包络为预计算纯数据，任意两遍构建对同一 PCM 结果逐字节一致。
 * 注意事项：RMS 用到的 sqrt 属 IEEE 754 强制正确舍入运算，跨引擎逐字节一致
 *          （指数与三角函数无此保证，故不在此使用）；纯静音输入不会除零，
 *          语义即「始终闭嘴」；音频结束后驱动值线性衰减归零，避免突然闭口。
 */
export interface AudioEnvelope extends SpeechEnvelope {
  /** 音频时长（毫秒），超过后 at 恒为 0。 */
  durationMs: number;
}

export interface AudioEnvelopeOptions {
  /** 能量帧长（毫秒），缺省 20——与人耳感知语音响度的时间粒度同级。 */
  frameMs?: number;
}

export function createAudioEnvelope(
  samples: Float32Array,
  sampleRate: number,
  options: AudioEnvelopeOptions = {},
): AudioEnvelope {
  if (samples.length === 0) {
    throw new RangeError("音频采样为空，无法构建能量包络");
  }
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new RangeError(`采样率必须为正数，收到 ${sampleRate}`);
  }
  const frameMs = options.frameMs ?? 20;
  const frameLength = Math.max(1, Math.round((frameMs / 1000) * sampleRate));
  const frameCount = Math.floor(samples.length / frameLength);

  // 分帧均方根能量：帧不重叠，帧值代表该帧内的平均响度。
  const frames = new Float64Array(frameCount);
  let peak = 0;
  for (let i = 0; i < frameCount; i++) {
    let sum = 0;
    const base = i * frameLength;
    for (let j = 0; j < frameLength; j++) {
      const x = samples[base + j]!;
      sum += x * x;
    }
    const rms = Math.sqrt(sum / frameLength);
    frames[i] = rms;
    if (rms > peak) {
      peak = rms;
    }
  }

  // 峰值归一化后用 easeOutQuad 提升弱语音的开口度可读性；
  // 纯静音（peak 为 0）不除零，直接全零包络。
  const nodeValues = new Float64Array(frameCount);
  for (let i = 0; i < frameCount; i++) {
    const norm = peak === 0 ? 0 : frames[i]! / peak;
    nodeValues[i] = applyEasing("easeOutQuad", Math.min(1, Math.max(0, norm)));
  }

  const durationMs = (frameCount * frameLength * 1000) / sampleRate;
  const lastNodeMs = (frameCount - 0.5) * frameMs;

  return {
    durationMs,
    at(tMs: number): number {
      if (tMs <= 0 || frameCount === 0) {
        return 0;
      }
      // 插值节点取帧中心：帧值是帧的代表能量，节点间线性过渡。
      const p = tMs / frameMs - 0.5;
      const index = Math.floor(p);
      if (index < 0) {
        return nodeValues[0]!;
      }
      if (index >= frameCount - 1) {
        const last = nodeValues[frameCount - 1]!;
        if (tMs >= durationMs) {
          return 0;
        }
        if (tMs <= lastNodeMs) {
          return last;
        }
        // 末节点到音频结束：线性衰减到零，闭口不突兀。
        const tail = (durationMs - tMs) / (durationMs - lastNodeMs);
        return last * Math.max(0, tail);
      }
      const frac = p - index;
      return nodeValues[index]! * (1 - frac) + nodeValues[index + 1]! * frac;
    },
  };
}
