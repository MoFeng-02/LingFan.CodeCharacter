import {
  applyEasing,
  createSubstream,
  deriveSeed,
  evaluateNoise,
} from "@lingfan-character/primitives";

/**
 * 说话包络合成器：把「语音的时间结构」程序化成 0..1 驱动值序列。
 * 结构模型：词 = 2~4 个音节脉冲（上升 40% / 下降 60% 的缓动段），
 * 音节间微歇、词间停顿、语调用慢速噪声调幅。与真实音频的接入位同形：
 * 真音频由场景侧解码 PCM 分帧能量后产出同形包络，角色域永远只吃 0..1 数值。
 */
export interface SpeechEnvelope {
  at(tMs: number): number;
}

type Segment = {
  start: number;
  end: number;
  peak: number;
  kind: "rise" | "fall";
};

export function createSpeechEnvelope(
  seed: string,
  durationMs: number,
): SpeechEnvelope {
  const sub = createSubstream(deriveSeed(seed, "speech-envelope"));
  const segments: Segment[] = [];
  let cursor = 400;
  while (cursor < durationMs) {
    const syllables = 2 + Math.floor(sub.next() * 3);
    for (let i = 0; i < syllables && cursor < durationMs; i++) {
      const peak = 0.55 + sub.next() * 0.45;
      const dur = 120 + sub.next() * 140;
      const riseEnd = cursor + dur * 0.4;
      segments.push({ start: cursor, end: riseEnd, peak, kind: "rise" });
      segments.push({
        start: riseEnd,
        end: riseEnd + dur * 0.6,
        peak,
        kind: "fall",
      });
      cursor = riseEnd + dur * 0.6 + 30 + sub.next() * 50;
    }
    cursor += 150 + sub.next() * 270;
  }

  const prosody = createSubstream(deriveSeed(seed, "speech-prosody"));
  return {
    at(tMs: number): number {
      if (tMs <= 0) return 0;
      let lo = 0;
      let hi = segments.length - 1;
      let found = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const seg = segments[mid]!;
        if (tMs < seg.start) hi = mid - 1;
        else if (tMs > seg.end) lo = mid + 1;
        else {
          found = mid;
          break;
        }
      }
      const envelope =
        found < 0
          ? 0
          : (() => {
              const seg = segments[found]!;
              const phase = (tMs - seg.start) / (seg.end - seg.start);
              return seg.kind === "rise"
                ? applyEasing("easeOutCubic", phase) * seg.peak
                : (1 - applyEasing("easeInCubic", phase)) * seg.peak;
            })();
      const swell =
        0.72 +
        0.28 *
          evaluateNoise(
            { octaves: 2, frequency: 0.0009, lacunarity: 2, gain: 0.5 },
            tMs,
            prosody,
          );
      return Math.min(1, Math.max(0, envelope * swell));
    },
  };
}
