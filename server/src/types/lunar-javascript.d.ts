// lunar-javascript 未自带类型声明，这里只声明项目用到的部分
declare module 'lunar-javascript' {
  export class Solar {
    static fromYmd(year: number, month: number, day: number): Solar;
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    getLunar(): Lunar;
    toYmd(): string;
  }

  export class Lunar {
    /** 闰月用负数表示，如闰六月为 -6；日期不存在时抛出异常 */
    static fromYmd(lunarYear: number, lunarMonth: number, lunarDay: number): Lunar;
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    getSolar(): Solar;
  }

  export class LunarYear {
    static fromYear(lunarYear: number): LunarYear;
    /** 当年闰几月，无闰月返回 0 */
    getLeapMonth(): number;
  }

  export class LunarMonth {
    /** 月份不存在（如当年无此闰月）时返回 null */
    static fromYm(lunarYear: number, lunarMonth: number): LunarMonth | null;
    getDayCount(): number;
  }
}
