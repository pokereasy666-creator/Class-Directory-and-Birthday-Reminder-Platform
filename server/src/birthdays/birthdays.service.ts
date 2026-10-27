import { BadRequestException, Injectable } from '@nestjs/common';
import { addDays, DateStr, diffDays, monthRange, parseDate, today } from '../common/date.util';
import { PrismaService } from '../prisma/prisma.service';
import { toBirthday, toUserBrief, UserRecord, withGroup } from '../users/user.mapper';
import {
  Birthday,
  formatBirthday,
  nextOccurrence,
  occurrenceInRange,
  turningAge,
} from './birthday.util';

export interface BirthdayEntry {
  user: ReturnType<typeof toUserBrief>;
  calendar: Birthday['calendar'];
  birthdayText: string;
  /** 这次生日对应的公历日期 */
  date: DateStr;
  /** 距今天数，0 表示今天 */
  daysLeft: number;
  /** 过几岁生日，未填出生年份为 null */
  age: number | null;
}

export const MAX_UPCOMING_DAYS = 60;

@Injectable()
export class BirthdaysService {
  constructor(private readonly prisma: PrismaService) {}

  /** 所有已填写生日的正常账号。班级规模几十人，全部取出在内存中计算即可 */
  async activeWithBirthday(): Promise<{ user: UserRecord; birthday: Birthday }[]> {
    const users = await this.prisma.user.findMany({
      where: { status: 'ACTIVE', birthdayCalendar: { not: null } },
      include: withGroup,
    });
    return users.flatMap((user) => {
      const birthday = toBirthday(user);
      return birthday ? [{ user, birthday }] : [];
    });
  }

  /** 生日落在 [start, end] 内的同学，按日期排序 */
  async inRange(start: DateStr, end: DateStr, now: DateStr = today()): Promise<BirthdayEntry[]> {
    const list = await this.activeWithBirthday();
    return list
      .flatMap(({ user, birthday }) => {
        const date = occurrenceInRange(birthday, start, end);
        return date ? [this.toEntry(user, birthday, date, now)] : [];
      })
      .sort(byDateThenName);
  }

  todayList(now: DateStr = today()) {
    return this.inRange(now, now, now);
  }

  /** 未来 days 天（含今天）过生日的同学 */
  upcoming(days: number, now: DateStr = today()) {
    if (!Number.isInteger(days) || days < 1 || days > MAX_UPCOMING_DAYS) {
      throw new BadRequestException(`天数应在 1~${MAX_UPCOMING_DAYS} 之间`);
    }
    return this.inRange(now, addDays(now, days - 1), now);
  }

  /** 某年某月过生日的同学，默认本月 */
  month(year?: number, month?: number, now: DateStr = today()) {
    const current = parseDate(now);
    const y = year ?? current.year;
    const m = month ?? current.month;
    if (!Number.isInteger(m) || m < 1 || m > 12 || !Number.isInteger(y) || y < 1901 || y > 2099) {
      throw new BadRequestException('年份或月份不合法');
    }
    const { start, end } = monthRange(y, m);
    return this.inRange(start, end, now);
  }

  /** 管理员总览：全部已填生日按下次生日排序，并列出未填写生日的同学 */
  async overview(now: DateStr = today()) {
    const users = await this.prisma.user.findMany({
      where: { status: 'ACTIVE' },
      include: withGroup,
      orderBy: [{ studentNo: 'asc' }, { id: 'asc' }],
    });
    const entries: BirthdayEntry[] = [];
    const missing: ReturnType<typeof toUserBrief>[] = [];
    for (const user of users) {
      const birthday = toBirthday(user);
      if (birthday) entries.push(this.toEntry(user, birthday, nextOccurrence(birthday, now), now));
      else missing.push(toUserBrief(user));
    }
    return { today: now, entries: entries.sort(byDateThenName), missing };
  }

  toEntry(user: UserRecord, birthday: Birthday, date: DateStr, now: DateStr): BirthdayEntry {
    return {
      user: toUserBrief(user),
      calendar: birthday.calendar,
      birthdayText: formatBirthday(birthday),
      date,
      daysLeft: diffDays(date, now),
      age: turningAge(birthday, date),
    };
  }
}

function byDateThenName(a: BirthdayEntry, b: BirthdayEntry): number {
  return a.date.localeCompare(b.date) || a.user.name.localeCompare(b.user.name, 'zh-CN');
}
