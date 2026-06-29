import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'

/**
 * 响应数据的基础接口类型
 * 后端统一返回格式
 */
export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

/**
 * 创建 axios 实例
 * 配置 baseURL、超时时间等基础参数
 */
const service: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json;charset=UTF-8',
  },
})

/**
 * 请求拦截器
 * 在请求发送之前进行处理：
 * 1. 添加 token 到请求头
 * 2. 记录请求日志
 */
service.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 从 localStorage 获取 token
    const token = localStorage.getItem('token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }

    // 开发环境下打印请求日志
    if (import.meta.env.DEV) {
      console.log(
        `[Request] ${config.method?.toUpperCase()} ${config.url}`,
        config.data || config.params || '',
      )
    }

    return config
  },
  (error) => {
    // 请求错误处理
    console.error('[Request Error]', error)
    return Promise.reject(error)
  },
)

/**
 * 响应拦截器
 * 在响应到达之后进行处理：
 * 1. 统一处理响应数据
 * 2. 处理错误状态码
 * 3. 记录响应日志
 */
service.interceptors.response.use(
  (response: AxiosResponse) => {
    const res = response.data as ApiResponse

    // 开发环境下打印响应日志
    if (import.meta.env.DEV) {
      console.log(`[Response] ${response.config.method?.toUpperCase()} ${response.config.url}`, res)
    }

    // 根据业务状态码处理
    if (res.code !== 200) {
      // 401: 未授权或 token 过期
      if (res.code === 401) {
        console.error('登录状态已过期，请重新登录')
        localStorage.removeItem('token')
      } else {
        console.error(`[Business Error] ${res.message}`)
      }
      return Promise.reject(new Error(res.message || '请求失败'))
    }

    return response
  },
  (error) => {
    // HTTP 错误处理
    let errorMessage: string

    if (error.response) {
      const { status } = error.response
      switch (status) {
        case 400:
          errorMessage = '请求参数错误'
          break
        case 401:
          errorMessage = '未授权，请重新登录'
          localStorage.removeItem('token')
          break
        case 403:
          errorMessage = '拒绝访问'
          break
        case 404:
          errorMessage = '请求地址不存在'
          break
        case 500:
          errorMessage = '服务器内部错误'
          break
        case 502:
          errorMessage = '网关错误'
          break
        case 503:
          errorMessage = '服务不可用'
          break
        case 504:
          errorMessage = '网关超时'
          break
        default:
          errorMessage = `请求失败，状态码：${status}`
      }
    } else if (error.request) {
      // 请求已发出但没有收到响应
      errorMessage = '网络错误，请检查网络连接'
    } else {
      // 请求配置出错
      errorMessage = `请求配置错误：${error.message}`
    }

    console.error('[Response Error]', errorMessage)
    return Promise.reject(new Error(errorMessage))
  },
)

/**
 * 封装 GET 请求
 * @param url 请求地址
 * @param params 请求参数
 * @param config 额外配置
 * @returns Promise<ApiResponse<T>>
 */
export function get<T = unknown>(
  url: string,
  params?: Record<string, unknown>,
  config?: AxiosRequestConfig,
): Promise<ApiResponse<T>> {
  return service.get(url, { params, ...config }).then((res) => res.data as ApiResponse<T>)
}

/**
 * 封装 POST 请求
 * @param url 请求地址
 * @param data 请求数据
 * @param config 额外配置
 * @returns Promise<ApiResponse<T>>
 */
export function post<T = unknown>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<ApiResponse<T>> {
  return service.post(url, data, config).then((res) => res.data as ApiResponse<T>)
}

/**
 * 封装 PUT 请求
 * @param url 请求地址
 * @param data 请求数据
 * @param config 额外配置
 * @returns Promise<ApiResponse<T>>
 */
export function put<T = unknown>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<ApiResponse<T>> {
  return service.put(url, data, config).then((res) => res.data as ApiResponse<T>)
}

/**
 * 封装 DELETE 请求
 * @param url 请求地址
 * @param config 额外配置
 * @returns Promise<ApiResponse<T>>
 */
export function del<T = unknown>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<ApiResponse<T>> {
  return service.delete(url, config).then((res) => res.data as ApiResponse<T>)
}

// 导出 axios 实例，方便在其他地方使用
export default service
