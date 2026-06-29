# Vue3 + Vite + TypeScript 项目初始化 - 验证清单

## 项目初始化验证
- [ ] 使用 pnpm create vite 在当前目录成功初始化 Vue3 + TypeScript 项目
- [ ] package.json 中包含 vue@3.x、vite@5.x、typescript@5.x 依赖
- [ ] 项目根目录存在 vite.config.ts、tsconfig.json、tsconfig.node.json、env.d.ts

## 目录结构验证
- [ ] src/api/ 目录存在，包含 request.ts 和 modules/ 子目录
- [ ] src/assets/images/ 目录存在
- [ ] src/assets/styles/ 目录存在
- [ ] src/components/base/ 目录存在
- [ ] src/components/business/ 目录存在
- [ ] src/composables/ 目录存在
- [ ] src/router/ 目录存在，包含 index.ts 和 modules/ 子目录
- [ ] src/store/ 目录存在，包含 index.ts 和 modules/ 子目录
- [ ] src/types/ 目录存在
- [ ] src/utils/ 目录存在
- [ ] src/views/ 目录存在
- [ ] src/App.vue 和 src/main.ts 存在
- [ ] public/favicon.ico 存在

## ESLint + Prettier 验证
- [ ] 根目录存在 .eslintrc.js 配置文件
- [ ] 根目录存在 .eslintignore 忽略文件
- [ ] 根目录存在 .prettierrc 配置文件
- [ ] 根目录存在 .prettierignore 忽略文件
- [ ] 执行 pnpm lint 无报错
- [ ] 代码格式符合 Prettier 规范

## Pinia 状态管理验证
- [ ] package.json 中包含 pinia@2.x 依赖
- [ ] src/store/index.ts 文件存在且正确导出 store
- [ ] main.ts 中正确使用 createPinia() 并注册

## Vue Router 验证
- [ ] package.json 中包含 vue-router@4.x 依赖
- [ ] src/router/index.ts 文件存在且正确配置路由
- [ ] main.ts 中正确注册 router
- [ ] App.vue 中包含 router-view

## Axios 请求封装验证
- [ ] package.json 中包含 axios 依赖
- [ ] src/api/request.ts 文件存在
- [ ] request.ts 中正确创建 axios 实例
- [ ] 包含请求拦截器和响应拦截器
- [ ] TypeScript 类型定义完整

## 页面功能验证
- [ ] 首页视图组件存在于 src/views/ 目录
- [ ] 页面显示 "Hello" 文字
- [ ] 路由配置正确，访问根路径显示首页

## 构建验证
- [ ] 执行 pnpm build 构建成功
- [ ] dist 目录生成
- [ ] TypeScript 类型检查无错误
- [ ] ESLint 检查通过

## Git 提交验证
- [ ] .gitignore 文件存在且配置正确（忽略 node_modules、dist 等）
- [ ] Git 仓库已初始化
- [ ] 代码已提交到本地仓库
- [ ] 代码已成功推送到 GitHub 远程仓库 (origin/main)
