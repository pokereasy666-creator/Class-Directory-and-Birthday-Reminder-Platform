import { LunarMonth, LunarYear, Solar } from 'lunar-javascript';
import { addDays, monthRange, parseDate } from '../common/date.util';
import {
  Birthday,
  daysUntilBirthday,
  formatBirthday,
  nextOccurrence,
  occurrenceInRange,
  turningAge,
  validateBirthday,
} from './birthday.util';

const solar = (month: number, day: number, year?: number): Birthday => ({
  calendar: 'SOLAR',
  month,
  day,
  year,
});
const lunar = (month: number, day: number, year?: number, isLeapMonth = false): Birthday => ({
  calendar: 'LUNAR',
  month,
  day,
  year,
  isLeapMonth,
});

describe('nextOccurrence - 公历', () => {
  it('今年生日未过则返回今年，已过则返回明年', () => {
    expect(nextOccurrence(solar(5, 12), '2026-05-01')).toBe('2026-05-12');
    expect(nextOccurrence(solar(5, 12), '2026-05-12')).toBe('2026-05-12');
    expect(nextOccurrence(solar(5, 12), '2026-05-13')).toBe('2027-05-12');
  });

  it('跨年：12 月底查询能命中次年 1 月初', () => {
    expect(nextOccurrence(solar(1, 2), '2026-12-28')).toBe('2027-01-02');
    expect(occurrenceInRange(solar(1, 2), '2026-12-28', addDays('2026-12-28', 6))).toBe(
      '2027-01-02',
    );
  });

  it('2 月 29 日生日：平年按 2 月 28 日，闰年按 2 月 29 日', () => {
    expect(nextOccurrence(solar(2, 29), '2026-01-01')).toBe('2026-02-28');
    expect(nextOccurrence(solar(2, 29), '2026-03-01')).toBe('2027-02-28');
    expect(nextOccurrence(solar(2, 29), '2028-01-01')).toBe('2028-02-29');
  });
});

describe('nextOccurrence - 农历', () => {
  it('普通农历生日换算为公历', () => {
    // 农历 2026 年八月十五 = 公历 2026-09-25
    expect(nextOccurrence(lunar(8, 15), '2026-09-01')).toBe('2026-09-25');
  });

  it('公历 1 月仍处于上一农历年时，取上一农历年的腊月', () => {
    // 农历 2026 年腊月十三 = 公历 2027-01-20；若只看农历 2027 年会错误地得到 2028-01-09
    expect(nextOccurrence(lunar(12, 13), '2027-01-01')).toBe('2027-01-20');
  });

  it('当年农历生日已过时取下一农历年', () => {
    // 农历 2026 年十月初一 = 2026-11-09 已过，农历 2027 年十月初一 = 2027-10-29
    expect(nextOccurrence(lunar(10, 1), '2026-12-01')).toBe('2027-10-29');
  });

  it('三十出生遇到小月按二十九过', () => {
    // 农历 2026 年二月只有 29 天，二月廿九 = 2026-04-16
    expect(nextOccurrence(lunar(2, 30), '2026-03-01')).toBe('2026-04-16');
    // 农历 2027 年二月有 30 天，二月三十 = 2027-04-06
    expect(nextOccurrence(lunar(2, 30), '2027-01-01')).toBe('2027-04-06');
  });

  it('闰月出生：当年有该闰月在闰月过，否则在正常月份过', () => {
    // 农历 2025 年闰六月初三 = 2025-07-27，正常六月初三 = 2025-06-27
    expect(nextOccurrence(lunar(6, 3, undefined, true), '2025-06-01')).toBe('2025-07-27');
    expect(nextOccurrence(lunar(6, 3), '2025-06-01')).toBe('2025-06-27');
    // 农历 2026 年无闰六月，六月初三 = 2026-07-16
    expect(nextOccurrence(lunar(6, 3, undefined, true), '2026-01-01')).toBe('2026-07-16');
  });
});

describe('区间与天数', () => {
  it('本月区间包含首尾两天', () => {
    const { start, end } = monthRange(2026, 2);
    expect([start, end]).toEqual(['2026-02-01', '2026-02-28']);
    expect(occurrenceInRange(solar(2, 1), start, end)).toBe('2026-02-01');
    expect(occurrenceInRange(solar(2, 28), start, end)).toBe('2026-02-28');
    expect(occurrenceInRange(solar(2, 29), start, end)).toBe('2026-02-28');
    expect(occurrenceInRange(solar(3, 1), start, end)).toBeNull();
    expect(occurrenceInRange(solar(1, 31), start, end)).toBeNull();
  });

  it('距离天数：今天生日为 0，跨年正确计算', () => {
    expect(daysUntilBirthday(solar(10, 27), '2026-10-27')).toBe(0);
    expect(daysUntilBirthday(solar(10, 26), '2026-10-27')).toBe(364);
    expect(daysUntilBirthday(solar(1, 1), '2026-12-31')).toBe(1);
  });

  it('周岁：公历按公历年，农历按农历年计算', () => {
    expect(turningAge(solar(5, 12, 2004), '2026-05-12')).toBe(22);
    expect(turningAge(solar(5, 12), '2026-05-12')).toBeNull();
    // 2027-01-20 是农历 2026 年腊月十三
    expect(turningAge(lunar(12, 13, 2004), '2027-01-20')).toBe(22);
  });
});

describe('validateBirthday', () => {
  const today = '2026-10-27';

  it('接受合法生日', () => {
    expect(validateBirthday(solar(2, 29), today)).toBeNull();
    expect(validateBirthday(solar(2, 29, 2004), today)).toBeNull();
    expect(validateBirthday(lunar(6, 3, 2025, true), today)).toBeNull();
    expect(validateBirthday(lunar(2, 30), today)).toBeNull();
  });

  it('拒绝不存在的日期', () => {
    expect(validateBirthday(solar(2, 30), today)).toBe('该月没有这一天');
    expect(validateBirthday(solar(2, 29, 2005), today)).toBe('该月没有这一天');
    expect(validateBirthday(solar(13, 1), today)).toBe('生日月份应为 1~12');
    expect(validateBirthday(lunar(1, 31), today)).toBe('农历日期最大为三十');
    expect(validateBirthday(lunar(6, 3, 2024, true), today)).toBe('农历2024年没有闰六月');
    expect(validateBirthday(lunar(2, 30, 2026), today)).toBe('农历2026年二月只有 29 天');
    expect(validateBirthday({ ...solar(5, 1), isLeapMonth: true }, today)).toBe(
      '公历生日不存在闰月',
    );
  });

  it('拒绝未来日期与超范围年份', () => {
    expect(validateBirthday(solar(12, 1, 2026), today)).toBe('生日不能晚于今天');
    expect(validateBirthday(solar(1, 1, 1899), today)).toBe('出生年份应在 1900~2026 之间');
    expect(validateBirthday(lunar(10, 1, 2026), today)).toBe('生日不能晚于今天');
  });
});

describe('formatBirthday', () => {
  it('生成中文展示', () => {
    expect(formatBirthday(solar(5, 12, 2004))).toBe('2004年5月12日');
    expect(formatBirthday(solar(5, 12))).toBe('5月12日');
    expect(formatBirthday(lunar(6, 3, undefined, true))).toBe('农历闰六月初三');
    expect(formatBirthday(lunar(12, 30, 2003))).toBe('农历2003年腊月三十');
  });
});

/**
 * 交叉验证：用"逐日向后扫描 + 公历转农历"的朴素算法作为参照，
 * 与"农历转公历 + 候选年取最小值"的实现对比，覆盖大量随机生日和查询日期。
 */
describe('nextOccurrence 与逐日扫描结果一致', () => {
  // 参照算法自带的按年缓存，与被测代码的缓存相互独立
  const leapCache = new Map<number, number>();
  const daysCache = new Map<string, number>();
  const leapOf = (y: number) => {
    if (!leapCache.has(y)) leapCache.set(y, LunarYear.fromYear(y).getLeapMonth());
    return leapCache.get(y)!;
  };
  const daysOf = (y: number, m: number) => {
    const key = `${y}:${m}`;
    if (!daysCache.has(key)) daysCache.set(key, LunarMonth.fromYm(y, m)!.getDayCount());
    return daysCache.get(key)!;
  };

  const lunarCache = new Map<string, { year: number; month: number; day: number }>();
  const lunarOf = (date: string) => {
    if (!lunarCache.has(date)) {
      const { year, month, day } = parseDate(date);
      const l = Solar.fromYmd(year, month, day).getLunar();
      lunarCache.set(date, { year: l.getYear(), month: l.getMonth(), day: l.getDay() });
    }
    return lunarCache.get(date)!;
  };

  function bruteForce(b: Birthday, from: string): string {
    for (let i = 0; i <= 400; i++) {
      const date = addDays(from, i);
      const { month, day } = parseDate(date);
      if (b.calendar === 'SOLAR') {
        const isFeb29Fallback =
          b.month === 2 &&
          b.day === 29 &&
          month === 2 &&
          day === 28 &&
          parseDate(addDays(date, 1)).day !== 29;
        if ((month === b.month && day === b.day) || isFeb29Fallback) return date;
        continue;
      }
      const l = lunarOf(date);
      const target = b.isLeapMonth && leapOf(l.year) === b.month ? -b.month : b.month;
      const expectedDay = Math.min(b.day, daysOf(l.year, target));
      if (l.month === target && l.day === expectedDay) return date;
    }
    throw new Error('400 天内未找到生日');
  }

  // 固定种子的线性同余随机数，保证测试可复现；取高位，低位周期太短
  let seed = 20261027;
  const rand = (n: number) => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return Math.floor((seed / 2147483648) * n);
  };

  it('随机 600 组用例', () => {
    for (let i = 0; i < 600; i++) {
      const isLunar = rand(2) === 1;
      const month = rand(12) + 1;
      const b: Birthday = isLunar
        ? { calendar: 'LUNAR', month, day: rand(30) + 1, isLeapMonth: rand(5) === 0 }
        : {
            calendar: 'SOLAR',
            month,
            day: Math.min(
              rand(31) + 1,
              [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1],
            ),
          };
      const from = addDays('2020-01-01', rand(365 * 15));
      expect({ b, from, date: nextOccurrence(b, from) }).toEqual({
        b,
        from,
        date: bruteForce(b, from),
      });
    }
  });
});
