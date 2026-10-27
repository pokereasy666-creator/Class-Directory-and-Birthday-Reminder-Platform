import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import { ElMessage } from 'element-plus';
import router from '@/router';
import { clearToken, getToken } from '@/utils/token';

interface ApiBody<T> {
  code: number;
  message: string;
  data: T;
}

export interface RequestOptions extends AxiosRequestConfig {
  /** 为 true 时出错不自动弹出提示，由调用方自行处理 */
  silent?: boolean;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const http = axios.create({ baseURL: '/api', timeout: 15000 });

http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function handleError(err: unknown, silent: boolean): never {
  const axiosErr = err as AxiosError<ApiBody<null>>;
  const status = axiosErr.response?.status ?? 0;
  const message =
    axiosErr.response?.data?.message ??
    (status ? `请求失败（${status}）` : '网络异常，请检查网络连接');

  if (status === 401) {
    clearToken();
    const current = router.currentRoute.value;
    if (!current.meta.public) {
      ElMessage.warning(message);
      void router.replace({ name: 'login', query: { redirect: current.fullPath } });
    }
  } else if (status === 403 && message === '请先修改初始密码') {
    void router.replace({ name: 'password' });
  } else if (!silent) {
    ElMessage.error(message);
  }
  throw new ApiError(status, message);
}

/** 发送请求并解包统一响应格式，直接返回 data */
export async function request<T>(config: RequestOptions): Promise<T> {
  const { silent = false, ...rest } = config;
  try {
    const res = await http.request<ApiBody<T>>(rest);
    return res.data.data;
  } catch (err) {
    handleError(err, silent);
  }
}

/** 下载文件（如导出的 Excel），返回 Blob 与服务端给出的文件名 */
export async function download(url: string): Promise<{ blob: Blob; filename: string }> {
  try {
    const res = await http.get<Blob>(url, { responseType: 'blob' });
    const disposition = String(res.headers['content-disposition'] ?? '');
    const match = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
    return { blob: res.data, filename: match ? decodeURIComponent(match[1]) : 'download' };
  } catch (err) {
    // 出错时响应体也是 Blob，转回 JSON 读取错误信息
    const axiosErr = err as AxiosError;
    if (axiosErr.response?.data instanceof Blob) {
      try {
        axiosErr.response.data = JSON.parse(await axiosErr.response.data.text());
      } catch {
        /* 保持原样 */
      }
    }
    handleError(axiosErr, false);
  }
}

export const get = <T>(url: string, params?: object, options?: RequestOptions) =>
  request<T>({ ...options, method: 'GET', url, params });
export const post = <T>(url: string, data?: unknown, options?: RequestOptions) =>
  request<T>({ ...options, method: 'POST', url, data });
export const put = <T>(url: string, data?: unknown, options?: RequestOptions) =>
  request<T>({ ...options, method: 'PUT', url, data });
export const patch = <T>(url: string, data?: unknown, options?: RequestOptions) =>
  request<T>({ ...options, method: 'PATCH', url, data });
export const del = <T>(url: string, options?: RequestOptions) =>
  request<T>({ ...options, method: 'DELETE', url });
