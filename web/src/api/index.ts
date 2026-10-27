import { del, download, get, patch, post, put, type RequestOptions } from './http';
import type {
  AdminStats,
  Announcement,
  BirthdayEntry,
  BirthdayInput,
  DirectoryUser,
  Group,
  NotificationItem,
  PageQuery,
  Paged,
  Profile,
  ReminderResult,
  Role,
  UserBrief,
  UserStatus,
} from './types';

export interface ProfileForm {
  phone?: string | null;
  qq?: string | null;
  email?: string | null;
  dorm?: string | null;
  remark?: string | null;
  birthday?: BirthdayInput | null;
  emailNotify?: boolean;
}

export interface AdminUserForm extends ProfileForm {
  name?: string;
  studentNo?: string | null;
  groupId?: number | null;
  role?: Role;
  username?: string | null;
  password?: string;
}

interface AuthResult {
  token: string;
  user: Profile;
}

export const authApi = {
  login: (username: string, password: string) =>
    post<AuthResult>('/auth/login', { username, password }, { silent: true }),
  register: (data: { studentNo: string; name: string; password: string; phone?: string }) =>
    post<{ message: string }>('/auth/register', data, { silent: true }),
  me: (options?: RequestOptions) => get<Profile>('/auth/me', undefined, options),
  changePassword: (oldPassword: string, newPassword: string) =>
    put<AuthResult>('/auth/password', { oldPassword, newPassword }),
};

export const profileApi = {
  update: (data: ProfileForm) => put<Profile>('/profile', data),
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return post<{ avatar: string }>('/profile/avatar', form);
  },
};

export const directoryApi = {
  list: (query: PageQuery & { keyword?: string; groupId?: number }) =>
    get<Paged<DirectoryUser>>('/users', query),
  detail: (id: number) => get<DirectoryUser>(`/users/${id}`),
};

export const birthdayApi = {
  today: () => get<BirthdayEntry[]>('/birthdays/today'),
  upcoming: (days = 7) => get<BirthdayEntry[]>('/birthdays/upcoming', { days }),
  month: (year: number, month: number) => get<BirthdayEntry[]>('/birthdays/month', { year, month }),
};

export const groupApi = {
  list: () => get<Group[]>('/groups'),
  create: (data: { name: string; sort?: number }) => post<Group>('/admin/groups', data),
  update: (id: number, data: { name: string; sort?: number }) =>
    put<Group>(`/admin/groups/${id}`, data),
  remove: (id: number) => del<null>(`/admin/groups/${id}`),
};

export const announcementApi = {
  list: (query: PageQuery) => get<Paged<Announcement>>('/announcements', query),
  detail: (id: number) => get<Announcement>(`/announcements/${id}`),
  create: (data: { title: string; content: string; pinned: boolean }) =>
    post<Announcement>('/admin/announcements', data),
  update: (id: number, data: { title: string; content: string; pinned: boolean }) =>
    put<Announcement>(`/admin/announcements/${id}`, data),
  remove: (id: number) => del<null>(`/admin/announcements/${id}`),
};

export const notificationApi = {
  list: (query: PageQuery & { unreadOnly?: boolean }) =>
    get<Paged<NotificationItem>>('/notifications', query),
  unreadCount: () =>
    get<{ count: number }>('/notifications/unread-count', undefined, { silent: true }),
  read: (id: number) => put<null>(`/notifications/${id}/read`),
  readAll: () => put<{ count: number }>('/notifications/read-all'),
};

export const adminApi = {
  stats: () => get<AdminStats>('/admin/stats'),
  users: (
    query: PageQuery & { keyword?: string; status?: UserStatus; role?: Role; groupId?: number },
  ) => get<Paged<Profile>>('/admin/users', query),
  createUser: (data: AdminUserForm) => post<Profile>('/admin/users', data),
  updateUser: (id: number, data: AdminUserForm) => put<Profile>(`/admin/users/${id}`, data),
  setStatus: (id: number, status: 'ACTIVE' | 'DISABLED') =>
    patch<Profile>(`/admin/users/${id}/status`, { status }),
  resetPassword: (id: number, password: string) =>
    post<null>(`/admin/users/${id}/reset-password`, { password }),
  removeUser: (id: number) => del<null>(`/admin/users/${id}`),
  birthdays: () =>
    get<{ today: string; entries: BirthdayEntry[]; missing: UserBrief[] }>('/admin/birthdays'),
  exportDirectory: () => download('/admin/export/directory'),
  runReminder: (date?: string) =>
    post<ReminderResult>('/admin/reminders/run', date ? { date } : {}),
};
