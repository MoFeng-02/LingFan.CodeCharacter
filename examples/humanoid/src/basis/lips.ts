/**
 * 唇部基形变：纯数值计算。嘴角左右独立（不对称微表情的来源），
 * 唇缘卷曲表达为唇带外弓弧加深，抿嘴收窄变薄；正交纪律同各基文件。
 */

/** 唇部形变量：cornerLiftL/R 嘴角端点纵向位移（负=上挑），widthScale 唇宽，thinScale 唇厚，curlUpper/Lower 唇缘弧加深系数。 */
export interface LipDeform {
  cornerLiftL: number;
  cornerLiftR: number;
  widthScale: number;
  thinScale: number;
  curlUpper: number;
  curlLower: number;
}

/** 唇部基形变：corner 正值上挑（屏幕坐标向上为负），compress 收窄且变薄。 */
export function lipDeform(
  cornerL: number,
  cornerR: number,
  curlUpper: number,
  curlLower: number,
  compress: number,
): LipDeform {
  return {
    cornerLiftL: -0.008 * cornerL,
    cornerLiftR: -0.008 * cornerR,
    widthScale: 1 - 0.08 * compress,
    thinScale: 1 - 0.5 * compress,
    curlUpper,
    curlLower,
  };
}
