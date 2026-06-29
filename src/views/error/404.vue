<script setup lang="ts">
import { useRouter } from 'vue-router'

// 404 页面组件
const router = useRouter()

const goHome = () => {
  router.push('/')
}
</script>

<template>
  <div class="not-found-page">
    <h1>404</h1>
    <p>页面未找到</p>
    <button class="back-btn" @click="goHome">返回首页</button>
  </div>
</template>

<style scoped>
.not-found-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
}

.not-found-page h1 {
  font-size: 6rem;
  color: #646cff;
  margin: 0;
}

.not-found-page p {
  font-size: 1.5rem;
  color: #666;
  margin: 1rem 0 2rem;
}

.back-btn {
  padding: 0.75rem 2rem;
  font-size: 1rem;
  color: #fff;
  background-color: #646cff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.back-btn:hover {
  background-color: #535bf2;
}
</style>
