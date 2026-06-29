import { createPinia } from 'pinia'

// 创建 Pinia 状态管理实例
// Pinia 是 Vue 3 的官方状态管理库，提供类型安全、模块化的状态管理
const pinia = createPinia()

// 导出 Pinia 实例，供 main.ts 中注册使用
export default pinia
