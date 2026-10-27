import { BadRequestException } from '@nestjs/common';
import { ClassGroup, Prisma, User } from '@prisma/client';
import { Birthday, formatBirthday, validateBirthday } from '../birthdays/birthday.util';
import { today } from '../common/date.util';
import { BirthdayDto } from './dto/birthday.dto';

export type UserRecord = Omit<User, 'passwordHash'> & { group?: ClassGroup | null };

/** 查询用户时统一带上分组 */
export const withGroup = { group: true } satisfies Prisma.UserInclude;

export function toBirthday(u: UserRecord): Birthday | null {
  if (!u.birthdayCalendar || !u.birthMonth || !u.birthDay) return null;
  return {
    calendar: u.birthdayCalendar,
    year: u.birthYear,
    month: u.birthMonth,
    day: u.birthDay,
    isLeapMonth: u.birthIsLeapMonth,
  };
}

function birthdayView(u: UserRecord) {
  const b = toBirthday(u);
  return b ? { ...b, isLeapMonth: !!b.isLeapMonth, text: formatBirthday(b) } : null;
}

/** 用户的简要信息，用于生日列表、公告作者等 */
export function toUserBrief(u: UserRecord) {
  return {
    id: u.id,
    name: u.name,
    studentNo: u.studentNo,
    avatar: u.avatar,
    group: u.group ? { id: u.group.id, name: u.group.name } : null,
  };
}

/** 通讯录中对全班可见的信息 */
export function toDirectoryItem(u: UserRecord) {
  return {
    ...toUserBrief(u),
    role: u.role,
    phone: u.phone,
    qq: u.qq,
    email: u.email,
    dorm: u.dorm,
    remark: u.remark,
    birthday: birthdayView(u),
  };
}

/** 本人或管理员可见的完整资料 */
export function toProfile(u: UserRecord) {
  return {
    ...toDirectoryItem(u),
    username: u.username,
    status: u.status,
    mustChangePassword: u.mustChangePassword,
    emailNotify: u.emailNotify,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
  };
}

/**
 * 把生日输入转换为数据库字段：undefined 不修改，null 清除，其余校验合法性后写入。
 */
type BirthdayFields = Pick<
  Prisma.UserUncheckedCreateInput,
  'birthdayCalendar' | 'birthYear' | 'birthMonth' | 'birthDay' | 'birthIsLeapMonth'
>;

export function birthdayToData(input: BirthdayDto | null | undefined): BirthdayFields | undefined {
  if (input === undefined) return undefined;
  if (input === null) {
    return {
      birthdayCalendar: null,
      birthYear: null,
      birthMonth: null,
      birthDay: null,
      birthIsLeapMonth: false,
    };
  }
  const birthday: Birthday = {
    calendar: input.calendar,
    year: input.year ?? null,
    month: input.month,
    day: input.day,
    isLeapMonth: input.calendar === 'LUNAR' && !!input.isLeapMonth,
  };
  const error = validateBirthday(birthday, today());
  if (error) throw new BadRequestException(error);
  return {
    birthdayCalendar: birthday.calendar,
    birthYear: birthday.year,
    birthMonth: birthday.month,
    birthDay: birthday.day,
    birthIsLeapMonth: birthday.isLeapMonth,
  };
}
