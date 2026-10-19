import type {
  CharacterState,
  PackValidation,
  ValidationResult,
} from "@lingfan-character/contracts";
import { NODE_ID } from "../nodes";

/**
 * 拉伸范围约束：任何外观基元的形变矩阵缩放分量与不透明度
 * 必须留在限位内——程序化形变不允许把图层拉到失真。
 */
const SCALE_LIMIT = { min: 0.85, max: 1.15 };

function stretchRangeValidation(): PackValidation {
  return {
    name: "stretch-range",
    assert: (state: CharacterState): ValidationResult => {
      const failures: string[] = [];
      for (const nodeId of state.zOrder) {
        const nodeState = state.nodes[nodeId];
        if (!nodeState || nodeState.primitives.length === 0) continue;
        for (const [index, prim] of nodeState.primitives.entries()) {
          const scaleX = Math.hypot(prim.transform.a, prim.transform.b);
          const scaleY = Math.hypot(prim.transform.c, prim.transform.d);
          if (scaleX < SCALE_LIMIT.min || scaleX > SCALE_LIMIT.max) {
            failures.push(
              `${nodeId}#${index} 横向缩放 ${scaleX.toFixed(4)} 越界`,
            );
          }
          if (scaleY < SCALE_LIMIT.min || scaleY > SCALE_LIMIT.max) {
            failures.push(
              `${nodeId}#${index} 纵向缩放 ${scaleY.toFixed(4)} 越界`,
            );
          }
          if (prim.opacity < 0 || prim.opacity > 1) {
            failures.push(`${nodeId}#${index} 不透明度 ${prim.opacity} 越界`);
          }
        }
      }
      return { ok: failures.length === 0, failures };
    },
  };
}

/**
 * 图层分离限位约束：前发、后发与饰品相对脸部的刚体平移差
 * 不得超过限位——层间视差是效果，层间漂移是失控。
 */
const SEPARATION_LIMIT = 0.12;

function layerSeparationValidation(): PackValidation {
  return {
    name: "layer-separation",
    assert: (state: CharacterState): ValidationResult => {
      const failures: string[] = [];
      const face = state.nodes[NODE_ID.face];
      if (!face) return { ok: false, failures: ["脸部节点缺失"] };
      for (const other of [
        NODE_ID.hairBack,
        NODE_ID.hairFront,
        NODE_ID.accessory,
      ]) {
        const nodeState = state.nodes[other];
        if (!nodeState) {
          failures.push(`${other} 节点缺失`);
          continue;
        }
        const drift =
          Math.abs(nodeState.transform.e - face.transform.e) +
          Math.abs(nodeState.transform.f - face.transform.f);
        if (drift > SEPARATION_LIMIT) {
          failures.push(`${other} 相对脸部平移差 ${drift.toFixed(4)} 超限位`);
        }
      }
      return { ok: failures.length === 0, failures };
    },
  };
}

/** 域包约束集合：validateState 按声明顺序逐条求值。 */
export function humanoidValidations(): readonly PackValidation[] {
  return [stretchRangeValidation(), layerSeparationValidation()];
}
