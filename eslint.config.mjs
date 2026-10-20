import tseslint from "typescript-eslint";

/**
 * 最小化类型感知 ESLint：只补 tsc 抓不到的 async/promise 类缺陷。
 * 不启用 recommended 规则集，不引入格式/风格规则（格式由 prettier 负责，
 * 类型与未使用符号由 tsc 负责），因此这里仅三条与类型信息绑定的规则。
 */

/** 作用范围：各包源码 + 根级测试与示例。 */
const typedSources = [
  "packages/*/src/**/*.ts",
  "packs/*/src/**/*.ts",
  "renderers/*/src/**/*.ts",
  "tests/**/*.ts",
  "examples/**/*.ts",
];

export default [
  {
    ignores: ["**/dist/**", "**/node_modules/**"],
  },
  {
    files: typedSources,
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        // 由每个文件所属的 tsconfig 提供类型信息（packages/packs/renderers
        // 各自 include src，根 tsconfig 覆盖 tests/examples），无需逐个手写 project 列表。
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
    },
  },
  /**
   * 层边界（机械判据）：依赖方向单向，与分层文档一致。
   * contracts 零实现依赖；kernel 依赖 contracts 与契约算法参考实现 primitives，
   * 不得 import 任何域包或渲染器；域包额外允许 primitives（求值器消费），
   * 渲染器只依赖 contracts；测试与示例作为消费方不受限。
   */
  {
    files: ["packages/contracts/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@lingfan-character/*", "!@lingfan-character/contracts"],
              message: "契约层零实现依赖，禁止 import 仓内其他包。",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["packages/kernel/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@lingfan-character/pack-*", "@lingfan-character/renderer-*"],
              message: "内核只依赖 contracts 与 primitives，不得 import 任何域包或渲染器。",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["packs/*/src/**/*.ts", "examples/*/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@lingfan-character/kernel",
                "@lingfan-character/pack-*",
                "@lingfan-character/example-*",
                "@lingfan-character/renderer-*",
              ],
              message: "域包与示例配方只依赖 contracts 与 primitives，互不知晓、不得依赖内核。",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["renderers/*/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@lingfan-character/kernel",
                "@lingfan-character/pack-*",
                "@lingfan-character/example-*",
                "@lingfan-character/renderer-*",
              ],
              message:
                "渲染器依赖 contracts 与共享数学库 primitives，互不知晓：禁内核、域包与渲染器互依。",
            },
          ],
        },
      ],
    },
  },
];
