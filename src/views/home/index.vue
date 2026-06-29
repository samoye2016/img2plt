<script setup lang="ts">
import { computed, nextTick, reactive, ref, shallowRef, watch, onBeforeUnmount } from 'vue'
import { processContours, type Contours } from '@/utils/image/contour'
import { downloadPlt, generatePlt, parsePlt, type ParsedPlt } from '@/utils/plt'
import { loadImageToData, processImage, type ProcessParams } from '@/utils/image/process'
import {
  createThumbnail,
  deleteDraft,
  loadDrafts,
  saveDraft,
  type PltDraft,
  type PltDraftParams,
} from '@/utils/storage'

// ==================== 默认参数配置 ====================
const DEFAULT_PARAMS: PltDraftParams = {
  threshold: 128,
  blur: 3,
  invert: false,
  noiseFilter: true,
  erode: 0,
  smooth: 1.5,
  widthMm: 300,
}

// ==================== 类型定义 ====================
type SourceKind = 'none' | 'image' | 'plt'
type ViewMode = 'redline' | 'bw'
type LayoutMode = 'side' | 'stack'

// ==================== DOM 引用 ====================
const fileInputRef = ref<HTMLInputElement | null>(null)
const previewCanvasRef = ref<HTMLCanvasElement | null>(null)

// ==================== 响应式状态 ====================
// 处理参数
const processParams = reactive<PltDraftParams>({ ...DEFAULT_PARAMS })

// 文件相关
const sourceKind = ref<SourceKind>('none')
const sourceImageData = shallowRef<ImageData | null>(null)
const sourceFileName = ref('output')
const originalImageSrc = ref('')
const originalImageSize = ref('')
const fileInfoText = ref('未选择图片')
const isDragging = ref(false)

// 处理结果
const processedBinary = shallowRef<ImageData | null>(null)
const processedContours = shallowRef<Contours | null>(null)
const parsedPltData = shallowRef<ParsedPlt | null>(null)

// 草稿相关
const drafts = ref<PltDraft[]>(loadDrafts())
const draftNameInput = ref('')
const selectedDraftId = ref('')

// 视图相关
const viewMode = ref<ViewMode>('redline')
const layoutMode = ref<LayoutMode>('side')

// 状态相关
const statusText = ref('等待加载图片')
const isStatusError = ref(false)
const isProcessing = ref(false)

// 视口变换（缩放和平移）
const viewport = reactive({
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,
  startOffsetX: 0,
  startOffsetY: 0,
})

// 防抖定时器
let processTimer: ReturnType<typeof setTimeout> | null = null

// ==================== 计算属性 ====================
// 预览画布的变换样式
const previewCanvasStyle = computed(() => ({
  transform: `translate(${viewport.offsetX}px, ${viewport.offsetY}px) scale(${viewport.scale})`,
  cursor: viewport.isDragging ? 'grabbing' : 'grab',
}))

// 是否可以导出 PLT
const canExportPlt = computed(
  () => sourceKind.value === 'image' && !!processedContours.value?.length && !isProcessing.value,
)

// ==================== 文件加载函数 ====================

/**
 * 加载图片文件
 */
async function loadImageFile(file: File): Promise<void> {
  try {
    statusText.value = '正在加载图片…'
    isStatusError.value = false
    sourceKind.value = 'image'

    const { data, image } = await loadImageToData(file)
    sourceImageData.value = data
    processedBinary.value = null
    processedContours.value = null
    parsedPltData.value = null
    sourceFileName.value = file.name.replace(/\.[^.]+$/, '') || 'output'
    originalImageSrc.value = image.src
    originalImageSize.value = `${image.naturalWidth} × ${image.naturalHeight}`
    fileInfoText.value = `${file.name} (${image.naturalWidth}×${image.naturalHeight})`

    resetViewport()
    clearPreviewCanvas()
    statusText.value = `已加载：${file.name}`
    isStatusError.value = false

    scheduleProcessing()
  } catch (error) {
    statusText.value = error instanceof Error ? error.message : '加载失败'
    isStatusError.value = true
    console.error('[home] 图片加载失败:', error)
  }
}

/**
 * 加载 PLT 文件
 */
async function loadPltFile(file: File): Promise<void> {
  try {
    statusText.value = '正在读取 PLT…'
    isStatusError.value = false

    const content = await file.text()
    const parsed = parsePlt(content)

    sourceKind.value = 'plt'
    sourceImageData.value = null
    processedBinary.value = null
    processedContours.value = null
    parsedPltData.value = parsed
    sourceFileName.value = file.name.replace(/\.[^.]+$/, '') || 'output'
    originalImageSrc.value = ''
    originalImageSize.value = `${Math.round(parsed.bounds.width)} × ${Math.round(parsed.bounds.height)} HPGL`
    fileInfoText.value = `${file.name} (${parsed.paths.length} 路径 / ${parsed.pointCount} 点)`

    resetViewport()
    await nextTick()
    renderPltPreview(parsed)

    statusText.value = `已读取：${parsed.paths.length} 路径 / ${parsed.pointCount} 点`
    isStatusError.value = false
  } catch (error) {
    statusText.value = error instanceof Error ? error.message : 'PLT 读取失败'
    isStatusError.value = true
    console.error('[home] PLT 文件加载失败:', error)
  }
}

/**
 * 根据文件类型选择加载方式
 */
function loadFile(file: File): void {
  if (/\.plt$/i.test(file.name) || file.type === 'application/vnd.hp-HPGL') {
    void loadPltFile(file)
  } else {
    void loadImageFile(file)
  }
}

// ==================== 文件选择处理 ====================

/**
 * 触发文件选择对话框
 */
function openFilePicker(): void {
  fileInputRef.value?.click()
}

/**
 * 处理文件输入变化
 */
function handleFileInputChange(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) {
    loadFile(file)
  }
}

/**
 * 处理拖放事件
 */
function handleFileDrop(event: DragEvent): void {
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) {
    loadFile(file)
  }
}

// ==================== 画布渲染函数 ====================

/**
 * 清空预览画布
 */
function clearPreviewCanvas(): void {
  const canvas = previewCanvasRef.value
  if (!canvas) return
  canvas.width = 1
  canvas.height = 1
}

/**
 * 渲染轮廓预览（图片模式）
 */
function renderContourPreview(binary: ImageData, contours: Contours): void {
  const canvas = previewCanvasRef.value
  if (!canvas) return

  const { width, height } = binary
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  if (viewMode.value === 'bw') {
    // 黑白模式：直接显示二值化图像
    ctx.putImageData(binary, 0, 0)
    return
  }

  // 红线模式：白色背景 + 红色轮廓线
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = '#e53e3e'
  ctx.lineWidth = 1
  ctx.beginPath()

  for (const contour of contours) {
    if (contour.length < 2) continue
    ctx.moveTo(contour[0][0], contour[0][1])
    for (let i = 1; i < contour.length; i++) {
      ctx.lineTo(contour[i][0], contour[i][1])
    }
    ctx.closePath()
  }

  ctx.stroke()
}

/**
 * 渲染 PLT 预览（PLT 模式）
 */
function renderPltPreview(parsed: ParsedPlt): void {
  const canvas = previewCanvasRef.value
  if (!canvas) return

  const maxCanvasSize = 1600
  const { bounds } = parsed
  const scale = Math.min(maxCanvasSize / bounds.width, maxCanvasSize / bounds.height, 2)
  const padding = 32
  const width = Math.max(320, Math.ceil(bounds.width * scale + padding * 2))
  const height = Math.max(240, Math.ceil(bounds.height * scale + padding * 2))

  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = '#e53e3e'
  ctx.lineWidth = 1
  ctx.beginPath()

  for (const path of parsed.paths) {
    if (path.points.length < 2) continue
    const first = path.points[0]
    ctx.moveTo((first.x - bounds.minX) * scale + padding, (bounds.maxY - first.y) * scale + padding)
    for (let i = 1; i < path.points.length; i++) {
      const point = path.points[i]
      ctx.lineTo(
        (point.x - bounds.minX) * scale + padding,
        (bounds.maxY - point.y) * scale + padding,
      )
    }
  }

  ctx.stroke()
}

// ==================== 视口交互函数 ====================

/**
 * 复位视口（缩放和平移）
 */
function resetViewport(): void {
  viewport.scale = 1
  viewport.offsetX = 0
  viewport.offsetY = 0
  viewport.isDragging = false
}

/**
 * 处理滚轮缩放
 */
function handlePreviewWheel(event: WheelEvent): void {
  if (sourceKind.value === 'none') return
  event.preventDefault()

  const zoomFactor = event.deltaY < 0 ? 1.12 : 0.88
  const nextScale = viewport.scale * zoomFactor
  viewport.scale = Number(Math.max(0.25, Math.min(8, nextScale)).toFixed(3))
}

/**
 * 开始拖拽平移
 */
function handlePreviewPointerDown(event: MouseEvent): void {
  if (sourceKind.value === 'none' || event.button !== 0) return

  viewport.isDragging = true
  viewport.dragStartX = event.clientX
  viewport.dragStartY = event.clientY
  viewport.startOffsetX = viewport.offsetX
  viewport.startOffsetY = viewport.offsetY
}

/**
 * 拖拽平移中
 */
function handlePreviewPointerMove(event: MouseEvent): void {
  if (!viewport.isDragging) return

  viewport.offsetX = viewport.startOffsetX + event.clientX - viewport.dragStartX
  viewport.offsetY = viewport.startOffsetY + event.clientY - viewport.dragStartY
}

/**
 * 结束拖拽平移
 */
function stopPreviewDrag(): void {
  viewport.isDragging = false
}

// ==================== 图像处理函数 ====================

/**
 * 调度处理（防抖 150ms）
 */
function scheduleProcessing(): void {
  if (processTimer) {
    clearTimeout(processTimer)
  }
  processTimer = setTimeout(runProcessing, 150)
}

/**
 * 执行图像处理流程
 */
function runProcessing(): void {
  if (!sourceImageData.value) return

  try {
    isProcessing.value = true

    // 1. 图像处理（二值化等）
    const imageProcessParams: ProcessParams = {
      threshold: processParams.threshold,
      blur: processParams.blur,
      invert: processParams.invert,
      noiseFilter: processParams.noiseFilter,
      erode: processParams.erode,
    }
    const processResult = processImage(sourceImageData.value, imageProcessParams)
    processedBinary.value = processResult.binary

    // 2. 轮廓提取与处理
    const smoothWindowSize = Math.max(0.5, processParams.smooth)
    const contourResult = processContours(processResult.binary, {
      minArea: 3,
      rdpEpsilon: 0,
      smoothWindow: smoothWindowSize,
      resampleSpacing: 1,
    })
    processedContours.value = contourResult

    // 3. 渲染预览
    renderContourPreview(processResult.binary, contourResult)

    // 4. 更新状态
    const totalPoints = contourResult.reduce((sum, contour) => sum + contour.length, 0)
    statusText.value = `完成：${contourResult.length} 轮廓 / ${totalPoints} 点`
    isStatusError.value = false
  } catch (error) {
    statusText.value = error instanceof Error ? error.message : '处理失败'
    isStatusError.value = true
    console.error('[home] 图像处理失败:', error)
  } finally {
    isProcessing.value = false
  }
}

// ==================== 导出 PLT 函数 ====================

/**
 * 导出 PLT 文件
 */
async function exportPltFile(): Promise<void> {
  if (!processedContours.value || !processedBinary.value || !sourceImageData.value) return

  try {
    statusText.value = '正在生成 PLT…'
    isStatusError.value = false

    const widthMm = processParams.widthMm
    const imgWidth = processedBinary.value.width
    const imgHeight = processedBinary.value.height
    const heightMm = widthMm * (imgHeight / imgWidth)

    const pltContent = generatePlt(processedContours.value, imgWidth, imgHeight, {
      widthMm,
      heightMm,
    })
    const fileName = `${sourceFileName.value}.plt`

    // 优先使用文件系统 API，回退到传统下载
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (
          window as unknown as {
            showSaveFilePicker: (options: unknown) => Promise<{
              createWritable: () => Promise<{
                write: (data: string) => Promise<void>
                close: () => Promise<void>
              }>
            }>
          }
        ).showSaveFilePicker({
          suggestedName: fileName,
          types: [
            {
              description: 'PLT 文件',
              accept: { 'application/octet-stream': ['.plt'] },
            },
          ],
        })
        const writable = await handle.createWritable()
        await writable.write(pltContent)
        await writable.close()

        statusText.value = `已保存：${fileName}`
        isStatusError.value = false
        return
      } catch (err: unknown) {
        if ((err as { name?: string })?.name === 'AbortError') {
          statusText.value = '已取消导出'
          isStatusError.value = false
          return
        }
      }
    }

    // 回退到传统下载方式
    downloadPlt(pltContent, fileName)
    statusText.value = `已导出：${fileName}`
    isStatusError.value = false
  } catch (error) {
    statusText.value = error instanceof Error ? error.message : '导出失败'
    isStatusError.value = true
    console.error('[home] PLT 导出失败:', error)
  }
}

// ==================== 草稿管理函数 ====================

/**
 * 恢复默认参数
 */
function resetToDefaults(): void {
  Object.assign(processParams, DEFAULT_PARAMS)
  statusText.value = '已恢复默认参数'
  isStatusError.value = false
}

/**
 * 保存当前草稿
 */
function saveCurrentDraft(): void {
  if (!processedBinary.value || !draftNameInput.value.trim()) return

  const thumbnail = createThumbnail(processedBinary.value)
  drafts.value = saveDraft(draftNameInput.value.trim(), thumbnail, { ...processParams })
  selectedDraftId.value = drafts.value[0]?.id ?? ''
  draftNameInput.value = ''

  statusText.value = '草稿已保存'
  isStatusError.value = false
}

/**
 * 加载选中的草稿
 */
function loadSelectedDraft(id: string): void {
  if (!id) return

  const draft = drafts.value.find((d) => d.id === id)
  if (!draft) return

  Object.assign(processParams, draft.params)
  statusText.value = `已加载草稿：${draft.name}`
  isStatusError.value = false
}

/**
 * 删除选中的草稿
 */
function deleteSelectedDraft(): void {
  if (!selectedDraftId.value) return

  drafts.value = deleteDraft(selectedDraftId.value)
  selectedDraftId.value = ''
  statusText.value = '草稿已删除'
  isStatusError.value = false
}

// ==================== 监听器 ====================

// 监听参数变化，触发防抖处理
watch(
  () => [
    processParams.threshold,
    processParams.blur,
    processParams.invert,
    processParams.noiseFilter,
    processParams.erode,
    processParams.smooth,
  ],
  () => {
    if (sourceImageData.value) {
      scheduleProcessing()
    }
  },
)

// 监听显示模式变化，重新渲染
watch(viewMode, () => {
  if (processedBinary.value && processedContours.value) {
    renderContourPreview(processedBinary.value, processedContours.value)
  }
})

// 监听选中草稿变化，加载草稿
watch(selectedDraftId, loadSelectedDraft)

// 组件卸载前清理定时器
onBeforeUnmount(() => {
  if (processTimer) {
    clearTimeout(processTimer)
  }
})
</script>

<template>
  <div class="app-shell">
    <!-- 顶部导航栏 -->
    <header class="topbar">
      <div class="brand">
        <h1>img2plt — 图片转 PLT</h1>
      </div>
      <div class="topbar-actions">
        <span class="privacy-badge">
          <i />
          浏览器本地渲染
        </span>
        <button class="button ghost" @click="resetToDefaults">恢复默认</button>
        <button class="button primary" :disabled="!canExportPlt" @click="exportPltFile">
          {{ isProcessing ? '处理中…' : '导出 PLT' }}
        </button>
      </div>
    </header>

    <!-- 工作区 -->
    <section class="workspace">
      <!-- 左侧控制面板 -->
      <aside class="controls-panel">
        <!-- 文件处理区域 -->
        <div class="panel-heading">
          <div>
            <span>01</span>
            <h2>文件处理</h2>
          </div>
          <p>图片可转换为 PLT；PLT 文件可直接预览</p>
        </div>

        <!-- 拖放上传区域 -->
        <div
          class="drop-zone"
          :class="{ 'drag-over': isDragging }"
          @dragover.prevent="isDragging = true"
          @dragleave="isDragging = false"
          @drop.prevent="handleFileDrop"
        >
          <div class="drop-icon">+</div>
          <p>拖放图片或 PLT 到此处</p>
          <p class="drop-hint">支持 JPG / PNG / WEBP / BMP / TIFF / PLT</p>
          <input
            ref="fileInputRef"
            type="file"
            accept="image/jpeg,image/png,image/bmp,image/tiff,image/webp,.plt"
            hidden
            @change="handleFileInputChange"
          />
          <button class="button" @click="openFilePicker">选择文件…</button>
        </div>

        <p class="file-info" :class="{ empty: sourceKind === 'none' }">
          {{ fileInfoText }}
        </p>

        <!-- 处理参数（仅图片模式显示） -->
        <template v-if="sourceKind !== 'plt'">
          <div class="section-rule"><span>处理参数</span></div>
          <p class="perf-notice">⚡ 大尺寸图片处理可能耗时 1~3 秒，属正常现象</p>

          <label>
            二值化阈值
            <span>{{ processParams.threshold }}</span>
          </label>
          <input
            v-model.number="processParams.threshold"
            class="config-slider"
            type="range"
            min="0"
            max="255"
          />

          <label>
            平滑（模糊）
            <span>{{ processParams.blur }}</span>
          </label>
          <input
            v-model.number="processParams.blur"
            class="config-slider"
            type="range"
            min="1"
            max="15"
            step="2"
          />

          <label>
            曲线平滑
            <span>{{ processParams.smooth }}</span>
          </label>
          <input
            v-model.number="processParams.smooth"
            class="config-slider"
            type="range"
            min="0"
            max="5"
            step="0.5"
          />

          <label>
            分离 / px
            <span>{{ processParams.erode }}</span>
          </label>
          <input
            v-model.number="processParams.erode"
            class="config-slider"
            type="range"
            min="0"
            max="5"
          />

          <!-- 底部参数行：宽度 + 反相 + 去噪点 -->
          <div class="bottom-params-row">
            <label class="width-label">
              宽度 mm
              <input
                v-model.number="processParams.widthMm"
                class="config-input"
                type="number"
                min="10"
                max="2000"
              />
            </label>
            <div class="switch-row">
              <label>
                <input v-model="processParams.invert" type="checkbox" />
                <span />
                反相
              </label>
              <label>
                <input v-model="processParams.noiseFilter" type="checkbox" />
                <span />
                去噪点
              </label>
            </div>
          </div>

          <p class="field-note param-status" :class="{ busy: isProcessing }">
            {{ isProcessing ? '⏳ 处理中…' : '✓ 参数调整实时生效' }}
          </p>
        </template>

        <!-- 个人草稿区域 -->
        <div class="section-rule"><span>个人草稿</span></div>
        <div class="save-row">
          <input v-model="draftNameInput" maxlength="60" placeholder="草稿名称" />
          <button class="icon-button" :disabled="!processedBinary" @click="saveCurrentDraft">
            💾
          </button>
        </div>
        <div class="save-row">
          <select v-model="selectedDraftId">
            <option value="">选择本机草稿</option>
            <option v-for="draft in drafts" :key="draft.id" :value="draft.id">
              {{ draft.name }}
            </option>
          </select>
          <button class="icon-button danger" @click="deleteSelectedDraft">🗑</button>
        </div>
        <p class="field-note">个人草稿仅保存在这台电脑。</p>
      </aside>

      <!-- 右侧预览区 -->
      <section class="preview-column">
        <!-- 预览工具栏 -->
        <div class="preview-toolbar">
          <strong>预览</strong>
          <div class="preview-toolbar-center">
            <button
              v-if="sourceKind !== 'plt'"
              class="button ghost small"
              @click="layoutMode = layoutMode === 'side' ? 'stack' : 'side'"
            >
              {{ layoutMode === 'side' ? '⇅ 上下对比' : '⇆ 左右对比' }}
            </button>
            <button
              v-if="sourceKind === 'image'"
              class="button ghost small"
              @click="viewMode = viewMode === 'bw' ? 'redline' : 'bw'"
            >
              {{ viewMode === 'bw' ? '◯ 红线模式' : '⬤ 黑白模式' }}
            </button>
            <button v-if="sourceKind !== 'none'" class="button ghost small" @click="resetViewport">
              复位视图
            </button>
          </div>
          <span class="map-state" :class="{ error: isStatusError }">
            <i />
            {{ statusText }}
          </span>
        </div>

        <!-- PLT 模式预览 -->
        <div v-if="sourceKind === 'plt'" class="plt-preview">
          <div class="pane-label">PLT 预览</div>
          <div
            class="preview-box canvas-viewport"
            @wheel="handlePreviewWheel"
            @mousedown="handlePreviewPointerDown"
            @mousemove="handlePreviewPointerMove"
            @mouseup="stopPreviewDrag"
            @mouseleave="stopPreviewDrag"
          >
            <canvas ref="previewCanvasRef" :style="previewCanvasStyle" />
          </div>
        </div>

        <!-- 图片模式双预览对比 -->
        <div v-else class="preview-pair" :class="{ 'preview-stack': layoutMode === 'stack' }">
          <div class="preview-pane">
            <div class="pane-label">原图</div>
            <div class="preview-box">
              <img
                v-if="originalImageSrc"
                class="preview-img"
                :src="originalImageSrc"
                alt="原图预览"
              />
              <span v-else class="empty-msg">请选择图片</span>
            </div>
          </div>
          <div class="preview-pane">
            <div class="pane-label">
              {{ viewMode === 'bw' ? '二值化' : '红线路径' }}
            </div>
            <div
              class="preview-box canvas-viewport"
              @wheel="handlePreviewWheel"
              @mousedown="handlePreviewPointerDown"
              @mousemove="handlePreviewPointerMove"
              @mouseup="stopPreviewDrag"
              @mouseleave="stopPreviewDrag"
            >
              <canvas ref="previewCanvasRef" :style="previewCanvasStyle" />
            </div>
          </div>
        </div>

        <!-- 预览底部栏 -->
        <div class="preview-footer footer-centered">
          <span>img2plt - 图片转 PLT 工具</span>
        </div>
      </section>
    </section>
  </div>
</template>

<style scoped>
/* 性能提示 */
.perf-notice {
  margin: -8px 0 4px;
  padding: 6px 10px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: var(--radius-sm);
  color: #92400e;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.5;
}

/* 参数状态 */
.param-status {
  margin-top: 8px;
  color: var(--accent);
  font-weight: 500;
}
.param-status.busy {
  color: #b45309;
}

/* 底部参数行 */
.bottom-params-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 4px;
  border-top: 1px solid var(--border);
}
.bottom-params-row .width-label {
  flex: 0 0 100px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}
.bottom-params-row .switch-row {
  flex: 1;
  justify-content: flex-end;
}
</style>
