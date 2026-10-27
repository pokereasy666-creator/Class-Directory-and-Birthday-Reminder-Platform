import type { FormItemRule } from 'element-plus';

/** 与后端 common/validation.ts 保持一致的校验规则 */
export const PATTERNS = {
  studentNo: /^\d{4,20}$/,
  name: /^[一-龥A-Za-z·\s]{2,20}$/,
  phone: /^1[3-9]\d{9}$/,
  qq: /^[1-9]\d{4,11}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  username: /^[A-Za-z0-9_]{3,32}$/,
  password: /^(?=.*[A-Za-z])(?=.*\d).{6,32}$/,
};

const pattern = (re: RegExp, message: string, required = false): FormItemRule[] => [
  ...(required ? [{ required: true, message, trigger: 'blur' } as FormItemRule] : []),
  { pattern: re, message, trigger: 'blur' },
];

export const rules = {
  studentNo: (required = true) => pattern(PATTERNS.studentNo, '学号应为 4~20 位数字', required),
  name: () => pattern(PATTERNS.name, '姓名应为 2~20 个中文或英文字符', true),
  phone: () => pattern(PATTERNS.phone, '手机号格式不正确'),
  qq: () => pattern(PATTERNS.qq, 'QQ 号格式不正确'),
  email: () => pattern(PATTERNS.email, '邮箱格式不正确'),
  username: () => pattern(PATTERNS.username, '账号应为 3~32 位字母、数字或下划线'),
  password: () => pattern(PATTERNS.password, '密码应为 6~32 位，且同时包含字母和数字', true),
};
