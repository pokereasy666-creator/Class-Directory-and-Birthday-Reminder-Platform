/** 与后端接口对应的数据类型 */
export type Role = 'STUDENT' | 'ADMIN';
export type UserStatus = 'PENDING' | 'ACTIVE' | 'DISABLED';
export type CalendarType = 'SOLAR' | 'LUNAR';
export type NotificationType = 'BIRTHDAY_TODAY' | 'BIRTHDAY_UPCOMING' | 'ANNOUNCEMENT';

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PageQuery {
  page?: number;
  pageSize?: number;
}

export interface Group {
  id: number;
  name: string;
  sort: number;
  memberCount: number;
}

export interface BirthdayInput {
  calendar: CalendarType;
  year: number | null;
  month: number;
  day: number;
  isLeapMonth: boolean;
}

export interface BirthdayValue extends BirthdayInput {
  /** 中文展示，如"农历闰六月初三" */
  text: string;
}

export interface UserBrief {
  id: number;
  name: string;
  studentNo: string | null;
  avatar: string | null;
  group: { id: number; name: string } | null;
}

export interface DirectoryUser extends UserBrief {
  role: Role;
  phone: string | null;
  qq: string | null;
  email: string | null;
  dorm: string | null;
  remark: string | null;
  birthday: BirthdayValue | null;
}

export interface Profile extends DirectoryUser {
  username: string;
  status: UserStatus;
  mustChangePassword: boolean;
  emailNotify: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface BirthdayEntry {
  user: UserBrief;
  calendar: CalendarType;
  birthdayText: string;
  /** 本次生日对应的公历日期 YYYY-MM-DD */
  date: string;
  daysLeft: number;
  age: number | null;
}

export interface Announcement {
  id: number;
  title: string;
  content: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  author: { id: number; name: string } | null;
}

export interface NotificationItem {
  id: number;
  type: NotificationType;
  title: string;
  content: string;
  relatedId: number;
  refDate: string;
  readAt: string | null;
  createdAt: string;
}

export interface AdminStats {
  total: number;
  active: number;
  pending: number;
  disabled: number;
  missingBirthday: number;
}

export interface ReminderResult {
  date: string;
  birthdayToday: number;
  birthdayUpcoming: number;
  created: number;
  emailed: number;
}
