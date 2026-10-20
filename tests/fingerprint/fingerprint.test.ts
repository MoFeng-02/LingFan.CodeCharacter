import type { BlendMode, CharacterState } from "@lingfan-character/contracts";
import { createCharacterRuntime } from "@lingfan-character/kernel";
import {
  NODE_ID,
  SLOT,
  humanoidPack,
} from "@lingfan-character/example-humanoid";
import {
  applyToPoint,
  buildDrawPlan,
  draw,
  fingerprint,
  scaleTransform,
  type DrawPlan,
  type DrawingContext,
  type ViewSize,
} from "@lingfan-character/renderer-canvas2d";
import { describe, expect, it } from "vitest";

/** 记录式画布替身：按调用序记录指令，验证执行层与指令流一一对应。 */
class RecordingContext implements DrawingContext {
  readonly ops: string[] = [];
  globalCompositeOperation = "";
  globalAlpha = 1;
  fillStyle = "";

  setTransform(
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
  ): void {
    this.ops.push(`setTransform ${a} ${b} ${c} ${d} ${e} ${f}`);
  }
  beginPath(): void {
    this.ops.push("beginPath");
  }
  moveTo(x: number, y: number): void {
    this.ops.push(`moveTo ${x} ${y}`);
  }
  lineTo(x: number, y: number): void {
    this.ops.push(`lineTo ${x} ${y}`);
  }
  bezierCurveTo(
    c1x: number,
    c1y: number,
    c2x: number,
    c2y: number,
    x: number,
    y: number,
  ): void {
    this.ops.push(`bezierCurveTo ${c1x} ${c1y} ${c2x} ${c2y} ${x} ${y}`);
  }
  closePath(): void {
    this.ops.push("closePath");
  }
  ellipse(x: number, y: number, rx: number, ry: number): void {
    this.ops.push(`ellipse ${x} ${y} ${rx} ${ry}`);
  }
  fill(): void {
    this.ops.push(
      `fill ${this.globalCompositeOperation} ${this.globalAlpha} ${this.fillStyle}`,
    );
  }
  clip(): void {
    this.ops.push("clip");
  }
  save(): void {
    this.ops.push("save");
  }
  restore(): void {
    this.ops.push("restore");
  }
  transform(
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
  ): void {
    this.ops.push(`transform ${a} ${b} ${c} ${d} ${e} ${f}`);
  }
  rect(x: number, y: number, width: number, height: number): void {
    this.ops.push(`rect ${x} ${y} ${width} ${height}`);
  }
  drawImage(
    _image: CanvasImageSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void {
    this.ops.push(`drawImage ${sx} ${sy} ${sw} ${sh} ${dx} ${dy} ${dw} ${dh}`);
  }
}

const SCALE = 400;

async function planAt(
  t: number,
  overrides?: Record<string, number>,
): Promise<DrawPlan> {
  const runtime = createCharacterRuntime(humanoidPack);
  return buildDrawPlan(await runtime.computeAt(t, overrides), SCALE);
}

describe("canvas2d 渲染器", () => {
  it("同一时刻完整链路两遍编译，指纹逐字节一致", async () => {
    expect(await planAt(1234).then(fingerprint)).toBe(
      await planAt(1234).then(fingerprint),
    );
  });

  it("同一状态对象两遍编译指纹一致（编译层自身确定性）", async () => {
    const runtime = createCharacterRuntime(humanoidPack);
    const state: CharacterState = await runtime.computeAt(0);
    expect(fingerprint(buildDrawPlan(state, SCALE))).toBe(
      fingerprint(buildDrawPlan(state, SCALE)),
    );
  });

  it("参数与时间的变化都会改变指纹", async () => {
    const neutral = await planAt(0);
    const smiling = await planAt(0, { [SLOT.smile]: 1 });
    const blinkPeak = await planAt(2220);
    expect(fingerprint(neutral)).not.toBe(fingerprint(smiling));
    expect(fingerprint(neutral)).not.toBe(fingerprint(blinkPeak));
  });

  it("指令条数等于各节点基元之和，顺序即 zOrder 展开序", async () => {
    const runtime = createCharacterRuntime(humanoidPack);
    const state = await runtime.computeAt(0);
    const plan = buildDrawPlan(state, SCALE);
    const total = state.zOrder.reduce(
      (sum, nodeId) => sum + state.nodes[nodeId]!.primitives.length,
      0,
    );
    expect(plan.commands).toHaveLength(total);
    expect(plan.coordinateSpace).toBe(state.coordinateSpace);
  });

  it("画布缩放只进矩阵不进形状坐标（双重缩放回归防线）", async () => {
    const runtime = createCharacterRuntime(humanoidPack);
    const state = await runtime.computeAt(0);
    const small = buildDrawPlan(state, 100);
    const large = buildDrawPlan(state, 200);
    expect(large.commands[0]!.transform[4]).toBe(
      small.commands[0]!.transform[4]! * 2,
    );
    expect(large.commands[0]!.shape.kind).toBe(small.commands[0]!.shape.kind);
    const smallShape = small.commands[0]!.shape;
    const largeShape = large.commands[0]!.shape;
    if (smallShape.kind === "ellipse" && largeShape.kind === "ellipse") {
      // 形状坐标保持归一化：不同缩放下必须完全一致，缩放只在矩阵里。
      expect(largeShape.cx).toBe(smallShape.cx);
      expect(largeShape.cy).toBe(smallShape.cy);
      expect(largeShape.rx).toBe(smallShape.rx);
      expect(largeShape.ry).toBe(smallShape.ry);
    } else if (smallShape.kind === "path" && largeShape.kind === "path") {
      const smallPath = smallShape.commands[0];
      const largePath = largeShape.commands[0];
      expect(largePath?.kind === "moveTo" && smallPath?.kind === "moveTo").toBe(
        true,
      );
      expect(largePath?.kind === "moveTo" ? largePath.x : 0).toBe(
        smallPath?.kind === "moveTo" ? smallPath.x : Number.NaN,
      );
    } else {
      expect.unreachable("缩放判据只针对椭圆与路径两种形状");
    }
  });

  it("变换矩阵作用于形状中心必须落在画布内（空间语义判据）", async () => {
    const plan = await planAt(0);
    expect(plan.commands.length).toBeGreaterThan(0);
    for (const command of plan.commands) {
      const [a, b, c, d, e, f] = command.transform;
      // 取形状自身中心作为探针点：椭圆用真实中心，路径用归一化画布中心近似。
      const px0 = command.shape.kind === "ellipse" ? command.shape.cx : 0.5;
      const py0 = command.shape.kind === "ellipse" ? command.shape.cy : 0.5;
      const pixelX = a * px0 + c * py0 + e;
      const pixelY = b * px0 + d * py0 + f;
      expect(pixelX).toBeGreaterThan(0);
      expect(pixelX).toBeLessThan(SCALE);
      expect(pixelY).toBeGreaterThan(0);
      expect(pixelY).toBeLessThan(SCALE);
    }
  });

  it("normal 混合映射为 source-over，fillStyle 按 rgba 整数格式", async () => {
    const plan = await planAt(0);
    expect(plan.commands[0]!.composite).toBe("source-over");
    const runtime = createCharacterRuntime(humanoidPack);
    const state = await runtime.computeAt(0);
    const tint = state.nodes[NODE_ID.hairBack]!.primitives[0]!.tint;
    expect(plan.commands[0]!.fillStyle).toBe(
      `rgba(${Math.round(tint.r * 255)},${Math.round(tint.g * 255)},${Math.round(tint.b * 255)},${tint.a})`,
    );
  });

  it("契约外的混合模式必须报错而非静默忽略", async () => {
    const runtime = createCharacterRuntime(humanoidPack);
    const state = await runtime.computeAt(0);
    const firstNode = state.nodes[NODE_ID.hairBack]!;
    const tampered: CharacterState = {
      ...state,
      nodes: {
        ...state.nodes,
        [NODE_ID.hairBack]: {
          ...firstNode,
          primitives: firstNode.primitives.map((prim, index) =>
            index === 0
              ? { ...prim, blend: "radial" as unknown as BlendMode }
              : prim,
          ),
        },
      },
    };
    expect(() => buildDrawPlan(tampered, SCALE)).toThrow();
  });

  it("执行层逐条照抄指令流：样式与矩阵与计划一致", async () => {
    const plan = await planAt(0);
    const context = new RecordingContext();
    draw(context, plan);
    const fills = context.ops.filter((op) => op.startsWith("fill "));
    expect(fills).toHaveLength(plan.commands.length);
    plan.commands.forEach((command, index) => {
      expect(fills[index]).toBe(
        `fill ${command.composite} ${command.opacity} ${command.fillStyle}`,
      );
    });
  });

  it("分轴画幅与等比缩放口径一致：数字入参仍是等比矩阵", () => {
    // 历史口径零变化：传数字时 x、y 同倍率，指纹与单标量缩放逐字节相同。
    expect(scaleTransform(SCALE)).toEqual({
      a: SCALE,
      b: 0,
      c: 0,
      d: SCALE,
      e: 0,
      f: 0,
    });
    expect(scaleTransform(SCALE)).toEqual(
      scaleTransform({ width: SCALE, height: SCALE }),
    );
  });

  it("分轴画幅把归一化角点送到画布对角（竖图不再被拉成方的）", () => {
    const view: ViewSize = { width: 337, height: 512 };
    const matrix = scaleTransform(view);
    // 归一化域的两个角点必须精确落到画布的两端，中间不留白也不溢出。
    expect(applyToPoint(matrix, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(applyToPoint(matrix, { x: 1, y: 1 })).toEqual({ x: 337, y: 512 });
  });

  it("画幅入参进入指令矩阵且形状坐标保持归一化", async () => {
    const runtime = createCharacterRuntime(humanoidPack);
    const state: CharacterState = await runtime.computeAt(0);
    const view: ViewSize = { width: 337, height: 512 };
    const plan = buildDrawPlan(state, view);
    const uniform = buildDrawPlan(state, SCALE);
    const first = plan.commands[0]!;
    const base = uniform.commands[0]!;
    // 画幅只改缩放矩阵：横纵系数按画幅与等比值的比例变化。
    expect(first.transform[0]).toBeCloseTo(
      (base.transform[0]! * view.width) / SCALE,
      12,
    );
    expect(first.transform[3]).toBeCloseTo(
      (base.transform[3]! * view.height) / SCALE,
      12,
    );
    // 竖画幅的横纵比例即画幅比例：这正是「不再被拉成方的」的量化表述。
    expect(first.transform[0]! / first.transform[3]!).toBeCloseTo(
      view.width / view.height,
      12,
    );
    // 形状仍按归一化声明：换画幅只改矩阵，不改形状。
    expect(first.shape).toEqual(base.shape);
  });
});
