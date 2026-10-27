const TOKEN_KEY = 'class-directory-token';

// 隐私模式等情况下 localStorage 可能不可用，此时退化为仅本次页面有效
let memoryToken: string | null = null;

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return memoryToken;
  }
}

export function setToken(token: string) {
  memoryToken = token;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* 忽略 */
  }
}

export function clearToken() {
  memoryToken = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* 忽略 */
  }
}
