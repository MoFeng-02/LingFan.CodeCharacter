/**
 * 层外观节点：每层一个节点，把静止网格按形变场变换后产出一条网格基元。
 *
 * 是什么：由层规格表机械生成的十二个节点，各自读取形变场参数槽位，
 *         调用同一个形变组合器，产出带本层纹理标识的 MeshPrimitive。
 * 为什么：层节点必须是「同一模板的十二个实例」而不是十二份手写实现——
 *         任何一层手写都可能漏掉共享场，那正是撕裂的来源；模板化让
 *         「所有层走同一入口」成为结构事实而非纪律要求。
 * 怎么用：内核按拓扑序在参数节点之后求各层节点，产出绘制序即声明序。
 * 注意事项：节点产出的基元数组长度恒为 1；transform 保持单位矩阵——
 *          位移已全部落在顶点坐标里，再叠矩阵会二次变换。
 */

import type {
  MeshPrimitive,
  NodeDeclaration,
  NormalizedPoint,
  RenderPrimitive,
} from "@lingfan-character/contracts";
import { deformLayer, type LocalParams } from "./field";
import { restLayer } from "./layers";
import {
  FIELD_SLOT,
  LAYER_SPECS,
  SLOT,
  layerNodeId,
  type LayerSpec,
} from "./shared";

const IDENTITY = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } as const;
const WHITE = { r: 1, g: 1, b: 1, a: 1 } as const;

/** 层节点读取的全部槽位：原始输入（局部规则要方向与情绪）+ 场参数。 */
const LAYER_READS = [
  SLOT.headTurn,
  SLOT.blink,
  FIELD_SLOT.breathScale,
  FIELD_SLOT.turnShift,
  FIELD_SLOT.swingOffset,
  FIELD_SLOT.lidTravel,
  FIELD_SLOT.gazeShiftX,
  FIELD_SLOT.gazeShiftY,
  FIELD_SLOT.browLift,
  FIELD_SLOT.mouthShape,
  FIELD_SLOT.windShiftX,
  FIELD_SLOT.windShiftY,
] as const;

/** 嘴部中心纵坐标：由嘴层区域矩形导出，不另设常量。 */
const mouthSpec = LAYER_SPECS.find((spec) => spec.kind === "mouth");
const MOUTH_CENTER_Y = mouthSpec
  ? mouthSpec.rect.y + mouthSpec.rect.height / 2
  : 0.625;

/** 单层节点：读取场参数 → 形变 → 产网格基元。 */
function createLayerNode(spec: LayerSpec): NodeDeclaration {
  const rest: NormalizedPoint[] = restLayer(spec);
  const id = layerNodeId(spec.id);
  return {
    id,
    reads: LAYER_READS,
    writes: [],
    step: (inputs) => {
      const read = (slot: string): number => inputs.values[slot] ?? 0;
      const local: LocalParams = {
        headTurn: read(SLOT.headTurn),
        lidTravel: read(FIELD_SLOT.lidTravel),
        gazeShiftX: read(FIELD_SLOT.gazeShiftX),
        gazeShiftY: read(FIELD_SLOT.gazeShiftY),
        browLift: read(FIELD_SLOT.browLift),
        mouthShape: read(FIELD_SLOT.mouthShape),
        swingOffset: read(FIELD_SLOT.swingOffset),
        windShiftX: read(FIELD_SLOT.windShiftX),
        windShiftY: read(FIELD_SLOT.windShiftY),
        mouthCenterY: MOUTH_CENTER_Y,
      };
      const vertices = deformLayer(
        rest,
        spec,
        {
          breathScale: read(FIELD_SLOT.breathScale),
          turnShift: read(FIELD_SLOT.turnShift),
          headTurn: read(SLOT.headTurn),
        },
        local,
      );
      const mesh: MeshPrimitive = {
        kind: "mesh",
        cols: spec.cols,
        rows: spec.rows,
        vertices,
        textureId: spec.textureId,
      };
      const primitive: RenderPrimitive = {
        nodeId: id,
        shape: mesh,
        transform: IDENTITY,
        tint: WHITE,
        blend: "normal",
        opacity: 1,
      };
      return { values: {}, primitives: [primitive] };
    },
  };
}

/** 全部层节点：数组序与 LAYER_SPECS 一致，绘制序即声明序。 */
export const layerNodes: readonly NodeDeclaration[] =
  LAYER_SPECS.map(createLayerNode);
