/**
 * PLT (HPGL) 文件生成与解析模块
 * 用于激光雕刻等场景的矢量图形处理
 *
 * HPGL 单位说明：
 *   - 40 HPGL 单位 = 1 毫米
 *   - 坐标原点在左下角，Y 轴向上
 */

// ==================== 常量定义 ====================

/** HPGL 单位与毫米的换算比例：40 units = 1mm */
const HPGL_UNITS_PER_MM = 40

// ==================== 类型定义 ====================

/**
 * PLT 导出选项
 */
export interface PltExportOptions {
  /** 物理宽度（毫米） */
  widthMm: number
  /** 物理高度（毫米） */
  heightMm: number
}

/**
 * PLT 坐标点
 */
export interface PltPoint {
  x: number
  y: number
}

/**
 * PLT 路径（由多个点组成的连续线段）
 */
export interface PltPath {
  points: PltPoint[]
}

/**
 * PLT 路径边界框
 */
export interface PltBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
}

/**
 * 解析后的 PLT 文件结构
 */
export interface ParsedPlt {
  paths: PltPath[]
  bounds: PltBounds
  pointCount: number
}

// ==================== 内部辅助函数：坐标转换 ====================

/**
 * 像素坐标转换为 HPGL 坐标
 *  - 缩放：像素 → HPGL 单位
 *  - Y 轴翻转：画布左上角 → HPGL 左下角
 *
 * @param px - 像素 x 坐标
 * @param py - 像素 y 坐标
 * @param scaleX - X 轴缩放比例
 * @param scaleY - Y 轴缩放比例
 * @param hpglWidth - HPGL 坐标系总宽度
 * @param hpglHeight - HPGL 坐标系总高度（用于 Y 轴翻转）
 * @returns HPGL 坐标点
 */
function pixelToHpgl(
  px: number,
  py: number,
  scaleX: number,
  scaleY: number,
  hpglWidth: number,
  hpglHeight: number,
): PltPoint {
  const hx = Math.max(0, Math.min(hpglWidth, Math.round(px * scaleX)))
  const hy = hpglHeight - Math.max(0, Math.min(hpglHeight, Math.round(py * scaleY)))
  return { x: hx, y: hy }
}

/**
 * 使用鞋带公式计算多边形面积
 *
 * @param polygon - 多边形点数组 [[x, y], ...]
 * @returns 面积（像素²）
 */
function polygonArea(polygon: number[][]): number {
  let area = 0
  const n = polygon.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += polygon[i][0] * polygon[j][1]
    area -= polygon[j][0] * polygon[i][1]
  }
  return Math.abs(area) / 2
}

/**
 * 检查轮廓是否闭合（首尾点是否相同）
 *
 * @param contour - 轮廓点数组
 * @returns 是否闭合
 */
function isContourClosed(contour: number[][]): boolean {
  if (contour.length < 2) return true
  const first = contour[0]
  const last = contour[contour.length - 1]
  return first[0] === last[0] && first[1] === last[1]
}

// ==================== 导出函数：generatePlt ====================

/**
 * 从图像轮廓生成 HPGL 格式的 PLT 文件内容
 *
 * 功能特点：
 * 1. 像素坐标 → HPGL 单位转换（40 units = 1mm）
 * 2. Y 轴翻转（画布左上角 → HPGL 左下角）
 * 3. 按面积从大到小排序轮廓（优化雕刻顺序）
 * 4. 自动闭合未闭合的轮廓
 *
 * @param contours - 轮廓数组，每个轮廓是 [[x, y], ...] 像素坐标
 * @param imageWidth - 图像宽度（像素）
 * @param imageHeight - 图像高度（像素）
 * @param options - 导出选项（物理尺寸）
 * @returns PLT 文件内容字符串
 */
export function generatePlt(
  contours: number[][][],
  imageWidth: number,
  imageHeight: number,
  options: PltExportOptions,
): string {
  const { widthMm, heightMm } = options

  // 计算 HPGL 坐标系下的物理尺寸
  const hpglWidth = Math.round(widthMm * HPGL_UNITS_PER_MM)
  const hpglHeight = Math.round(heightMm * HPGL_UNITS_PER_MM)

  // 计算像素到 HPGL 单位的缩放比例
  const scaleX = hpglWidth / imageWidth
  const scaleY = hpglHeight / imageHeight

  // HPGL 指令行数组
  const lines: string[] = [
    'IN;', // 初始化
    'PU;', // 抬笔
    'SP 1;', // 选择 1 号笔
  ]

  // 按面积从大到小排序轮廓（优化雕刻顺序，先雕刻大轮廓）
  const sortedContours = [...contours].sort((a, b) => {
    const areaA = polygonArea(a)
    const areaB = polygonArea(b)
    return areaB - areaA
  })

  // 遍历每个轮廓生成 HPGL 指令
  for (const contour of sortedContours) {
    // 点数太少的轮廓跳过
    if (contour.length < 2) continue

    // 遍历轮廓上的每个点
    for (let i = 0; i < contour.length; i++) {
      const [px, py] = contour[i]
      const point = pixelToHpgl(px, py, scaleX, scaleY, hpglWidth, hpglHeight)

      if (i === 0) {
        // 第一个点：抬笔移动到起点，然后落笔
        lines.push(`PU;PA${point.x},${point.y};`)
        lines.push('PD;')
      } else {
        // 后续点：落笔移动
        lines.push(`PA${point.x},${point.y};`)
      }
    }

    // 如果轮廓未闭合，补充闭合点
    if (contour.length > 2 && !isContourClosed(contour)) {
      const [firstPx, firstPy] = contour[0]
      const firstPoint = pixelToHpgl(firstPx, firstPy, scaleX, scaleY, hpglWidth, hpglHeight)
      lines.push(`PA${firstPoint.x},${firstPoint.y};`)
    }

    // 轮廓结束，抬笔
    lines.push('PU;')
  }

  // 文件结束指令
  lines.push('SP 0;') // 放下笔
  lines.push('PG;') // 换页（结束标记）

  return lines.join('\n')
}

// ==================== 导出函数：downloadPlt ====================

/**
 * 将 PLT 内容作为文件下载到本地
 *
 * @param pltContent - PLT 文件内容字符串
 * @param fileName - 下载文件名（含扩展名，如 "output.plt"）
 */
export function downloadPlt(pltContent: string, fileName: string): void {
  // 创建 Blob 对象
  const blob = new Blob([pltContent], { type: 'application/octet-stream' })

  // 创建临时 URL
  const url = URL.createObjectURL(blob)

  // 创建临时 a 标签触发下载
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()

  // 释放临时 URL
  URL.revokeObjectURL(url)
}

// ==================== 内部辅助函数：解析相关 ====================

/**
 * 解析坐标对字符串，提取点数组
 * 支持格式："x1,y1 x2,y2" 或 "x1,y1,x2,y2" 等
 *
 * @param args - 参数字符串
 * @returns 点数组
 */
function parseCoordinatePairs(args: string): PltPoint[] {
  if (!args) return []

  // 按逗号或空白分割，过滤空字符串，转换为数字
  const numbers = args
    .split(/[\s,]+/)
    .map((part) => Number(part))
    .filter((value) => Number.isFinite(value))

  const points: PltPoint[] = []
  // 每两个数字组成一个点
  for (let index = 0; index + 1 < numbers.length; index += 2) {
    points.push({ x: numbers[index], y: numbers[index + 1] })
  }
  return points
}

/**
 * 将相对坐标点转换为绝对坐标点
 *
 * @param points - 相对坐标点数组
 * @param start - 起始绝对坐标
 * @returns 绝对坐标点数组
 */
function resolveRelativePoints(points: PltPoint[], start: PltPoint): PltPoint[] {
  const resolved: PltPoint[] = []
  let cursor = { ...start }
  for (const point of points) {
    cursor = { x: cursor.x + point.x, y: cursor.y + point.y }
    resolved.push(cursor)
  }
  return resolved
}

// ==================== 导出函数：parsePlt ====================

/**
 * 解析 PLT (HPGL) 文件内容
 *
 * 支持的指令：
 * - IN: 初始化
 * - PU: 抬笔（Pen Up）
 * - PD: 落笔（Pen Down）
 * - PA: 绝对坐标移动（Plot Absolute）
 * - PR: 相对坐标移动（Plot Relative）
 * - SP: 选择笔（Select Pen）
 * - PG: 换页（结束标记）
 *
 * @param content - PLT 文件内容字符串
 * @returns 解析结果，包含路径、边界和点数
 */
export function parsePlt(content: string): ParsedPlt {
  const paths: PltPath[] = []
  let currentPath: PltPoint[] = []
  let currentPoint: PltPoint = { x: 0, y: 0 }
  let penDown = false
  let relativeMode = false
  let pointCount = 0

  /**
   * 提交当前路径（如果有足够的点）
   */
  const commitPath = (): void => {
    if (currentPath.length > 1) {
      paths.push({ points: [...currentPath] })
    }
    currentPath = []
  }

  // 按分号分割指令
  const commands = content.split(';')

  for (const rawCommand of commands) {
    const command = rawCommand.trim()
    if (!command) continue

    // 提取操作码（前两个字符）和参数
    const op = command.slice(0, 2).toUpperCase()
    const args = command.slice(2).trim()

    switch (op) {
      case 'IN': {
        // 初始化：重置状态
        commitPath()
        currentPoint = { x: 0, y: 0 }
        penDown = false
        relativeMode = false
        break
      }

      case 'PU': {
        // 抬笔：结束当前路径，移动到新位置
        commitPath()
        penDown = false
        const rawPoints = parseCoordinatePairs(args)
        const points = relativeMode ? resolveRelativePoints(rawPoints, currentPoint) : rawPoints
        if (points.length > 0) {
          currentPoint = { ...points[points.length - 1] }
        }
        break
      }

      case 'PD': {
        // 落笔：开始新路径，可选移动到新位置
        penDown = true
        const rawPoints = parseCoordinatePairs(args)
        const points = relativeMode ? resolveRelativePoints(rawPoints, currentPoint) : rawPoints

        if (points.length === 0) {
          // 没有坐标，只标记落笔，当前点作为路径起点
          currentPath = [{ ...currentPoint }]
          break
        }

        // 落笔移动，将当前点和所有移动点加入路径
        if (currentPath.length === 0) {
          currentPath.push({ ...currentPoint })
        }
        for (const point of points) {
          currentPath.push({ ...point })
          currentPoint = { ...point }
          pointCount++
        }
        break
      }

      case 'PA': {
        // 绝对坐标移动
        relativeMode = false
        const points = parseCoordinatePairs(args)
        if (points.length === 0) break

        if (penDown && currentPath.length === 0) {
          currentPath.push({ ...currentPoint })
        }

        for (const point of points) {
          if (penDown) {
            currentPath.push({ ...point })
            pointCount++
          } else {
            commitPath()
          }
          currentPoint = { ...point }
        }
        break
      }

      case 'PR': {
        // 相对坐标移动
        relativeMode = true
        const rawPoints = parseCoordinatePairs(args)
        if (rawPoints.length === 0) break

        const points = resolveRelativePoints(rawPoints, currentPoint)

        if (penDown && currentPath.length === 0) {
          currentPath.push({ ...currentPoint })
        }

        for (const point of points) {
          if (penDown) {
            currentPath.push({ ...point })
            pointCount++
          } else {
            commitPath()
          }
          currentPoint = { ...point }
        }
        break
      }

      case 'SP':
      case 'PG': {
        // 选笔或换页：结束当前路径
        commitPath()
        break
      }

      default:
        // 忽略其他不支持的指令
        break
    }
  }

  // 最后提交一次路径
  commitPath()

  return {
    paths,
    bounds: computePltBounds(paths),
    pointCount,
  }
}

// ==================== 导出函数：computePltBounds ====================

/**
 * 计算 PLT 路径的边界框
 *
 * @param paths - PLT 路径数组
 * @returns 边界框信息
 */
export function computePltBounds(paths: PltPath[]): PltBounds {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  // 遍历所有路径的所有点，找出极值
  for (const path of paths) {
    for (const point of path.points) {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    }
  }

  // 处理空路径情况，返回默认边界
  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(maxY)
  ) {
    return {
      minX: 0,
      minY: 0,
      maxX: 1,
      maxY: 1,
      width: 1,
      height: 1,
    }
  }

  // 计算宽高，确保至少为 1
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  }
}
