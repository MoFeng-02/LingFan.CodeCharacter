/**
 * 多项式三角函数：确定性几何的 sin/cos 唯一实现。
 *
 * 是什么：泰勒展开固定系数的 sin/cos 多项式逼近，输入先归约到主值区间。
 * 为什么：语言内置 Math.sin/cos 属于规范定义的「实现近似」运算，
 *         不同引擎可以给出不同的最后几位，破坏跨设备逐字节一致；
 *         多项式只有 IEEE 四则运算，任何引擎逐位相同。
 * 怎么用：视角角度（弧度）直接传入 polySin / polyCos；3D 旋转矩阵
 *         内部使用本模块，不得在确定性路径上调用 Math.sin/cos。
 * 注意事项：主值归约使用 Math.round 与常量 π（均为确定的双精度值）；
 *          截断到十五次（sin）与十四次（cos），主值区间内与真值之差
 *          在 1e-9 量级，远小于像素级采样所需的精度。
 */

const TWO_PI = 2 * Math.PI;
const HALF_PI = Math.PI / 2;

/** 把任意角度归约到 [−π, π]（确定的双精度运算）。 */
function reduceToPi(x: number): number {
  return x - TWO_PI * Math.round(x / TWO_PI);
}

/**
 * 正弦：先归约到 [−π, π]，再对称折算到 [−π/2, π/2] 后求十五次泰勒多项式。
 * sin(r) = sin(π − r) 保证折算前后函数值不变。
 */
export function polySin(x: number): number {
  const r = reduceToPi(x);
  const t = r > HALF_PI ? Math.PI - r : r < -HALF_PI ? -Math.PI - r : r;
  const x2 = t * t;
  return (
    t *
    (1 +
      x2 *
        (-1 / 6 +
          x2 *
            (1 / 120 +
              x2 *
                (-1 / 5040 +
                  x2 *
                    (1 / 362880 +
                      x2 *
                        (-1 / 39916800 +
                          x2 *
                            (1 / 6227020800 + x2 * (-1 / 1307674368000))))))))
  );
}

/**
 * 余弦：偶函数，归约到 [0, π/2] 后取十四次偶多项式；
 * |r| 超过半 π 时 cos(π − a) = −cos(a) 需要翻符号。
 */
export function polyCos(x: number): number {
  const r = reduceToPi(x);
  let a = r < 0 ? -r : r;
  let sign = 1;
  if (a > HALF_PI) {
    a = Math.PI - a;
    sign = -1;
  }
  const x2 = a * a;
  return (
    sign *
    (1 +
      x2 *
        (-1 / 2 +
          x2 *
            (1 / 24 +
              x2 *
                (-1 / 720 +
                  x2 *
                    (1 / 40320 +
                      x2 *
                        (-1 / 3628800 +
                          x2 * (1 / 479001600 + x2 * (-1 / 87178291200))))))))
  );
}
