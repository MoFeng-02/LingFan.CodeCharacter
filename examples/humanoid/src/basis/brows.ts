/**
 * 眉部基形变：纯数值计算，不接触基元与矩阵——组装发生在外观节点。
 * 每个形变量只由对应基参数贡献，保证「单基激活、其余特征不动」的正交纪律。
 */

/** 眉部形变量：dy 纵向位移（负=上提），tilt 内倾弧度，widthScale 宽度缩比。 */
export interface BrowDeform {
  dy: number;
  tilt: number;
  widthScale: number;
}

/**
 * 眉部基形变：挑眉整体上提；皱眉下压、向鼻侧内倾并略收窄。
 * side=-1 为左、1 为右；内倾方向随侧别翻转，保证左右对称语义。
 */
export function browDeform(
  raise: number,
  furrow: number,
  side: -1 | 1,
): BrowDeform {
  return {
    dy: -0.012 * raise + 0.008 * furrow,
    tilt: -side * 0.12 * furrow,
    widthScale: 1 - 0.12 * furrow,
  };
}
