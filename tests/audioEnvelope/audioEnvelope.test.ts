import { createAudioEnvelope } from "@lingfan-character/example-humanoid/demo";
import { describe, expect, it } from "vitest";

/**
 * 音频能量包络判据。构造用恒值 PCM：帧内恒值 x 的 RMS 恰为 |x|，
 * 期望值可手算；峰值归一化后经 easeOutQuad（1-(1-x)^2）整形。
 */
describe("音频能量包络", () => {
  const RATE = 48_000;
  const FRAME_MS = 20;
  /** 缺省帧长的采样点数：20ms × 48kHz = 960。 */
  const FRAME = 960;

  function constantPcm(frames: number, value: number): Float32Array {
    const samples = new Float32Array(frames * FRAME);
    samples.fill(value);
    return samples;
  }

  it("空采样与非法采样率显式报错", () => {
    expect(() => createAudioEnvelope(new Float32Array(0), RATE)).toThrow(
      RangeError,
    );
    expect(() => createAudioEnvelope(constantPcm(2, 0.5), 0)).toThrow(
      RangeError,
    );
  });

  it("恒幅音频归一化后包络恒为满值", () => {
    const envelope = createAudioEnvelope(constantPcm(10, 0.5), RATE);
    // 每帧 RMS = 0.5，峰值归一化 = 1，easeOutQuad(1) = 1。
    expect(envelope.durationMs).toBe(200);
    expect(envelope.at(10)).toBe(1);
    expect(envelope.at(150)).toBe(1);
    expect(envelope.at(185)).toBe(1);
  });

  it("纯静音包络恒为零且无 NaN", () => {
    const envelope = createAudioEnvelope(constantPcm(10, 0), RATE);
    for (const t of [1, 50, 100, 199]) {
      expect(envelope.at(t)).toBe(0);
      expect(Number.isNaN(envelope.at(t))).toBe(false);
    }
  });

  it("能量大小关系保持：响的段包络值更大", () => {
    // 前半 0.25、后半 0.5：峰值 0.5，归一化 0.5 与 1，
    // easeOutQuad(0.5) = 1 - 0.25 = 0.75。
    const samples = new Float32Array(4 * FRAME);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = i < 2 * FRAME ? 0.25 : 0.5;
    }
    const envelope = createAudioEnvelope(samples, RATE);
    expect(envelope.at(10)).toBeCloseTo(0.75, 12);
    expect(envelope.at(70)).toBe(1);
  });

  it("帧间线性插值：相邻节点中点取均值", () => {
    // 两帧（0.25 与 0.5 恒值）：节点在 10ms 与 30ms，值 0.75 与 1。
    const samples = new Float32Array(2 * FRAME);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = i < FRAME ? 0.25 : 0.5;
    }
    const envelope = createAudioEnvelope(samples, RATE);
    expect(envelope.at(20)).toBeCloseTo(0.875, 12);
  });

  it("边界外归零：起点前与音频结束后驱动值为零", () => {
    const envelope = createAudioEnvelope(constantPcm(10, 0.5), RATE);
    expect(envelope.at(-1)).toBe(0);
    expect(envelope.at(0)).toBe(0);
    expect(envelope.at(200)).toBe(0);
    expect(envelope.at(1_000)).toBe(0);
  });

  it("尾部线性衰减：末节点满值、结束点归零、中间单调下降", () => {
    const envelope = createAudioEnvelope(constantPcm(10, 0.5), RATE);
    const lastNode = 9.5 * FRAME_MS;
    expect(envelope.at(lastNode)).toBe(1);
    expect(envelope.at((lastNode + 200) / 2)).toBeCloseTo(0.5, 12);
    expect(envelope.at(199)).toBeLessThan(envelope.at(196));
  });

  it("同一 PCM 两遍构建逐字节一致", () => {
    const samples = constantPcm(8, 0.4);
    const a = createAudioEnvelope(samples, RATE);
    const b = createAudioEnvelope(samples, RATE);
    for (let t = 0; t <= 160; t += 3) {
      expect(a.at(t)).toBe(b.at(t));
    }
  });
});
