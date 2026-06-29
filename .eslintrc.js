// ESLint 配置文件 - Vue3 + TypeScript + Prettier
// 使用传统的 .eslintrc.js 格式，兼容 ESLint v8

module.exports = {
  // 根配置文件，停止向上查找
  root: true,

  // 环境配置
  env: {
    browser: true,
    node: true,
    es2021: true,
  },

  // 全局变量
  globals: {
    // Vue3 Composition API 宏
    defineProps: 'readonly',
    defineEmits: 'readonly',
    defineExpose: 'readonly',
    withDefaults: 'readonly',
  },

  // 解析器配置
  parser: 'vue-eslint-parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parser: '@typescript-eslint/parser',
    project: ['./tsconfig.json', './tsconfig.node.json'],
    extraFileExtensions: ['.vue'],
  },

  // 插件
  plugins: ['@typescript-eslint', 'vue', 'prettier'],

  // 扩展配置
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:vue/vue3-recommended',
    'prettier',
    'plugin:prettier/recommended',
  ],

  // 自定义规则
  rules: {
    // 通用 JavaScript 规则
    'no-console': 'warn',
    'no-debugger': 'warn',
    'no-empty': 'warn',
    'no-var': 'error',
    'prefer-const': 'warn',
    eqeqeq: ['warn', 'always'],

    // TypeScript 自定义规则调整
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/ban-ts-comment': 'warn',
    '@typescript-eslint/consistent-type-imports': 'warn',
    '@typescript-eslint/no-empty-object-type': 'warn',

    // Vue 自定义规则调整
    'vue/multi-word-component-names': 'off',
    'vue/no-v-html': 'off',
    'vue/require-default-prop': 'off',
    'vue/require-explicit-emits': 'warn',
    'vue/prop-name-casing': ['warn', 'camelCase'],
    'vue/component-name-in-template-casing': ['warn', 'PascalCase'],
    'vue/custom-event-name-casing': ['warn', 'camelCase'],

    // Prettier 规则
    'prettier/prettier': 'warn',
  },
}
