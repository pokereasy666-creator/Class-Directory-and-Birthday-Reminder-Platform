/**
 * 生日核心算法。
 *
 * 所有生日查询（今天、近 N 天、本月、距离天数、定时提醒）都归约为一个函数：
 *   nextOccurrence(birthday, from) => 公历日期 >= from 的最近一次生日
 * 再用 inRange(b, start, end) ⇔ nextOccurrence(b, start) <= end 判断区间。
 *
 * 需要处理的边界：
 *   1. 跨年：12 月底查询"近 7 天"要能命中次年 1 月初的生日；
 *   2. 公历 2 月 29 日生日在平年按 2 月 28 日过；
 *   3. 农历年滞后于公历年：公历 1~2 月仍可能处于上一农历年，所以要同时尝试农历 Y-1、Y、Y+1 年；
 *   4. 农历小月只有 29 天：三十出生的人在小月年份按二十九过；
 *   5. 农历闰月：当年有同一个闰月则在闰月过，否则在正常月份过。
 */
import { LunarYear, Solar } from 'lunar-javascript';
import {
  addDays,
  DateStr,
  daysInSolarMonth,
  diffDays,
  formatDate,
  isLeapYear,
  parseDate,
} from '../common/date.util';

export type CalendarKind = 'SOLAR' | 'LUNAR';

export interface Birthday {
  calendar: CalendarKind;
  /** 出生年份，可为空（用户选择隐藏年龄） */
  year?: number | null;
  month: number;
  day: number;
  /** 仅农历有效：是否闰月出生 */
  isLeapMonth?: boolean;
}

export const MIN_BIRTH_YEAR = 1900;

const LUNAR_MONTH_NAMES = [
  '',
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

const LUNAR_DAY_NAMES = [
  '',
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

/** 公历生日在公历 year 年对应的日期 */
export function solarOccurrenceInYear(b: Birthday, year: number): DateStr {
  if (b.month === 2 && b.day === 29 && !isLeapYear(year)) {
    return formatDate(year, 2, 28);
  }
  return formatDate(year, b.month, b.day);
}

interface LunarYearTable {
  /** 闰几月，无闰月为 0 */
  leapMonth: number;
  /** 键为月份（闰月为负数），值为该月初一的公历日期和天数 */
  months: Map<number, { firstDay: DateStr; days: number }>;
}

/*
 * 性能：lunar-javascript 换算一个农历日期要先推算整年的节气和朔日（单次约 0.5ms），
 * 而它只缓存最近使用的一个年份。nextOccurrence 对每个人依次尝试 Y-1、Y、Y+1 三个年份，
 * 缓存每次都失效，全班几十人一次查询就要上百毫秒。
 * 这里按农历年缓存"每月初一的公历日期 + 当月天数"，任意农历日期都可以用
 * "初一 + (日 - 1) 天"直接得到，同一年份只推算一次。缓存规模为用到的年份数 × 13 个月。
 */
const lunarYearTables = new Map<number, LunarYearTable>();

export function lunarYearTable(lunarYear: number): LunarYearTable {
  let table = lunarYearTables.get(lunarYear);
  if (!table) {
    const year = LunarYear.fromYear(lunarYear);
    table = { leapMonth: year.getLeapMonth(), months: new Map() };
    for (const m of year.getMonthsInYear()) {
      table.months.set(m.getMonth(), {
        firstDay: Solar.fromJulianDay(m.getFirstJulianDay()).toYmd(),
        days: m.getDayCount(),
      });
    }
    lunarYearTables.set(lunarYear, table);
  }
  return table;
}

/** 农历日期转公历；日期超过当月天数时返回 null */
function lunarToSolar(lunarYear: number, month: number, day: number): DateStr | null {
  const m = lunarYearTable(lunarYear).months.get(month);
  return m && day <= m.days ? addDays(m.firstDay, day - 1) : null;
}

/** 农历生日在农历 lunarYear 年对应的公历日期 */
export function lunarOccurrenceInLunarYear(b: Birthday, lunarYear: number): DateStr {
  const table = lunarYearTable(lunarYear);
  const month = b.isLeapMonth && table.leapMonth === b.month ? -b.month : b.month;
  const { days } = table.months.get(month)!;
  return lunarToSolar(lunarYear, month, Math.min(b.day, days))!;
}

/** 返回 >= from 的最近一次生日（公历日期） */
export function nextOccurrence(b: Birthday, from: DateStr): DateStr {
  const { year } = parseDate(from);
  const candidates =
    b.calendar === 'LUNAR'
      ? [year - 1, year, year + 1].map((y) => lunarOccurrenceInLunarYear(b, y))
      : [year, year + 1].map((y) => solarOccurrenceInYear(b, y));
  // YYYY-MM-DD 字符串的字典序即时间顺序
  return candidates.filter((d) => d >= from).sort()[0];
}

/** 生日是否落在 [start, end] 区间内（含两端），是则返回那一天，否则返回 null */
export function occurrenceInRange(b: Birthday, start: DateStr, end: DateStr): DateStr | null {
  const date = nextOccurrence(b, start);
  return date <= end ? date : null;
}

/** 距离下一次生日的天数，今天生日为 0 */
export function daysUntilBirthday(b: Birthday, today: DateStr): number {
  return diffDays(nextOccurrence(b, today), today);
}

/** 在 occurrence 这天过的是几岁生日；未填写出生年份返回 null */
export function turningAge(b: Birthday, occurrence: DateStr): number | null {
  if (!b.year) return null;
  const { year, month, day } = parseDate(occurrence);
  const occurrenceYear =
    b.calendar === 'LUNAR' ? Solar.fromYmd(year, month, day).getLunar().getYear() : year;
  return occurrenceYear - b.year;
}

/** 生日的中文展示，如"2004年5月12日"、"农历闰六月初三" */
export function formatBirthday(b: Birthday): string {
  const yearPart = b.year ? `${b.year}年` : '';
  if (b.calendar === 'LUNAR') {
    return `农历${yearPart}${b.isLeapMonth ? '闰' : ''}${LUNAR_MONTH_NAMES[b.month]}${LUNAR_DAY_NAMES[b.day]}`;
  }
  return `${yearPart}${b.month}月${b.day}日`;
}

/** 校验生日是否合法，合法返回 null，否则返回错误提示 */
export function validateBirthday(b: Birthday, today: DateStr): string | null {
  const { month, day } = b;
  const year = b.year ?? null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return '生日月份应为 1~12';
  if (!Number.isInteger(day) || day < 1) return '生日日期不合法';
  if (year !== null) {
    const currentYear = parseDate(today).year;
    if (!Number.isInteger(year) || year < MIN_BIRTH_YEAR || year > currentYear) {
      return `出生年份应在 ${MIN_BIRTH_YEAR}~${currentYear} 之间`;
    }
  }

  if (b.calendar === 'SOLAR') {
    if (b.isLeapMonth) return '公历生日不存在闰月';
    // 未填年份时按闰年校验，允许 2 月 29 日
    if (day > daysInSolarMonth(year ?? 2000, month)) return '该月没有这一天';
    if (year !== null && formatDate(year, month, day) > today) return '生日不能晚于今天';
    return null;
  }

  if (day > 30) return '农历日期最大为三十';
  if (year === null) return null;
  if (b.isLeapMonth && lunarYearTable(year).leapMonth !== month) {
    return `农历${year}年没有闰${LUNAR_MONTH_NAMES[month]}`;
  }
  const solar = lunarToSolar(year, b.isLeapMonth ? -month : month, day);
  if (!solar)
    return `农历${year}年${b.isLeapMonth ? '闰' : ''}${LUNAR_MONTH_NAMES[month]}只有 29 天`;
  if (solar > today) return '生日不能晚于今天';
  return null;
}
