export const LUNAR_MONTHS = [
  '正月',
  '二月',
  '三月',
  '四月',
  '五月',
  '六月',
  '七月',
  '八月',
  '九月',
  '十月',
  '冬月',
  '腊月',
];

export const LUNAR_DAYS = [
  '初一',
  '初二',
  '初三',
  '初四',
  '初五',
  '初六',
  '初七',
  '初八',
  '初九',
  '初十',
  '十一',
  '十二',
  '十三',
  '十四',
  '十五',
  '十六',
  '十七',
  '十八',
  '十九',
  '二十',
  '廿一',
  '廿二',
  '廿三',
  '廿四',
  '廿五',
  '廿六',
  '廿七',
  '廿八',
  '廿九',
  '三十',
];

/** 公历每月最多天数（2 月按 29 天，允许 2 月 29 日生日） */
export const SOLAR_MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function daysLeftText(days: number): string {
  if (days === 0) return '今天';
  if (days === 1) return '明天';
  if (days === 2) return '后天';
  return `${days} 天后`;
}

export function daysLeftTagType(days: number): 'danger' | 'warning' | 'info' {
  if (days === 0) return 'danger';
  if (days <= 3) return 'warning';
  return 'info';
}
