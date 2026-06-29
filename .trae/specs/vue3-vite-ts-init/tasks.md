# Vue3 + Vite + TypeScript 项目初始化 - 实现计划

## [ ] Task 1: 使用 Vite 初始化 Vue3 + TypeScript 项目
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 使用 `pnpm create vite@latest . -- --template vue-ts` 在当前目录初始化项目
  - 项目名称为 img2plt
  - 验证 package.json 中包含 vue、vite、typescript 等核心依赖
- **Acceptance Criteria Addressed**: [AC-1, AC-6]
- **Test Requirements**:
  - `programmatic` TR-1.1: package.json 中存在 vue@3.x、vite@5.x、typescript@5.x 依赖
  - `programmatic` TR-1.2: 项目根目录存在 vite.config.ts、tsconfig.json、tsconfig.node.json、env.d.ts
- **Notes**: 使用 --template vue-ts 模板

## [ ] Task 2: 安装并配置 ESLint + Prettier
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 安装 eslint、prettier 及相关插件
  - 创建 .eslintrc.js 配置文件
  - 创建 .eslintignore 忽略文件
  - 创建 .prettierrc 配置文件
  - 创建 .prettierignore 忽略文件
  - 在 package.json 中添加 lint 脚本
- **Acceptance Criteria Addressed**: [AC-3]
- **Test Requirements**:
  - `programmatic` TR-2.1: 根目录存在 .eslintrc.js、.eslintignore、.prettierrc、.prettierignore 文件
  - `programmatic` TR-2.2: 执行 pnpm lint 无报错
  - `programmatic` TR-2.3: package.json 中包含 lint 脚本命令
- **Notes**: ESLint 配置需兼容 Vue3 + TypeScript

## [ ] Task 3: 安装并配置 Pinia 状态管理
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 安装 pinia 依赖
  - 创建 src/store/index.ts 入口文件
  - 创建 src/store/modules/ 目录
  - 在 main.ts 中注册 Pinia
- **Acceptance Criteria Addressed**: [AC-4]
- **Test Requirements**:
  - `programmatic` TR-3.1: package.json 中存在 pinia@2.x 依赖
  - `programmatic` TR-3.2: src/store/index.ts 文件存在且正确导出 store
  - `programmatic` TR-3.3: src/store/modules/ 目录存在
  - `programmatic` TR-3.4: main.ts 中正确使用 createPinia() 并注册
- **Notes**: 保持最简配置，不创建具体 store module

## [ ] Task 4: 安装并配置 Vue Router
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 安装 vue-router 依赖
  - 创建 src/router/index.ts 路由入口
  - 创建 src/router/modules/ 目录
  - 在 main.ts 中注册 Router
  - 配置首页路由
- **Acceptance Criteria Addressed**: [AC-4]
- **Test Requirements**:
  - `programmatic` TR-4.1: package.json 中存在 vue-router@4.x 依赖
  - `programmatic` TR-4.2: src/router/index.ts 文件存在且正确配置
  - `programmatic` TR-4.3: src/router/modules/ 目录存在
  - `programmatic` TR-4.4: main.ts 中正确注册 router
- **Notes**: 配置一个基础的首页路由

## [ ] Task 5: 创建完整的目录结构和基础文件
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 创建 src/api/ 目录及 request.ts、modules/ 子目录
  - 创建 src/assets/images/ 和 src/assets/styles/ 目录
  - 创建 src/components/base/ 和 src/components/business/ 目录
  - 创建 src/composables/ 目录
  - 创建 src/types/ 目录
  - 创建 src/utils/ 目录
  - 创建 src/views/ 目录
  - 确保 public/favicon.ico 存在
- **Acceptance Criteria Addressed**: [AC-2]
- **Test Requirements**:
  - `programmatic` TR-5.1: 所有指定目录都存在
  - `programmatic` TR-5.2: src/api/request.ts 文件存在
  - `programmatic` TR-5.3: public/favicon.ico 文件存在
- **Notes**: 目录必须与用户指定的结构完全一致

## [ ] Task 6: 配置 Axios 请求封装
- **Priority**: high
- **Depends On**: Task 5
- **Description**: 
  - 安装 axios 依赖
  - 在 src/api/request.ts 中封装 axios 实例
  - 配置请求拦截器和响应拦截器
  - 添加 TypeScript 类型定义
  - 添加中文注释
- **Acceptance Criteria Addressed**: [AC-2]
- **Test Requirements**:
  - `programmatic` TR-6.1: package.json 中存在 axios 依赖
  - `programmatic` TR-6.2: src/api/request.ts 导出 axios 实例
  - `programmatic` TR-6.3: 包含请求拦截器和响应拦截器
  - `programmatic` TR-6.4: TypeScript 类型检查通过
- **Notes**: 保持基础封装，添加必要的中文注释

## [ ] Task 7: 首页显示 Hello
- **Priority**: high
- **Depends On**: [Task 3, Task 4, Task 5]
- **Description**: 
  - 在 src/views/ 下创建首页组件
  - 页面显示 "Hello" 文字
  - 配置路由指向首页
  - 修改 App.vue 使用 router-view
- **Acceptance Criteria Addressed**: [AC-5]
- **Test Requirements**:
  - `programmatic` TR-7.1: 首页视图组件存在于 src/views/ 目录
  - `programmatic` TR-7.2: App.vue 中包含 router-view
  - `programmatic` TR-7.3: pnpm build 构建成功
  - `programmatic` TR-7.4: 构建产物中包含 "Hello" 文字
- **Notes**: 最简实现，只需显示文字即可

## [ ] Task 8: 验证项目可正常运行和构建
- **Priority**: high
- **Depends On**: [Task 2, Task 6, Task 7]
- **Description**: 
  - 执行 pnpm build 验证构建
  - 执行 TypeScript 类型检查
  - 执行 ESLint 检查
- **Acceptance Criteria Addressed**: [AC-6, AC-3]
- **Test Requirements**:
  - `programmatic` TR-8.1: pnpm build 执行成功，生成 dist 目录
  - `programmatic` TR-8.2: TypeScript 类型检查无错误
  - `programmatic` TR-8.3: ESLint 检查通过
- **Notes**: 所有检查必须全部通过

## [ ] Task 9: 提交代码到 GitHub
- **Priority**: high
- **Depends On**: Task 8
- **Description**: 
  - 创建 .gitignore 文件（确保忽略 node_modules、dist 等）
  - 执行 git add 和 git commit
  - 推送到远程仓库 origin/main
- **Acceptance Criteria Addressed**: [AC-7]
- **Test Requirements**:
  - `programmatic` TR-9.1: .gitignore 文件存在且配置正确
  - `programmatic` TR-9.2: git 提交记录存在
  - `programmatic` TR-9.3: 代码已成功推送到远程仓库
- **Notes**: 远程仓库为 git@github.com:samoye2016/img2plt.git
