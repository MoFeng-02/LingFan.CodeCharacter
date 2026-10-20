import type { AudioEnvelope } from "@lingfan-character/example-humanoid/demo";
import { createAudioEnvelope } from "@lingfan-character/example-humanoid/demo";

/**
 * 组合根音频驱动源：浏览器解码音频文件并持有播放元素，
 * 把播放头时间喂给预计算的能量包络。
 * 是什么：文件选择 → decodeAudioData → 能量包络 + <audio> 播放控制的封装。
 * 怎么用：load(file) 完成后 play/stop 切换，每帧用 driveValue() 询问
 *         当前驱动值——播放中返回 0..1，未播放返回 null（不接管驱动）。
 * 注意事项：decodeAudioData 与 Audio 元素是浏览器专属能力，只能住组合根；
 *          包络查询是纯函数，播放头时间即驱动时间，暂停/结束自然归零。
 */
export interface AudioSource {
  /** 解码并装载一个音频文件；装载后可播放。 */
  load(file: File): Promise<void>;
  play(): void;
  stop(): void;
  /** 播放中返回当前驱动值（0..1）；未播放返回 null。 */
  driveValue(): number | null;
  /** 注册播放自然结束的回调（UI 状态复位用）。 */
  onEnded(handler: () => void): void;
  /** 当前装载的文件名；未装载为 null。 */
  readonly loadedName: string | null;
}

export function createAudioSource(): AudioSource {
  let envelope: AudioEnvelope | null = null;
  let element: HTMLAudioElement | null = null;
  let objectUrl: string | null = null;
  let loadedName: string | null = null;
  let endedHandler: (() => void) | null = null;

  return {
    get loadedName() {
      return loadedName;
    },
    async load(file: File): Promise<void> {
      const bytes = await file.arrayBuffer();
      // AudioContext 只为解码而建，用完即关，不持有播放状态。
      const decodeContext = new AudioContext();
      const decoded = await decodeContext.decodeAudioData(bytes);
      void decodeContext.close();
      const channel = decoded.getChannelData(0);
      if (!channel) {
        throw new Error("音频无可播放声道，无法构建能量包络");
      }
      envelope = createAudioEnvelope(channel, decoded.sampleRate);
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      objectUrl = URL.createObjectURL(file);
      element?.pause();
      element = new Audio(objectUrl);
      element.addEventListener("ended", () => endedHandler?.());
      loadedName = file.name;
    },
    play(): void {
      void element?.play();
    },
    stop(): void {
      if (element) {
        element.pause();
        element.currentTime = 0;
      }
      endedHandler?.();
    },
    driveValue(): number | null {
      if (!envelope || !element || element.paused || element.ended) {
        return null;
      }
      return envelope.at(element.currentTime * 1000);
    },
    onEnded(handler: () => void): void {
      endedHandler = handler;
    },
  };
}
