/**
 * 轮廓提取与平滑模块
 * 实现 Suzuki-Abe 边界跟踪算法、RDP 简化、移动平均平滑、等间距重采样等功能
 *
 * 二值图约定：
 *   - 0 = 前景（内容/黑色）
 *   - 255 = 背景（白色）
 *
 * 轮廓数据格式：
 *   - number[][][] 多个轮廓，每个轮廓是 [x, y] 点数组
 */

// ==================== 类型定义 ====================

/**
 * 轮廓点类型：[x, y] 坐标
 */
export type ContourPoint = [number, number]

/**
 * 单个轮廓：点数组
 */
export type Contour = ContourPoint[]

/**
 * 多个轮廓
 */
export type Contours = Contour[]

/**
 * 轮廓处理参数接口
 */
export interface ContourProcessParams {
  /** 最小轮廓面积，小于此值的轮廓会被过滤 */
  minArea: number
  /** RDP 简化的 epsilon 值，越大简化程度越高，0 表示不简化 */
  rdpEpsilon: number
  /** 移动平均平滑窗口大小，必须为奇数，小于 3 表示不平滑 */
  smoothWindow: number
  /** 重采样间距，0 表示不重采样 */
  resampleSpacing: number
}

// ==================== 内部常量 ====================

/**
 * 8 邻域方向偏移量（顺时针，从右侧开始）
 * 用于 Suzuki-Abe 边界跟踪算法
 */
const NEIGHBOR_DIRECTIONS: ContourPoint[] = [
  [1, 0], // 0: 右
  [1, -1], // 1: 右上
  [0, -1], // 2: 上
  [-1, -1], // 3: 左上
  [-1, 0], // 4: 左
  [-1, 1], // 5: 左下
  [0, 1], // 6: 下
  [1, 1], // 7: 右下
]

// ==================== 导出函数：轮廓提取 ====================

/**
 * 从二值图像中提取轮廓
 * 使用 Suzuki-Abe 边界跟踪算法（简化版）
 *
 * 算法原理：
 * 1. 逐行扫描图像，寻找未访问的前景边界像素
 * 2. 从边界像素开始，沿 8 邻域顺时针跟踪边界
 * 3. 回到起始点时完成一个轮廓的跟踪
 * 4. 过滤掉面积过小的轮廓
 *
 * @param binary - 二值图像数据（0=前景，255=背景）
 * @param minArea - 最小轮廓面积，默认 3 像素
 * @returns 轮廓数组，每个轮廓是 [x, y] 点数组
 */
export function extractContours(binary: ImageData, minArea: number = 3): Contours {
  const { width, height, data } = binary
  const pixelCount = width * height

  // 将 ImageData 转换为二值像素数组：1=前景，0=背景
  const pixels = new Uint8Array(pixelCount)
  for (let i = 0; i < pixelCount; i++) {
    pixels[i] = data[i * 4] < 128 ? 1 : 0
  }

  // 已访问像素标记
  const visited = new Uint8Array(pixelCount)
  const contours: Contours = []

  // 逐行扫描图像
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x

      // 跳过非前景像素和已访问像素
      if (pixels[idx] !== 1 || visited[idx] === 1) {
        continue
      }

      // 检查是否为边界像素（至少有一个背景邻居）
      if (!isBorderPixel(pixels, width, height, x, y)) {
        continue
      }

      // 跟踪边界
      const contour = traceContour(pixels, width, height, x, y, visited)

      // 只保留至少 3 个点的轮廓（能构成面积）
      if (contour.length >= 3) {
        contours.push(contour)
      }
    }
  }

  // 按最小面积过滤
  return contours.filter((c) => contourArea(c) >= minArea)
}

// ==================== 导出函数：RDP 轮廓简化 ====================

/**
 * 使用 Ramer-Douglas-Peucker (RDP) 算法简化轮廓
 * 在保持轮廓形状的前提下减少点数
 *
 * 算法原理：
 * 1. 连接轮廓首尾两点形成直线
 * 2. 找出离该直线最远的点
 * 3. 若最大距离大于 epsilon，则在该点处递归分割
 * 4. 否则保留首尾两点，丢弃中间所有点
 *
 * @param contour - 输入轮廓
 * @param epsilon - 最大允许距离偏差，越大简化程度越高
 * @returns 简化后的轮廓
 */
export function simplifyRdp(contour: Contour, epsilon: number): Contour {
  // 点数不足直接返回
  if (contour.length <= 2) {
    return contour
  }

  // 找到距离首尾连线最远的点
  let maxDist = 0
  let maxIndex = 0
  const lastIndex = contour.length - 1

  for (let i = 1; i < lastIndex; i++) {
    const dist = perpendicularDistance(contour[i], contour[0], contour[lastIndex])
    if (dist > maxDist) {
      maxIndex = i
      maxDist = dist
    }
  }

  // 如果最远距离超过阈值，递归简化
  if (maxDist > epsilon) {
    // 左半部分（包含分割点）
    const leftPart = simplifyRdp(contour.slice(0, maxIndex + 1), epsilon)
    // 右半部分（包含分割点）
    const rightPart = simplifyRdp(contour.slice(maxIndex), epsilon)

    // 合并结果，避免分割点重复
    leftPart.pop()
    return leftPart.concat(rightPart)
  }

  // 否则只保留首尾两点
  return [contour[0], contour[lastIndex]]
}

// ==================== 导出函数：移动平均平滑 ====================

/**
 * 移动平均平滑轮廓
 * 通过对每个点及其邻域点取平均来消除锯齿
 *
 * 算法原理：
 * 1. 对于轮廓上每个点，取其前后 windowSize 个邻域点
 * 2. 计算这些点的坐标平均值
 * 3. 轮廓首尾采用循环边界处理（环形平滑）
 *
 * @param contour - 输入轮廓
 * @param windowSize - 平滑窗口大小，建议为奇数
 * @returns 平滑后的轮廓
 */
export function smoothMovingAverage(contour: Contour, windowSize: number): Contour {
  // 点数太少或窗口太小不进行平滑
  if (contour.length < 3 || windowSize < 3) {
    return contour
  }

  const halfWindow = Math.floor(windowSize / 2)
  const pointCount = contour.length
  const result: Contour = []

  for (let i = 0; i < pointCount; i++) {
    let sumX = 0
    let sumY = 0
    let count = 0

    // 累加窗口内的点坐标
    for (let j = -halfWindow; j <= halfWindow; j++) {
      // 循环取模，处理环形边界
      const idx = (((i + j) % pointCount) + pointCount) % pointCount
      sumX += contour[idx][0]
      sumY += contour[idx][1]
      count++
    }

    // 取平均值并四舍五入到整数像素
    result.push([Math.round(sumX / count), Math.round(sumY / count)])
  }

  return result
}

// ==================== 导出函数：等间距重采样 ====================

/**
 * 等间距重采样轮廓
 * 在轮廓曲线上按固定间距采样点，使点密度均匀
 *
 * 算法原理：
 * 1. 沿轮廓逐段累加距离
 * 2. 当累加距离达到间距时，在该线段上插值得到新点
 * 3. 重复直到遍历完整个轮廓
 *
 * @param contour - 输入轮廓
 * @param spacing - 目标点间距（像素）
 * @returns 重采样后的轮廓
 */
export function resampleEqualSpacing(contour: Contour, spacing: number): Contour {
  // 点数太少或间距无效直接返回
  if (contour.length < 2 || spacing <= 0) {
    return contour
  }

  const result: Contour = [contour[0]]
  let accumulatedDist = 0

  for (let i = 1; i < contour.length; i++) {
    const prevPoint = contour[i - 1]
    const currPoint = contour[i]
    const segDist = Math.hypot(currPoint[0] - prevPoint[0], currPoint[1] - prevPoint[1])

    accumulatedDist += segDist

    // 在当前线段上插入所有满足间距的点
    while (accumulatedDist >= spacing) {
      // 计算插值比例
      const t = 1 - (accumulatedDist - spacing) / segDist
      const x = prevPoint[0] + t * (currPoint[0] - prevPoint[0])
      const y = prevPoint[1] + t * (currPoint[1] - prevPoint[1])
      result.push([Math.round(x), Math.round(y)])
      accumulatedDist -= spacing
    }
  }

  // 确保最后一个点被包含
  const lastPoint = contour[contour.length - 1]
  const resultLast = result[result.length - 1]
  if (resultLast[0] !== lastPoint[0] || resultLast[1] !== lastPoint[1]) {
    result.push(lastPoint)
  }

  return result
}

// ==================== 导出函数：轮廓面积计算 ====================

/**
 * 计算轮廓面积（鞋带公式 / Shoelace Formula）
 *
 * 公式：Area = 1/2 * |Σ(xi * yi+1 - xi+1 * yi)|
 *
 * @param contour - 输入轮廓
 * @returns 轮廓面积（像素²）
 */
export function contourArea(contour: Contour): number {
  const n = contour.length
  if (n < 3) {
    return 0
  }

  let area = 0
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += contour[i][0] * contour[j][1]
    area -= contour[j][0] * contour[i][1]
  }

  return Math.abs(area) / 2
}

// ==================== 导出函数：完整处理管道 ====================

/**
 * 完整的轮廓处理管道
 * 依次执行：提取 → RDP 简化 → 移动平均平滑 → 等间距重采样
 *
 * @param binary - 二值图像数据
 * @param params - 处理参数
 * @returns 处理后的轮廓数组
 */
export function processContours(binary: ImageData, params: ContourProcessParams): Contours {
  const { minArea, rdpEpsilon, smoothWindow, resampleSpacing } = params

  // 步骤1：提取原始轮廓
  const rawContours = extractContours(binary, minArea)

  // 步骤2：对每个轮廓依次应用处理
  return rawContours.map((contour) => {
    let result = contour

    // RDP 简化
    if (rdpEpsilon > 0) {
      result = simplifyRdp(result, rdpEpsilon)
    }

    // 移动平均平滑（确保窗口大小为有效奇数）
    const validWindow = Math.max(3, Math.floor(smoothWindow))
    const oddWindow = validWindow % 2 === 0 ? validWindow + 1 : validWindow
    if (smoothWindow >= 3) {
      result = smoothMovingAverage(result, oddWindow)
    }

    // 等间距重采样
    if (resampleSpacing > 0) {
      result = resampleEqualSpacing(result, resampleSpacing)
    }

    return result
  })
}

// ==================== 内部辅助函数 ====================

/**
 * 检查像素是否为边界像素
 * 边界像素定义为：前景像素且至少有一个背景邻居
 *
 * @param pixels - 像素数组（1=前景，0=背景）
 * @param width - 图像宽度
 * @param height - 图像高度
 * @param x - 像素 x 坐标
 * @param y - 像素 y 坐标
 * @returns 是否为边界像素
 */
function isBorderPixel(
  pixels: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
): boolean {
  // 检查 8 邻域
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      // 跳过自身
      if (dx === 0 && dy === 0) {
        continue
      }

      const nx = x + dx
      const ny = y + dy

      // 图像边界外视为背景，因此边界像素也是边界
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
        return true
      }

      // 存在背景邻居则为边界
      if (pixels[ny * width + nx] === 0) {
        return true
      }
    }
  }

  return false
}

/**
 * 跟踪单个轮廓的边界
 * 使用 Suzuki-Abe 算法的简化版本
 *
 * @param pixels - 像素数组（1=前景，0=背景）
 * @param width - 图像宽度
 * @param height - 图像高度
 * @param startX - 起始点 x 坐标
 * @param startY - 起始点 y 坐标
 * @param visited - 已访问标记数组
 * @returns 跟踪得到的轮廓
 */
function traceContour(
  pixels: Uint8Array,
  width: number,
  height: number,
  startX: number,
  startY: number,
  visited: Uint8Array,
): Contour {
  const contour: Contour = []
  let x = startX
  let y = startY

  // 初始搜索方向：从右下方向开始顺时针搜索（索引 7）
  let currentDir = 7

  do {
    // 将当前点加入轮廓
    contour.push([x, y])
    visited[y * width + x] = 1

    // 从 (currentDir + 5) % 8 开始顺时针搜索下一个边界点
    // 这样可以保证始终沿边界外侧前进
    let found = false
    const searchStart = (currentDir + 5) % 8

    for (let i = 0; i < 8; i++) {
      const dir = (searchStart + i) % 8
      const [dx, dy] = NEIGHBOR_DIRECTIONS[dir]
      const nx = x + dx
      const ny = y + dy

      // 跳过图像边界外的点
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
        continue
      }

      // 找到前景像素，作为下一个边界点
      if (pixels[ny * width + nx] === 1) {
        x = nx
        y = ny
        currentDir = dir
        found = true
        break
      }
    }

    // 未找到下一个点，终止跟踪
    if (!found) {
      break
    }

    // 回到起始点，完成轮廓跟踪
    if (contour.length > 1 && x === startX && y === startY) {
      break
    }

    // 安全限制：防止无限循环
    if (contour.length > width * height) {
      break
    }
  } while (true)

  return contour
}

/**
 * 计算点到直线的垂直距离
 * 用于 RDP 简化算法
 *
 * @param point - 待测点
 * @param lineStart - 直线起点
 * @param lineEnd - 直线终点
 * @returns 垂直距离
 */
function perpendicularDistance(
  point: ContourPoint,
  lineStart: ContourPoint,
  lineEnd: ContourPoint,
): number {
  const [px, py] = point
  const [x1, y1] = lineStart
  const [x2, y2] = lineEnd

  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy

  // 线段退化为点，直接计算点到点距离
  if (lenSq === 0) {
    return Math.hypot(px - x1, py - y1)
  }

  // 计算点在直线上的投影参数 t，限制在 [0, 1] 范围内
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq))

  // 投影点坐标
  const projX = x1 + t * dx
  const projY = y1 + t * dy

  // 返回点到投影点的距离
  return Math.hypot(px - projX, py - projY)
}
