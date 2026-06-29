/**
 * 图像处理管道模块
 * 纯 TypeScript 实现，对应 Python OpenCV 处理流程：
 *   灰度化 → 高斯模糊 → 二值化 → 形态学开运算 → 腐蚀 → 反相
 *
 * 与 Python 参考实现的差异：
 *   - 透明像素转换为白色背景（255），而非黑色（0）
 *   - 用户通过 invert 参数控制反相，不自动反相
 */

// ==================== 类型定义 ====================

/**
 * 图像处理参数接口
 */
export interface ProcessParams {
  /** 二值化阈值 (0-255)，值越高越多像素变为黑色 */
  threshold: number
  /** 高斯模糊核大小，必须为奇数 */
  blur: number
  /** 是否反相黑白 */
  invert: boolean
  /** 是否启用噪点过滤（形态学开运算） */
  noiseFilter: boolean
  /** 腐蚀迭代次数 (0 表示不腐蚀) */
  erode: number
}

/**
 * 图像处理结果接口
 */
export interface ProcessResult {
  /** 二值化后的图像数据（每个通道值为 0 或 255） */
  binary: ImageData
  /** 图像宽度 */
  width: number
  /** 图像高度 */
  height: number
}

// ==================== 主处理函数 ====================

/**
 * 主处理管道函数：将原始 ImageData 处理为可用于轮廓提取的二值图像
 * 处理流程：灰度化 → 高斯模糊 → 二值化 → 形态学开运算 → 腐蚀 → 反相
 *
 * @param source - 原始图像数据
 * @param params - 处理参数
 * @returns 处理结果，包含二值图像及尺寸信息
 */
export function processImage(source: ImageData, params: ProcessParams): ProcessResult {
  const { width, height } = source

  // 步骤1：RGBA 转灰度图
  let grayData: Uint8Array = rgbaToGray(source)

  // 步骤2：高斯模糊（使用3次盒模糊近似）
  const blurKernel = ensureOddKernel(params.blur)
  if (blurKernel > 1) {
    grayData = gaussianBlur(grayData, width, height, blurKernel)
  }

  // 步骤3：二值化
  // 像素值 >= 阈值 → 255（白色/背景），否则 → 0（黑色/内容）
  let binaryData: Uint8Array = binaryThreshold(grayData, params.threshold)

  // 步骤4：噪点过滤（形态学开运算：先腐蚀后膨胀）
  if (params.noiseFilter) {
    binaryData = morphologicalOpen(binaryData, width, height, 1)
  }

  // 步骤5：腐蚀操作
  if (params.erode > 0) {
    const kernelSize = params.erode + 2
    for (let i = 0; i < params.erode; i++) {
      binaryData = erode(binaryData, width, height, kernelSize)
    }
  }

  // 步骤6：用户指定的反相操作
  if (params.invert) {
    binaryData = invertBinary(binaryData)
  }

  // 将 Uint8Array 转换回 ImageData 格式
  const resultImageData = grayToImageData(binaryData, width, height)

  return {
    binary: resultImageData,
    width,
    height,
  }
}

// ==================== 图像加载函数 ====================

/**
 * 加载图片文件并返回 ImageData
 * 透明像素会被转换为白色背景，与 Python 行为一致
 *
 * @param file - 图片文件对象
 * @returns 包含图像数据和图像元素的 Promise
 */
export function loadImageToData(file: File): Promise<{ data: ImageData; image: HTMLImageElement }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (): void => {
      const img = new Image()

      img.onload = (): void => {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('浏览器不支持 Canvas 2D 上下文'))
          return
        }

        // 先填充白色背景（对应 Python: np.where(alpha > 0, rgb, 255)）
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0)

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        resolve({ data: imageData, image: img })
      }

      img.onerror = (): void => {
        reject(new Error('图片加载失败'))
      }

      img.src = reader.result as string
    }

    reader.onerror = (): void => {
      reject(new Error('文件读取失败'))
    }

    reader.readAsDataURL(file)
  })
}

// ==================== 灰度转换函数 ====================

/**
 * 将 RGBA 格式的 ImageData 转换为灰度数组
 * 使用亮度公式：0.299R + 0.587G + 0.114B
 *
 * @param source - 原始 RGBA 图像数据
 * @returns 灰度值数组
 */
function rgbaToGray(source: ImageData): Uint8Array {
  const pixels = source.data
  const pixelCount = source.width * source.height
  const gray = new Uint8Array(pixelCount)

  for (let i = 0; i < pixelCount; i++) {
    const idx = i * 4
    // 人眼对绿色敏感度最高，蓝色最低
    gray[i] = Math.round(0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2])
  }

  return gray
}

/**
 * 将灰度数组转换回 ImageData 格式
 *
 * @param gray - 灰度值数组
 * @param width - 图像宽度
 * @param height - 图像高度
 * @returns RGBA 格式的 ImageData
 */
function grayToImageData(gray: Uint8Array, width: number, height: number): ImageData {
  const result = new ImageData(width, height)

  for (let i = 0; i < gray.length; i++) {
    const val = gray[i]
    const idx = i * 4
    result.data[idx] = val // R
    result.data[idx + 1] = val // G
    result.data[idx + 2] = val // B
    result.data[idx + 3] = 255 // A (完全不透明)
  }

  return result
}

// ==================== 高斯模糊相关函数 ====================

/**
 * 确保核大小为奇数
 *
 * @param kernelSize - 输入的核大小
 * @returns 调整后的奇数值
 */
function ensureOddKernel(kernelSize: number): number {
  return kernelSize % 2 === 0 ? kernelSize + 1 : kernelSize
}

/**
 * 可分离的高斯模糊（使用3次盒模糊近似）
 *
 * @param src - 输入灰度数组
 * @param width - 图像宽度
 * @param height - 图像高度
 * @param kernelSize - 核大小（奇数）
 * @returns 模糊后的灰度数组
 */
function gaussianBlur(
  src: Uint8Array,
  width: number,
  height: number,
  kernelSize: number,
): Uint8Array {
  const radius = Math.floor(kernelSize / 2)
  let result = src

  // 计算3次盒模糊的核大小，近似高斯模糊效果
  const boxSizes = computeBoxSizes(radius * 2 + 1, 3)

  for (const boxSize of boxSizes) {
    result = boxBlur(result, width, height, Math.floor(boxSize / 2))
  }

  return result
}

/**
 * 计算 n 次盒模糊的核大小，使其近似 sigma 对应的高斯模糊
 *
 * @param sigma - 高斯标准差
 * @param n - 盒模糊次数
 * @returns 各次盒模糊的核大小数组
 */
function computeBoxSizes(sigma: number, n: number): number[] {
  const wIdeal = Math.sqrt((12 * sigma * sigma) / n + 1)
  let wl = Math.floor(wIdeal)

  // 确保为奇数
  if (wl % 2 === 0) {
    wl -= 1
  }

  const wu = wl + 2
  const mIdeal = (12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4)
  const m = Math.round(mIdeal)

  const sizes: number[] = []
  for (let i = 0; i < n; i++) {
    sizes.push(i < m ? wl : wu)
  }

  return sizes
}

/**
 * 单次盒模糊（先水平后垂直）
 *
 * @param src - 输入灰度数组
 * @param width - 图像宽度
 * @param height - 图像高度
 * @param radius - 模糊半径
 * @returns 模糊后的灰度数组
 */
function boxBlur(src: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  const temp = new Uint8Array(width * height)
  const dst = new Uint8Array(width * height)
  const iarr = 1 / (radius + radius + 1) // 倒数，用于避免除法

  // ===== 水平方向模糊 =====
  for (let y = 0; y < height; y++) {
    let ti = 0
    const li = y * width
    let ri = li + radius

    const firstVal = src[li]
    const lastVal = src[li + width - 1]

    // 初始窗口和
    let sum = (radius + 1) * firstVal
    for (let j = 0; j < radius; j++) {
      sum += src[li + j]
    }

    // 左边缘
    for (let j = 0; j <= radius; j++) {
      sum += src[ri++] - firstVal
      temp[li + ti++] = Math.round(sum * iarr)
    }

    // 中间区域
    for (let j = radius + 1; j < width - radius; j++) {
      sum += src[ri++] - src[li + j - radius - 1]
      temp[li + ti++] = Math.round(sum * iarr)
    }

    // 右边缘
    for (let j = width - radius; j < width; j++) {
      sum += lastVal - src[li + j - radius - 1]
      temp[li + ti++] = Math.round(sum * iarr)
    }
  }

  // ===== 垂直方向模糊 =====
  for (let x = 0; x < width; x++) {
    let ti = 0
    const li = x
    let ri = li + radius * width

    const firstVal = temp[li]
    const lastVal = temp[li + width * (height - 1)]

    // 初始窗口和
    let sum = (radius + 1) * firstVal
    for (let j = 0; j < radius; j++) {
      sum += temp[li + j * width]
    }

    // 上边缘
    for (let j = 0; j <= radius; j++) {
      sum += temp[ri] - firstVal
      dst[li + ti * width] = Math.round(sum * iarr)
      ri += width
      ti++
    }

    // 中间区域
    for (let j = radius + 1; j < height - radius; j++) {
      sum += temp[ri] - temp[li + (j - radius - 1) * width]
      dst[li + ti * width] = Math.round(sum * iarr)
      ri += width
      ti++
    }

    // 下边缘
    for (let j = height - radius; j < height; j++) {
      sum += lastVal - temp[li + (j - radius - 1) * width]
      dst[li + ti * width] = Math.round(sum * iarr)
      ti++
    }
  }

  return dst
}

// ==================== 二值化函数 ====================

/**
 * 二值化阈值处理
 * 像素值 >= 阈值 → 255（白色），否则 → 0（黑色）
 *
 * @param src - 输入灰度数组
 * @param threshold - 阈值 (0-255)
 * @returns 二值化数组
 */
function binaryThreshold(src: Uint8Array, threshold: number): Uint8Array {
  const len = src.length
  const dst = new Uint8Array(len)

  for (let i = 0; i < len; i++) {
    dst[i] = src[i] >= threshold ? 255 : 0
  }

  return dst
}

// ==================== 形态学操作函数 ====================

/**
 * 形态学开运算：先腐蚀后膨胀
 * 用于去除小的噪点，断开细小连接
 *
 * @param src - 输入二值数组
 * @param width - 图像宽度
 * @param height - 图像高度
 * @param radius - 结构元素半径
 * @returns 开运算结果
 */
function morphologicalOpen(
  src: Uint8Array,
  width: number,
  height: number,
  radius: number,
): Uint8Array {
  const kernelSize = radius * 2 + 1
  const eroded = erode(src, width, height, kernelSize)
  return dilate(eroded, width, height, kernelSize)
}

/**
 * 形态学腐蚀
 * 只有当结构元素内所有像素都为白色时，输出像素才为白色
 *
 * @param src - 输入二值数组
 * @param width - 图像宽度
 * @param height - 图像高度
 * @param kernelSize - 核大小
 * @returns 腐蚀结果
 */
function erode(src: Uint8Array, width: number, height: number, kernelSize: number): Uint8Array {
  const dst = new Uint8Array(width * height)
  const radius = Math.floor(kernelSize / 2)
  const offsets = buildKernelOffsets(radius)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x

      // 优化：如果当前像素已经是黑色，直接输出黑色
      if (src[idx] === 0) {
        dst[idx] = 0
        continue
      }

      let allWhite = true
      for (const [dx, dy] of offsets) {
        const nx = x + dx
        const ny = y + dy

        // 边界外的像素视为白色（不影响腐蚀结果）
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
          continue
        }

        if (src[ny * width + nx] === 0) {
          allWhite = false
          break
        }
      }

      dst[idx] = allWhite ? 255 : 0
    }
  }

  return dst
}

/**
 * 形态学膨胀
 * 只要结构元素内有一个像素为白色，输出像素就为白色
 *
 * @param src - 输入二值数组
 * @param width - 图像宽度
 * @param height - 图像高度
 * @param kernelSize - 核大小
 * @returns 膨胀结果
 */
function dilate(src: Uint8Array, width: number, height: number, kernelSize: number): Uint8Array {
  const dst = new Uint8Array(width * height)
  const radius = Math.floor(kernelSize / 2)
  const offsets = buildKernelOffsets(radius)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x

      // 优化：如果当前像素已经是白色，直接输出白色
      if (src[idx] === 255) {
        dst[idx] = 255
        continue
      }

      let anyWhite = false
      for (const [dx, dy] of offsets) {
        const nx = x + dx
        const ny = y + dy

        // 边界外的像素视为黑色（不影响膨胀结果）
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
          continue
        }

        if (src[ny * width + nx] === 255) {
          anyWhite = true
          break
        }
      }

      dst[idx] = anyWhite ? 255 : 0
    }
  }

  return dst
}

/**
 * 构建方形结构元素的偏移量数组
 *
 * @param radius - 结构元素半径
 * @returns 偏移量数组 [dx, dy][]
 */
function buildKernelOffsets(radius: number): [number, number][] {
  const offsets: [number, number][] = []

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      offsets.push([dx, dy])
    }
  }

  return offsets
}

// ==================== 反相函数 ====================

/**
 * 反相二值图像：0 ↔ 255
 *
 * @param src - 输入二值数组
 * @returns 反相后的数组
 */
function invertBinary(src: Uint8Array): Uint8Array {
  const dst = new Uint8Array(src.length)

  for (let i = 0; i < src.length; i++) {
    dst[i] = src[i] === 0 ? 255 : 0
  }

  return dst
}
