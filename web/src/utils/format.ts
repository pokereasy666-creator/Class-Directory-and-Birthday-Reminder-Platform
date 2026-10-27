import dayjs from 'dayjs';

export const formatDateTime = (value: string | null | undefined) =>
  value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-';

/** 2026-10-27 → 10月27日 周二 */
export const formatMonthDay = (date: string) => dayjs(date).format('M月D日 ddd');

/** 生成随机初始密码（字母+数字，满足后端密码规则） */
export function randomPassword(length = 8): string {
  const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';
  const digits = '23456789';
  const all = letters + digits;
  const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)];
  const rest = Array.from({ length: length - 2 }, () => pick(all));
  return [pick(letters), pick(digits), ...rest].sort(() => Math.random() - 0.5).join('');
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 立即释放会导致部分浏览器丢失文件名，延迟释放
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
