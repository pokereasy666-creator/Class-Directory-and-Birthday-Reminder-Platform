import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

/** 全站统一使用北京时间判断"今天" */
export const APP_TIMEZONE = 'Asia/Shanghai';

/** 日期统一用 YYYY-MM-DD 字符串表示，避免 Date 对象带来的时区偏移 */
export type DateStr = string;

export function today(now: Date = new Date()): DateStr {
  return dayjs(now).tz(APP_TIMEZONE).format('YYYY-MM-DD');
}

export function addDays(date: DateStr, days: number): DateStr {
  return dayjs.utc(date).add(days, 'day').format('YYYY-MM-DD');
}

/** a - b 相差的天数 */
export function diffDays(a: DateStr, b: DateStr): number {
  return dayjs.utc(a).diff(dayjs.utc(b), 'day');
}

export function formatDate(year: number, month: number, day: number): DateStr {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseDate(date: DateStr): { year: number; month: number; day: number } {
  const [year, month, day] = date.split('-').map(Number);
  return { year, month, day };
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInSolarMonth(year: number, month: number): number {
  return dayjs.utc(formatDate(year, month, 1)).daysInMonth();
}

export function monthRange(year: number, month: number): { start: DateStr; end: DateStr } {
  return {
    start: formatDate(year, month, 1),
    end: formatDate(year, month, daysInSolarMonth(year, month)),
  };
}
