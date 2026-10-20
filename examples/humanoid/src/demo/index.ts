/**
 * 演示资产出口：说话包络合成器与音频能量包络。仅组合根冒烟使用，
 * 不属于包的配方语义；两者对角色域同形，驱动源可互换。
 */
export { createSpeechEnvelope } from "./speechEnvelope";
export type { SpeechEnvelope } from "./speechEnvelope";
export { createAudioEnvelope } from "./audioEnvelope";
export type { AudioEnvelope, AudioEnvelopeOptions } from "./audioEnvelope";
