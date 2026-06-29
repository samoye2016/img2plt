/**
 * 本地草稿存储工具模块
 * 使用 localStorage 存储 PLT 图像转换草稿，支持增删查操作
 */

// ==================== 常量定义 ====================

/** localStorage 存储键名 */
const STORAGE_KEY = 'img2plt:drafts'

/** 最大草稿数量限制 */
const MAX_DRAFTS = 20

/** 缩略图最大尺寸（像素） */
const THUMBNAIL_MAX_SIZE = 120

// ==================== 类型定义 ====================

/**
 * 草稿参数接口
 * 包含图像转换的所有可调参数
 */
export interface PltDraftParams {
  /** 二值化阈值 (0-255) */
  threshold: number
  /** 高斯模糊核大小 */
  blur: number
  /** 是否反相黑白 */
  invert: boolean
  /** 是否启用噪点过滤 */
  noiseFilter: boolean
  /** 腐蚀迭代次数 */
  erode: number
  /** 平滑程度 */
  smooth: number
  /** 输出宽度（毫米） */
  widthMm: number
}

/**
 * 草稿数据接口
 * 包含草稿的完整信息
 */
export interface PltDraft {
  /** 草稿唯一标识 */
  id: string
  /** 草稿名称 */
  name: string
  /** 缩略图 dataURL */
  thumbnail: string
  /** 转换参数 */
  params: PltDraftParams
  /** 创建时间（ISO 格式字符串） */
  createdAt: string
}

// ==================== 内部工具函数 ====================

/**
 * 从 localStorage 读取原始草稿数据
 *
 * @returns 解析后的草稿数组，解析失败返回空数组
 */
function readDraftsFromStorage(): PltDraft[] {
  try {
    const rawData = localStorage.getItem(STORAGE_KEY)
    if (!rawData) {
      return []
    }
    const drafts = JSON.parse(rawData) as PltDraft[]
    return Array.isArray(drafts) ? drafts : []
  } catch (error) {
    console.warn('[storage] 读取草稿数据失败:', error)
    return []
  }
}

/**
 * 将草稿数据写入 localStorage
 *
 * @param drafts - 草稿数组
 * @returns 是否写入成功
 */
function writeDraftsToStorage(drafts: PltDraft[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts))
    return true
  } catch (error) {
    console.warn('[storage] 保存草稿数据失败:', error)
    return false
  }
}

// ==================== 对外 API ====================

/**
 * 加载所有草稿列表
 * 按创建时间倒序排列（最新的在前）
 *
 * @returns 草稿数组，读取失败返回空数组
 */
export function loadDrafts(): PltDraft[] {
  const drafts = readDraftsFromStorage()

  // 按创建时间倒序排序
  return drafts.sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime()
    const timeB = new Date(b.createdAt).getTime()
    return timeB - timeA
  })
}

/**
 * 保存新草稿
 * 新草稿会添加到列表开头，超出最大数量时自动删除最旧的草稿
 *
 * @param name - 草稿名称
 * @param thumbnail - 缩略图 dataURL
 * @param params - 转换参数
 * @returns 更新后的草稿列表
 */
export function saveDraft(name: string, thumbnail: string, params: PltDraftParams): PltDraft[] {
  // 加载现有草稿
  const drafts = readDraftsFromStorage()

  // 创建新草稿对象
  const newDraft: PltDraft = {
    id: crypto.randomUUID(),
    name,
    thumbnail,
    params,
    createdAt: new Date().toISOString(),
  }

  // 新草稿添加到开头
  drafts.unshift(newDraft)

  // 超出最大数量时删除最旧的
  if (drafts.length > MAX_DRAFTS) {
    drafts.length = MAX_DRAFTS
  }

  // 写入存储
  writeDraftsToStorage(drafts)

  return drafts
}

/**
 * 删除指定草稿
 *
 * @param id - 要删除的草稿 ID
 * @returns 更新后的草稿列表
 */
export function deleteDraft(id: string): PltDraft[] {
  const drafts = readDraftsFromStorage()
  const filteredDrafts = drafts.filter((draft) => draft.id !== id)
  writeDraftsToStorage(filteredDrafts)
  return filteredDrafts
}

/**
 * 从二值图生成缩略图 dataURL
 * 按比例缩放到最大尺寸内，保持宽高比
 *
 * @param binary - 二值图像数据
 * @param maxSize - 缩略图最大尺寸（像素），默认 120px
 * @returns 缩略图的 PNG dataURL，生成失败返回空字符串
 */
export function createThumbnail(binary: ImageData, maxSize: number = THUMBNAIL_MAX_SIZE): string {
  try {
    // 计算缩放比例（保持宽高比，不放大）
    const scale = Math.min(1, maxSize / Math.max(binary.width, binary.height))
    const thumbWidth = Math.round(binary.width * scale)
    const thumbHeight = Math.round(binary.height * scale)

    // 创建目标画布
    const canvas = document.createElement('canvas')
    canvas.width = thumbWidth
    canvas.height = thumbHeight
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      console.warn('[storage] 无法获取画布 2D 上下文')
      return ''
    }

    // 创建源画布用于绘制 ImageData
    const srcCanvas = document.createElement('canvas')
    srcCanvas.width = binary.width
    srcCanvas.height = binary.height
    const srcCtx = srcCanvas.getContext('2d')

    if (!srcCtx) {
      console.warn('[storage] 无法获取源画布 2D 上下文')
      return ''
    }

    // 将二值图绘制到源画布
    srcCtx.putImageData(binary, 0, 0)

    // 缩放绘制到目标画布
    ctx.drawImage(srcCanvas, 0, 0, thumbWidth, thumbHeight)

    // 导出为 PNG 格式（质量 0.7 平衡体积和清晰度）
    return canvas.toDataURL('image/png', 0.7)
  } catch (error) {
    console.warn('[storage] 生成缩略图失败:', error)
    return ''
  }
}
