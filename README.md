# img2plt

> 浏览器端运行的 **图片转 PLT (HPGL) 矢量工具**，面向激光雕刻 / 切割等数控场景

`img2plt` 是一个完全运行在浏览器中的纯前端 Web 应用：把位图（PNG / JPG / WEBP / BMP / TIFF）经过灰度化、二值化、轮廓提取、曲线平滑等处理后，转换为激光雕刻机可直接读取的 **PLT (HPGL)** 矢量文件。所有图像处理都在本地完成，文件不上传任何服务器，隐私安全可控。

---

## 特性一览

- **拖放上传**：支持 JPG / PNG / WEBP / BMP / TIFF 以及 `.plt` 文件拖入或点击上传
- **可视化处理参数**：
  - 二值化阈值（0–255）
  - 平滑模糊（高斯核大小）
  - 曲线平滑（移动平均窗口）
  - 分离像素（腐蚀迭代）
  - 输出物理宽度（mm）
  - 反相 / 去噪点 开关
- **实时对比预览**：原图 vs 处理结果，支持左右/上下布局、黑白/红线路径切换
- **视口交互**：鼠标滚轮缩放、拖拽平移、一键复位
- **PLT 导出**：支持浏览器原生 `showSaveFilePicker`，无原生支持时回退到传统下载
- **本地草稿**：参数方案 + 缩略图存储到 `localStorage`，最多保存 20 条
- **PLT 反向解析**：可直接读取并预览已有的 PLT 文件（路径数 / 点数展示）
- **零服务器依赖**：打包后任意静态托管（GitHub Pages、Vercel、Nginx 等）即可运行

---

## 技术栈

| 类别 | 选型 |
| --- | --- |
| 框架 | [Vue 3.5](https://vuejs.org/)（Composition API + `<script setup>`） |
| 构建 | [Vite 5.4](https://vitejs.dev/) + `@vitejs/plugin-vue` |
| 语言 | [TypeScript 5.6](https://www.typescriptlang.org/) |
| 状态管理 | [Pinia 2.3](https://pinia.vuejs.org/) |
| 路由 | [Vue Router 4.6](https://router.vuejs.org/)（HTML5 History） |
| HTTP | [Axios 1.18](https://axios-http.com/) |
| 代码规范 | ESLint 8.57 + Prettier 3.9（`@typescript-eslint`、`eslint-plugin-vue`） |
| 类型检查 | `vue-tsc` 2.1 |
| 包管理 | [pnpm](https://pnpm.io/)（推荐 ≥ 8，Node.js ≥ 18） |

---

## 快速开始

### 环境要求

- **Node.js** ≥ 18
- **pnpm** ≥ 8（如未安装：`npm i -g pnpm`）

### 安装与运行

```bash
# 1. 克隆仓库
git clone https://github.com/samoye2016/img2plt.git
cd img2plt

# 2. 安装依赖（强烈推荐使用 pnpm）
pnpm install

# 3. 启动开发服务器（默认 http://localhost:5173）
pnpm dev

# 4. 构建生产产物（输出到 dist/）
pnpm build

# 5. 本地预览构建产物
pnpm preview

# 6. 代码风格检查与自动修复
pnpm lint
```

---

## 使用说明

1. **上传文件**：将图片或 `.plt` 文件拖入左侧"文件处理"面板的虚线框，或点击「选择文件…」按钮。
2. **调整参数**（仅图片模式）：实时滑动参数滑杆，预览自动重渲染（防抖 150ms）。
3. **切换预览**：
   - 「⇅ 上下对比」/「⇆ 左右对比」切换原图与处理结果的布局
   - 「◯ 红线模式」/「⬤ 黑白模式」切换轮廓显示风格
4. **视口操作**：滚轮缩放、鼠标拖拽平移、点「复位视图」还原。
5. **保存草稿**：输入名称后点击 💾，参数方案与缩略图会保存到本机浏览器。
6. **导出 PLT**：点击右上角「导出 PLT」即可下载 `.plt` 文件。
7. **PLT 反向读取**：直接上传 `.plt` 即可在预览区查看矢量路径。

### 处理流程

```
位图 → 灰度化 → 高斯模糊 → 二值化 → 形态学开运算（去噪点） → 腐蚀（分离） → 轮廓跟踪
       → RDP 简化 → 移动平均平滑 → 等间距重采样 → HPGL (PLT) 输出
```

> 注：透明像素按白色背景（255）处理；如需黑色背景，请在「反相」开关中切换。

### PLT 单位说明

- 40 HPGL 单位 = 1 毫米
- 坐标原点在左下角，Y 轴向上
- 输出文件可直接导入支持 HPGL 的激光雕刻控制软件

---

## 目录结构

```
img2plt/
├── public/                        # 静态资源（favicon、logo 等）
├── src/
│   ├── api/request.ts             # Axios 请求封装
│   ├── assets/                    # 静态资源（图）
│   ├── components/                # 通用组件
│   ├── router/index.ts            # 路由配置
│   ├── store/index.ts             # Pinia 实例
│   ├── style.css                  # 全局样式
│   ├── utils/
│   │   ├── image/
│   │   │   ├── contour.ts         # Suzuki-Abe 轮廓提取 + RDP + 平滑 + 重采样
│   │   │   └── process.ts         # 图像处理管道（灰度/模糊/二值化/开运算/腐蚀/反相）
│   │   ├── plt.ts                 # PLT (HPGL) 生成与解析
│   │   └── storage.ts             # localStorage 草稿管理
│   ├── views/
│   │   ├── home/index.vue         # 主页面：上传 / 参数 / 预览 / 导出
│   │   └── error/404.vue          # 404 页面
│   ├── App.vue                    # 根组件
│   └── main.ts                    # 应用入口
├── .eslintrc.js                   # ESLint 配置
├── .prettierrc                    # Prettier 配置
├── index.html                     # HTML 入口
├── tsconfig.json                  # TS 配置
├── vite.config.ts                 # Vite 配置（含 @ → src 别名）
└── package.json
```

---

## 浏览器兼容性

- ✅ Chrome / Edge 86+（完整支持 `showSaveFilePicker`）
- ✅ Firefox 100+
- ✅ Safari 15.4+
- ⚠️ 旧版浏览器：PLT 导出将回退到传统 `<a download>` 方式，其他功能不受影响

> 建议使用现代浏览器以获得最佳体验与原生的「保存到任意位置」能力。

---

## 开发规范

本项目遵循以下约定，便于团队协作与代码维护：

- **包管理**：统一使用 `pnpm`，禁止 `npm` / `yarn`（避免 lock 文件冲突）
- **技术栈**：Vue 3 + Vite + TypeScript，不引入额外的 UI 框架
- **代码风格**：提交前执行 `pnpm lint`，遵循 ESLint + Prettier 规则
- **中文注释**：业务代码需配备适量的中文注释，便于阅读
- **日志输出**：关键流程（加载、处理、导出）需输出 `console` 日志，便于排查
- **幂等工具函数**：`utils/` 下的工具函数应保持纯函数特性，副作用收敛到业务层
- **目录别名**：`@` → `src`（已在 `vite.config.ts` 与 `tsconfig.json` 中配置）

---

## 路线图（Roadmap）

- [ ] 多语言（i18n）中英文切换
- [ ] 批量处理与队列
- [ ] 路径排序优化（减少抬刀次数）
- [ ] SVG / DXF 输出格式
- [ ] 雕刻预览（按真实物理尺寸）

---

## 许可证

本项目基于 [MIT License](./LICENSE) 开源。

---

## 致谢

- 图像处理算法参考自经典 OpenCV Python 教程
- UI 灵感来自现代激光切割控制台
- 感谢所有提 Issue / PR 的贡献者
