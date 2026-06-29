import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

/**
 * 基础路由配置
 * 所有页面都应该至少能够访问这些路由
 */
const constantRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/home/index.vue'),
    meta: {
      title: '首页',
      icon: 'home',
    },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/error/404.vue'),
    meta: {
      title: '页面未找到',
      hidden: true,
    },
  },
]

/**
 * 创建路由实例
 * 使用 HTML5 History 模式，URL 更加美观
 */
const router = createRouter({
  history: createWebHistory(),
  routes: constantRoutes,
  scrollBehavior: () => ({ top: 0 }),
})

export default router
